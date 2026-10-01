/**
 * test_elimination_alliance.js
 * Tests the complete elimination and Alliance Mode (Modo Alianza) lifecycle:
 * 1. An eliminated group transitions to 'view-player-ghost-mode'.
 * 2. Selects an active ally group.
 * 3. Tests unanimous vote -> Ally group receives glowing 'Pista Aliada' badge.
 * 4. Tests discrepant vote -> Hint turns off immediately.
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
    console.log("Iniciando test de Modo Alianza y Eliminación...");
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      protocolTimeout: 60000,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 1. ADMIN
    console.log("\n[TEST ALIANZA - 1] Abriendo Admin...");
    const pageAdmin = await browser.newPage();
    await pageAdmin.goto(`${BASE_URL}#admin`, { waitUntil: 'networkidle2' });

    // 2. GRUPO 1: VIVO (Lucas)
    console.log("[TEST ALIANZA - 2] Conectando Lucas (Grupo Vivo)...");
    const pageLucas = await browser.newPage();
    await pageLucas.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await pageLucas.type('#student-name-input', 'Lucas');
    await pageLucas.click('form button[type="submit"]');
    await pageLucas.waitForSelector('#hub-create-group-btn');
    await pageLucas.click('#hub-create-group-btn');
    await pageLucas.type('#new-group-name-input', 'Equipo Vivo');
    await pageLucas.click('#modal-confirm-create-btn');

    // 3. GRUPO 2: ELIMINADO (Fantasma 1 y Fantasma 2)
    console.log("[TEST ALIANZA - 3] Conectando Fantasma 1 (Grupo que será eliminado)...");
    const pageGhost1 = await browser.newPage();
    await pageGhost1.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await pageGhost1.type('#student-name-input', 'Fantasma1');
    await pageGhost1.click('form button[type="submit"]');
    await pageGhost1.waitForSelector('#hub-create-group-btn');
    await pageGhost1.click('#hub-create-group-btn');
    await pageGhost1.type('#new-group-name-input', 'Equipo Fantasma');
    await pageGhost1.click('#modal-confirm-create-btn');

    console.log("[TEST ALIANZA - 4] Conectando Fantasma 2...");
    const pageGhost2 = await browser.newPage();
    await pageGhost2.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await pageGhost2.type('#student-name-input', 'Fantasma2');
    await pageGhost2.click('form button[type="submit"]');
    await pageGhost2.waitForSelector('[id^="btn-join-group-"]');
    await sleep(600);
    const joinBtns = await pageGhost2.$$('[id^="btn-join-group-"]');
    // Unirse a Equipo Fantasma (segundo grupo)
    await joinBtns[1].click();

    await sleep(1000);
    // Simular que Grupo 2 pierde sus vidas y queda eliminado
    console.log("[TEST ALIANZA - 5] Marcando Equipo Fantasma como eliminado...");
    await pageAdmin.evaluate(() => {
      const groups = Object.values(window.adminController.groups);
      const deadG = groups.find(g => g.name === 'Equipo Fantasma');
      if (deadG) {
        deadG.lives = 0;
        deadG.eliminated = true;
      }
      window.adminController.broadcastSync();
    });

    // Iniciar pregunta
    console.log("[TEST ALIANZA - 6] Iniciando pregunta con un grupo vivo y un grupo eliminado...");
    await pageAdmin.evaluate(() => window.adminController.startQuestionSession());

    await sleep(1200);

    // Verificar que Lucas (grupo vivo) ve la pantalla de votación normal
    await pageLucas.waitForSelector('#pv-q-text');
    const isLucasVoting = await pageLucas.$eval('#view-player-voting', el => el.classList.contains('active'));
    assert(isLucasVoting, "Lucas debe estar en pantalla de votación activa");
    console.log("✓ Lucas está en pantalla de votación normal.");

    // Verificar que Fantasmas están en pantalla de MODO ALIANZA (#view-player-ghost-mode)
    const isGhost1InAlliance = await pageGhost1.$eval('#view-player-ghost-mode', el => el.classList.contains('active'));
    const isGhost2InAlliance = await pageGhost2.$eval('#view-player-ghost-mode', el => el.classList.contains('active'));
    assert(isGhost1InAlliance && isGhost2InAlliance, "Ambos integrantes del grupo eliminado deben estar en Modo Alianza");
    console.log("✓ Los integrantes del grupo eliminado están en Modo Alianza.");

    // Verificar que el reloj de Modo Alianza (#pv-ghost-timer) descuenta en tiempo real
    const ghostTimerT0 = await pageGhost1.$eval('#pv-ghost-timer', el => el.innerText);
    await sleep(2200);
    const ghostTimerT1 = await pageGhost1.$eval('#pv-ghost-timer', el => el.innerText);
    assert(ghostTimerT0 !== ghostTimerT1, "El reloj de modo alianza debe descontar en tiempo real");
    console.log(`✓ Reloj de Modo Alianza descuenta en tiempo real (${ghostTimerT0} -> ${ghostTimerT1}).`);

    // Seleccionar como grupo aliado a 'Equipo Vivo'
    console.log("[TEST ALIANZA - 7] Seleccionando 'Equipo Vivo' como aliado...");
    await pageGhost1.evaluate(() => {
      const select = document.getElementById('ghost-target-select');
      if (select && select.options.length > 1) {
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change'));
      }
    });

    await sleep(600);

    // CASO A: Voto NO unánime de los fantasmas (Fantasma 1 vota 2, Fantasma 2 vota 3)
    console.log("[TEST ALIANZA - 8] Probando voto divergente entre fantasmas...");
    await pageGhost1.evaluate(() => window.playerController.castGhostVote(2));
    await pageGhost2.evaluate(() => window.playerController.castGhostVote(3));

    await sleep(800);
    // En la pantalla de Lucas NO debe haber pista aliada visible
    const hintBadgeNonUnanimous = await pageLucas.$eval('#player-opt-hint-2', el => el.style.display);
    assert(hintBadgeNonUnanimous === 'none' || !hintBadgeNonUnanimous, "No debe haber pista si los votos son divergentes");
    console.log("✓ Sin unanimidad: No se transmite pista al equipo aliado.");

    // CASO B: Voto UNÁNIME de los fantasmas (ambos votan opción 2 - ●)
    console.log("[TEST ALIANZA - 9] Probando voto UNÁNIME entre fantasmas...");
    await pageGhost2.evaluate(() => window.playerController.castGhostVote(2));

    await sleep(1000);
    // En la pantalla de Lucas DEBE aparecer la pista aliada en la opción 2
    const hintBadgeUnanimous = await pageLucas.$eval('#player-opt-hint-2', el => el.style.display);
    console.log(`  Pista en pantalla de Lucas: display = "${hintBadgeUnanimous}"`);
    assert(hintBadgeUnanimous === 'inline-block', "La pista aliada DEBE ser visible para el equipo aliado cuando hay unanimidad");
    console.log("✓ Con unanimidad: La 'Pista Aliada' se ilumina perfectamente en la pantalla del equipo aliado.");

    console.log("\n=======================================================");
    console.log("  TEST DE MODO ALIANZA Y ELIMINACIÓN PASÓ AL 100%!");
    console.log("=======================================================\n");

  } catch (err) {
    console.error("❌ ERROR EN TEST ALIANZA:", err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
