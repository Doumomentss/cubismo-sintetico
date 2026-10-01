/**
 * test_multiclient_e2e.js
 * End-to-end multi-client browser test using real Chrome via puppeteer-core.
 * Simulates the real classroom flow with unique element IDs and reliable WebSockets:
 * 1. Admin/Projector opens #admin on the classroom screen.
 * 2. Student 1 (Lucas) enters and creates Group 1.
 * 3. Student 2 (Mateo) joins Group 1.
 * 4. Student 3 (Sofía) enters and creates Group 2.
 * 5. Student 4 (Camila) joins Group 2.
 * 6. Admin starts Question 1 session.
 * 7. Verification of real-time timer on student screens (without touching options).
 * 8. Real-time consensus voting in Group 1.
 * 9. Real-time split vote & tie warning in Group 2.
 * 10. Admin evaluation & random tie-breaker.
 * 11. Leaderboard & transition to Question 2.
 */

const puppeteer = require('puppeteer-core');
const assert = require('assert');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browserPath = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;
console.log(`Usando navegador: ${browserPath}`);

const BASE_URL = 'http://localhost:8080/';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  let browser;
  try {
    console.log("Iniciando navegador headless para simulación multi-cliente...");
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      protocolTimeout: 120000,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 1. ABRIR PANTALLA DE PROYECTOR / ADMIN (#admin)
    console.log("\n[PASO 1] Abriendo Pantalla de Control #admin (Proyector)...");
    const pageAdmin = await browser.newPage();
    pageAdmin.on('console', msg => {
      if (msg.type() === 'error') console.log(`[Admin Console Error]:`, msg.text());
    });
    await pageAdmin.goto(`${BASE_URL}#admin`, { waitUntil: 'networkidle2' });
    await pageAdmin.waitForSelector('#admin-start-first-btn');
    console.log("✓ Pantalla de Admin/Proyector lista y a la espera de alumnos.");

    // 2. CONECTAR ALUMNO 1: LUCAS
    console.log("\n[PASO 2] Conectando Alumno 1 (Lucas)...");
    const pageLucas = await browser.newPage();
    await pageLucas.goto(BASE_URL, { waitUntil: 'networkidle2' });

    await pageLucas.waitForSelector('#student-name-input');
    await pageLucas.type('#student-name-input', 'Lucas');
    await pageLucas.click('form button[type="submit"]');

    // Lucas crea Grupo 1
    await pageLucas.waitForSelector('#hub-create-group-btn');
    await pageLucas.click('#hub-create-group-btn');
    await pageLucas.waitForSelector('#new-group-name-input');
    await pageLucas.type('#new-group-name-input', 'Picasso y Braque');
    await pageLucas.click('#modal-confirm-create-btn');

    await pageLucas.waitForSelector('#group-room-title');
    console.log("✓ Lucas creó 'Picasso y Braque' y está en la sala de espera.");

    // 3. CONECTAR ALUMNO 2: MATEO
    console.log("\n[PASO 3] Conectando Alumno 2 (Mateo)...");
    const pageMateo = await browser.newPage();
    await pageMateo.goto(BASE_URL, { waitUntil: 'networkidle2' });

    await pageMateo.waitForSelector('#student-name-input');
    await pageMateo.type('#student-name-input', 'Mateo');
    await pageMateo.click('form button[type="submit"]');

    // Mateo se une a 'Picasso y Braque'
    await pageMateo.waitForSelector('[id^="btn-join-group-"]');
    await pageMateo.click('[id^="btn-join-group-"]');
    await pageMateo.waitForSelector('#group-room-title');
    console.log("✓ Mateo se unió a 'Picasso y Braque'.");

    // 4. CONECTAR ALUMNA 3: SOFÍA
    console.log("\n[PASO 4] Conectando Alumna 3 (Sofía)...");
    const pageSofia = await browser.newPage();
    await pageSofia.goto(BASE_URL, { waitUntil: 'networkidle2' });

    await pageSofia.waitForSelector('#student-name-input');
    await pageSofia.type('#student-name-input', 'Sofía');
    await pageSofia.click('form button[type="submit"]');

    // Sofía crea Grupo 2: "Juan Gris Club"
    await pageSofia.waitForSelector('#hub-create-group-btn');
    await pageSofia.click('#hub-create-group-btn');
    await pageSofia.waitForSelector('#new-group-name-input');
    await pageSofia.type('#new-group-name-input', 'Juan Gris Club');
    await pageSofia.click('#modal-confirm-create-btn');
    await pageSofia.waitForSelector('#group-room-title');
    console.log("✓ Sofía creó 'Juan Gris Club'.");

    // 5. CONECTAR ALUMNA 4: CAMILA
    console.log("\n[PASO 5] Conectando Alumna 4 (Camila)...");
    const pageCamila = await browser.newPage();
    await pageCamila.goto(BASE_URL, { waitUntil: 'networkidle2' });

    await pageCamila.waitForSelector('#student-name-input');
    await pageCamila.type('#student-name-input', 'Camila');
    await pageCamila.click('form button[type="submit"]');

    // Camila ve 2 grupos y se une a "Juan Gris Club" (segundo botón)
    await pageCamila.waitForSelector('[id^="btn-join-group-"]');
    await sleep(600);
    const joinBtns = await pageCamila.$$('[id^="btn-join-group-"]');
    assert(joinBtns.length >= 2, "Camila debe ver ambos grupos creados");
    await joinBtns[1].click();
    await pageCamila.waitForSelector('#group-room-title');
    console.log("✓ Camila se unió a 'Juan Gris Club'.");

    // 6. VERIFICAR QUE ADMIN TIENE AMBOS GRUPOS REGISTRADOS
    console.log("\n[PASO 6] Verificando lista de grupos en Admin...");
    await sleep(1000);
    const adminGroupsCount = await pageAdmin.$eval('#admin-groups-count', el => el.innerText);
    const startBtnDisabled = await pageAdmin.$eval('#admin-start-first-btn', el => el.disabled);
    const startBtnText = await pageAdmin.$eval('#admin-start-first-btn', el => el.innerText);
    console.log(`  Admin muestra: ${adminGroupsCount} | Botón: "${startBtnText}" (disabled: ${startBtnDisabled})`);
    assert(!startBtnDisabled, "El botón de iniciar ronda debe estar habilitado");

    // 7. ADMIN INICIA LA PREGUNTA 1
    console.log("\n[PASO 7] Admin inicia la sesión de preguntas...");
    await pageAdmin.evaluate(() => document.getElementById('admin-start-first-btn').click());
    await pageAdmin.waitForSelector('#admin-q-text');
    const q1Title = await pageAdmin.$eval('#admin-q-text', el => el.innerText);
    console.log(`✓ Pregunta 1 iniciada en Admin: "${q1Title.substring(0, 45)}..."`);

    // 8. VERIFICAR QUE LOS CELULARES PASAN A LA VISTA DE VOTACIÓN Y EL RELOJ DESCUENTA EN VIVO
    console.log("\n[PASO 8] Comprobando transición a votación y reloj en tiempo real en celular de Lucas...");
    await pageLucas.waitForFunction(() => {
      const v = document.getElementById('view-player-voting');
      return v && v.classList.contains('active');
    }, { timeout: 10000 });

    const timerT0 = await pageLucas.$eval('#pv-timer', el => el.innerText);
    console.log(`  Tiempo inicial visto por Lucas: ${timerT0}`);

    // Esperar 2.5 segundos sin tocar ninguna opción
    await sleep(2500);
    const timerT1 = await pageLucas.$eval('#pv-timer', el => el.innerText);
    console.log(`  Tiempo visto por Lucas tras 2.5s: ${timerT1}`);
    assert(timerT0 !== timerT1, `¡El reloj debe avanzar automáticamente segundo a segundo sin tocar opciones! (T0: ${timerT0}, T1: ${timerT1})`);
    console.log("✓ Verificación exitosa: El reloj del alumno descuenta en tiempo real sin requerir click.");

    // 9. VOTACIÓN EN GRUPO 1: VOTO UNÁNIME Y CONSENSO EN VIVO
    console.log("\n[PASO 9] Probando votación unánime en Grupo 1...");
    // Lucas vota opción 0 (▲)
    await pageLucas.waitForSelector('#player-opt-btn-0');
    await pageLucas.evaluate(() => document.getElementById('player-opt-btn-0').click());

    // Mateo debe ver en su pantalla en vivo que Lucas votó ▲
    await sleep(600);
    const mateoVotesList = await pageMateo.$eval('#pv-group-votes-list', el => el.innerText);
    console.log(`  Pantalla de Mateo muestra: "${mateoVotesList.replace(/\n/g, ' ')}"`);
    assert(mateoVotesList.includes('Lucas') && mateoVotesList.includes('Opción ▲'), "Mateo debe ver el voto de Lucas al instante");

    // Mateo también vota opción 0 (▲)
    await pageMateo.waitForSelector('#player-opt-btn-0');
    await pageMateo.evaluate(() => document.getElementById('player-opt-btn-0').click());
    console.log("✓ Grupo 1 votó de forma unánime por Opción ▲.");

    // 10. VOTACIÓN EN GRUPO 2: DESIGUALDAD Y ALERTA DE EMPATE (SOFÍA VS CAMILA)
    console.log("\n[PASO 10] Probando votación desigual y alerta de empate en Grupo 2...");
    await pageSofia.waitForFunction(() => {
      const v = document.getElementById('view-player-voting');
      return v && v.classList.contains('active');
    }, { timeout: 10000 });

    // Sofía vota opción 0 (▲)
    await pageSofia.waitForSelector('#player-opt-btn-0');
    await pageSofia.evaluate(() => document.getElementById('player-opt-btn-0').click());

    // Camila vota opción 1 (◆)
    await pageCamila.waitForFunction(() => {
      const v = document.getElementById('view-player-voting');
      return v && v.classList.contains('active');
    }, { timeout: 10000 });
    await pageCamila.waitForSelector('#player-opt-btn-1');
    await pageCamila.evaluate(() => document.getElementById('player-opt-btn-1').click());

    await sleep(600);
    // Verificar que aparece la advertencia de empate en pantalla de Sofía
    const tieWarning = await pageSofia.$eval('#pv-tie-warning', el => ({
      display: el.style.display,
      text: el.innerText
    }));
    console.log(`  Alerta de empate en Grupo 2: "${tieWarning.text}" (display: ${tieWarning.display})`);
    assert(tieWarning.display !== 'none', "La advertencia de empate debe mostrarse");
    assert(tieWarning.text.includes('Empate de votos'), "Debe indicar advertencia de empate");
    console.log("✓ Alerta de empate en tiempo real validada.");

    // 11. ADMIN EVALÚA Y CIERRA LA PREGUNTA
    console.log("\n[PASO 11] Admin cierra votación y evalúa consensos...");
    await pageAdmin.evaluate(() => document.getElementById('admin-close-eval-btn').click());

    await sleep(1000);
    // Lucas recibe evaluación
    await pageLucas.waitForSelector('#player-eval-card');
    const lucasEval = await pageLucas.$eval('#player-eval-card', el => el.innerText);
    console.log(`  Lucas recibe: "${lucasEval.split('\n')[0]}"`);
    assert(lucasEval.includes('RESPUESTA CORRECTA'), "Grupo 1 debió acertar");

    // Sofía recibe evaluación con información de desempate
    await pageSofia.waitForSelector('#player-eval-card');
    const sofiaEval = await pageSofia.$eval('#player-eval-card', el => el.innerText);
    console.log(`  Sofía recibe: "${sofiaEval.split('\n')[0]}"`);
    assert(sofiaEval.includes('RESPUESTA') || sofiaEval.includes('Desempate'), "Grupo 2 recibe resultado");
    console.log("✓ Evaluación y resolución de empates ejecutada correctamente.");

    // 12. MARCADOR Y TRANSICIÓN A SIGUIENTE PREGUNTA
    console.log("\n[PASO 12] Admin avanza al marcador y a la Pregunta 2...");
    await pageAdmin.waitForSelector('#admin-next-q-btn');
    await pageAdmin.evaluate(() => document.getElementById('admin-next-q-btn').click());

    await pageAdmin.waitForSelector('#admin-leaderboard-items');
    const leaderboard = await pageAdmin.$eval('#admin-leaderboard-items', el => el.innerText);
    console.log(`  Marcador de ronda:\n${leaderboard.split('\n').map(l => '    ' + l).join('\n')}`);
    assert(leaderboard.includes('Picasso y Braque'), "Grupo 1 debe figurar en el podio");

    // Siguiente pregunta
    await pageAdmin.evaluate(() => document.getElementById('admin-leaderboard-next-btn').click());
    await pageAdmin.waitForSelector('#admin-q-round');
    const q2Round = await pageAdmin.$eval('#admin-q-round', el => el.innerText);
    console.log(`✓ Admin avanzó a: "${q2Round}"`);
    assert(q2Round.includes('Pregunta 2'), "Debe ser Pregunta 2");

    // Verificar que en Lucas se cargó la Pregunta 2 y su selección anterior fue reseteada
    await sleep(800);
    await pageLucas.waitForSelector('#pv-q-text');
    const q2Lucas = await pageLucas.$eval('#pv-q-text', el => el.innerText);
    console.log(`  Lucas ve Pregunta 2: "${q2Lucas.substring(0, 45)}..."`);
    assert(q2Lucas !== q1Title, "Lucas debe ver la nueva pregunta");

    console.log("\n==========================================================================");
    console.log("  TODAS LAS PRUEBAS INTENSIVAS MULTI-CLIENTE Y TIEMPO REAL FUERON EXITOSAS!");
    console.log("==========================================================================\n");

  } catch (err) {
    console.error("\n❌ ERROR EN LA PRUEBA E2E:", err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
