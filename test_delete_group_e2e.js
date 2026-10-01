/**
 * test_delete_group_e2e.js
 * End-to-end test verifying group deletion by Admin:
 * 1. Admin connects to #admin
 * 2. Student 1 (Lucas) enters and creates "Grupo A Borrar"
 * 3. Student 2 (Mateo) joins "Grupo A Borrar"
 * 4. Admin deletes "Grupo A Borrar"
 * 5. Verify Lucas and Mateo are kicked back to the groups hub
 * 6. Verify "Grupo A Borrar" disappears from groups list
 */

const puppeteer = require('puppeteer-core');
const assert = require('assert');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;

const BASE_URL = 'http://localhost:8080/';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  let browser;
  try {
    console.log("=== INICIANDO TEST E2E DE ELIMINACIÓN DE GRUPOS POR EL ADMIN ===");
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      protocolTimeout: 60000,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 1. ADMIN
    console.log("[Paso 1] Abriendo Admin (#admin)...");
    const pageAdmin = await browser.newPage();
    pageAdmin.on('console', msg => console.log(`[Admin Console ${msg.type()}]:`, msg.text()));
    pageAdmin.on('pageerror', err => console.log(`[Admin Page Error]:`, err));
    pageAdmin.on('dialog', async dialog => {
      console.log(`[Admin Dialog]: ${dialog.message()}`);
      await dialog.accept();
    });
    await pageAdmin.goto(`${BASE_URL}#admin`, { waitUntil: 'networkidle2' });

    // 2. ALUMNO 1 (Lucas)
    console.log("[Paso 2] Alumno 1 (Lucas) entra y crea 'Grupo A Borrar'...");
    const pageLucas = await browser.newPage();
    await pageLucas.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await pageLucas.waitForSelector('#student-name-input');
    await pageLucas.type('#student-name-input', 'Lucas');
    await pageLucas.click('form button[type="submit"]');
    await pageLucas.waitForSelector('#hub-create-group-btn');

    await pageLucas.click('#hub-create-group-btn');
    await pageLucas.waitForSelector('#new-group-name-input');
    await pageLucas.type('#new-group-name-input', 'Grupo A Borrar');
    await pageLucas.click('#modal-confirm-create-btn');

    await pageLucas.waitForSelector('#group-room-title');
    const groupNameLucas = await pageLucas.$eval('#group-room-title', el => el.innerText);
    assert.ok(groupNameLucas.includes('Grupo A Borrar'), "El nombre debe coincidir");
    console.log("✓ Lucas creó 'Grupo A Borrar' y está en la sala de espera.");

    // 3. ALUMNO 2 (Mateo)
    console.log("[Paso 3] Alumno 2 (Mateo) se une a 'Grupo A Borrar'...");
    const pageMateo = await browser.newPage();
    await pageMateo.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await pageMateo.waitForSelector('#student-name-input');
    await pageMateo.type('#student-name-input', 'Mateo');
    await pageMateo.click('form button[type="submit"]');

    await pageMateo.waitForSelector('[id^="btn-join-group-"]');
    await pageMateo.click('[id^="btn-join-group-"]');
    await pageMateo.waitForSelector('#group-room-title');
    console.log("✓ Mateo se unió a 'Grupo A Borrar'.");

    // 4. VERIFICAR QUE ADMIN VE EL GRUPO CON EL BOTÓN ELIMINAR
    console.log("[Paso 4] Verificando que Admin ve el grupo y su botón 'Eliminar'...");
    await sleep(500);
    const deleteBtn = await pageAdmin.waitForSelector('.btn-delete-group');
    assert.ok(deleteBtn, "El botón Eliminar grupo debe existir en la tarjeta de Admin");
    console.log("✓ Botón 'Eliminar' presente en el panel de Admin.");

    // 5. ADMIN HACE CLIC EN ELIMINAR
    console.log("[Paso 5] Admin hace clic en 'Eliminar'...");
    await pageAdmin.evaluate(() => {
      window.confirm = () => true;
      document.querySelector('.btn-delete-group').click();
    });
    await sleep(1000);

    // 6. VERIFICAR QUE EN ADMIN EL GRUPO YA NO ESTÁ
    const adminGroupsCount = await pageAdmin.$eval('#admin-groups-count', el => el.innerText);
    assert.strictEqual(adminGroupsCount, '0 Grupos Creados');
    console.log("✓ Grupo eliminado de la pantalla de Admin (0 Grupos Creados).");

    // 7. VERIFICAR QUE LUCAS FUE DEVUELTO AL HUB DE GRUPOS
    const lucasCurrentView = await pageLucas.evaluate(() => window.app.currentViewId);
    assert.strictEqual(lucasCurrentView, 'view-groups-hub', "Lucas debió volver a view-groups-hub");
    console.log("✓ Lucas fue expulsado del grupo disuelto y devuelto al Hub de Grupos.");

    // 8. VERIFICAR QUE MATEO FUE DEVUELTO AL HUB DE GRUPOS
    const mateoCurrentView = await pageMateo.evaluate(() => window.app.currentViewId);
    assert.strictEqual(mateoCurrentView, 'view-groups-hub', "Mateo debió volver a view-groups-hub");
    console.log("✓ Mateo fue expulsado del grupo disuelto y devuelto al Hub de Grupos.");

    // 9. VERIFICAR QUE EL GRUPO YA NO APARECE EN LA LISTA
    const lucasCardsCount = await pageLucas.$$eval('[id^="btn-join-group-"]', btns => btns.length);
    assert.strictEqual(lucasCardsCount, 0, "No debe haber botones para unirse a grupos");
    console.log("✓ La lista de grupos en los celulares quedó limpia en 0.");

    console.log("\n==========================================================");
    console.log("  TODAS LAS PRUEBAS DE ELIMINACIÓN DE GRUPOS PASARON OK");
    console.log("==========================================================\n");
  } catch (err) {
    console.error("ERROR EN TEST:", err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
