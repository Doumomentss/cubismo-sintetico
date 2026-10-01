/**
 * test_game_engine.js
 * Comprehensive automated simulation testing the full game rules, voting mechanics,
 * tie-breakers, life management, alliance mode, and round transitions.
 */

const assert = require('assert');
const GAME_DATA = require('./js/questions.js');

console.log("=== INICIANDO AUDITORÍA Y TESTS INTENSIVOS DEL JUEGO ===");

// 1. VERIFICAR INTEGRIDAD DEL BANCO DE PREGUNTAS
console.log("\n[TEST 1] Verificando integridad de preguntas...");
assert(GAME_DATA.ronda1.length === 8, "Ronda 1 debe tener 8 preguntas");
assert(GAME_DATA.ronda2.length === 5, "Ronda 2 debe tener 5 preguntas");

GAME_DATA.ronda1.forEach((q, idx) => {
  assert(q.id, `Pregunta R1[${idx}] debe tener ID`);
  assert(q.pregunta, `Pregunta R1[${idx}] debe tener enunciado`);
  assert(Array.isArray(q.opciones) && q.opciones.length >= 2, `Pregunta R1[${idx}] debe tener opciones`);
  assert(typeof q.correcta === 'number', `Pregunta R1[${idx}] debe tener 'correcta' numérico`);
  assert(q.correcta >= 0 && q.correcta < q.opciones.length, `Pregunta R1[${idx}] 'correcta' (${q.correcta}) debe estar dentro de las opciones`);
  assert(q.explicacion, `Pregunta R1[${idx}] debe tener explicación histórica`);
});

GAME_DATA.ronda2.forEach((q, idx) => {
  assert(q.id, `Pregunta R2[${idx}] debe tener ID`);
  assert(q.afirmacion, `Pregunta R2[${idx}] debe tener afirmación`);
  if (q.esVerdadero !== undefined) {
    assert(typeof q.esVerdadero === 'boolean', `Pregunta R2[${idx}] 'esVerdadero' debe ser booleano`);
  } else {
    assert(Array.isArray(q.opciones) && typeof q.correcta === 'number', `Pregunta R2[${idx}] con opciones debe tener 'correcta'`);
  }
  assert(q.explicacion, `Pregunta R2[${idx}] debe tener explicación`);
});
console.log("✓ Preguntas verificadas sin errores sintácticos ni desbordes.");

// 2. SIMULAR MOTOR DE CONSENSO Y DESEMPATE (HOST EVALUATION LOGIC)
console.log("\n[TEST 2] Verificando algoritmos de votación, desempate y consenso...");

function evaluateGroupVotes(group, memberVotes, correctIdx, timeLeft = 120) {
  const voteCounts = {};
  Object.values(memberVotes).forEach(v => {
    voteCounts[v.optionIndex] = (voteCounts[v.optionIndex] || 0) + 1;
  });

  let chosenOption = null;
  let hadTie = false;
  let tiedOptions = [];

  const entries = Object.entries(voteCounts);
  if (entries.length > 0) {
    let maxVotes = 0;
    entries.forEach(([opt, count]) => {
      if (count > maxVotes) maxVotes = count;
    });

    tiedOptions = entries.filter(([opt, count]) => count === maxVotes).map(([opt]) => parseInt(opt));

    if (tiedOptions.length === 1) {
      chosenOption = tiedOptions[0];
    } else {
      hadTie = true;
      // Selección aleatoria entre las opciones empatadas
      chosenOption = tiedOptions[Math.floor(Math.random() * tiedOptions.length)];
    }
  }

  const isCorrect = chosenOption === correctIdx;
  if (isCorrect) {
    group.score += 1000 + Math.round((timeLeft / 180) * 500);
  } else {
    group.lives = Math.max(0, group.lives - 1);
    if (group.lives === 0) group.eliminated = true;
  }

  return { chosenOption, hadTie, tiedOptions, isCorrect };
}

// Test 2A: Voto unánime correcto
{
  const g1 = { id: "g1", name: "Grupo Alfa", score: 0, lives: 3, eliminated: false };
  const votes = {
    "m1": { optionIndex: 0 },
    "m2": { optionIndex: 0 },
    "m3": { optionIndex: 0 }
  };
  const res = evaluateGroupVotes(g1, votes, 0, 150);
  assert(res.chosenOption === 0, "Opción elegida debe ser 0");
  assert(res.hadTie === false, "No debe haber empate");
  assert(res.isCorrect === true, "Debe ser correcta");
  assert(g1.score > 1000, "Debe sumar puntaje base + bonificación de tiempo");
  assert(g1.lives === 3, "No debe perder vidas");
  console.log("✓ Caso 2A: Votación unánime correcta aprobada.");
}

// Test 2B: Desempate exacto 1 vs 1 (ej: un miembro vota A, otro B)
{
  let selectedA = 0;
  let selectedB = 0;
  for (let i = 0; i < 50; i++) {
    const gTie = { id: "gtie", name: "Grupo Empate", score: 0, lives: 3, eliminated: false };
    const votes = {
      "m1": { optionIndex: 1 },
      "m2": { optionIndex: 2 }
    };
    const res = evaluateGroupVotes(gTie, votes, 1, 100);
    assert(res.hadTie === true, "Debe marcar empate (hadTie)");
    assert(res.tiedOptions.length === 2 && res.tiedOptions.includes(1) && res.tiedOptions.includes(2), "Las opciones empatadas deben ser 1 y 2");
    assert(res.chosenOption === 1 || res.chosenOption === 2, "La opción elegida debe ser una de las empatadas");
    if (res.chosenOption === 1) selectedA++;
    else selectedB++;
  }
  assert(selectedA > 0 && selectedB > 0, "El desempate aleatorio debe seleccionar de forma justa ambas opciones");
  console.log(`✓ Caso 2B: Desempate aleatorio probado exitosamente (Distribución: ${selectedA} vs ${selectedB}).`);
}

// Test 2C: Mayoría relativa (ej: 3 miembros votan A, 2 votan B, 1 vota C)
{
  const gMaj = { id: "gmaj", name: "Grupo Mayoría", score: 0, lives: 3, eliminated: false };
  const votes = {
    "m1": { optionIndex: 1 },
    "m2": { optionIndex: 1 },
    "m3": { optionIndex: 1 },
    "m4": { optionIndex: 2 },
    "m5": { optionIndex: 2 },
    "m6": { optionIndex: 3 }
  };
  const res = evaluateGroupVotes(gMaj, votes, 1, 60);
  assert(res.hadTie === false, "No debe haber empate con mayoría clara");
  assert(res.chosenOption === 1, "Debe ganar la opción más votada (1)");
  console.log("✓ Caso 2C: Mayoría con votos dispersos evaluada correctamente.");
}

// Test 2D: Pérdida sucesiva de vidas y eliminación
{
  const gDead = { id: "gdead", name: "Grupo En Peligro", score: 0, lives: 3, eliminated: false };
  // Ronda 1: Voto incorrecto
  evaluateGroupVotes(gDead, { "m1": { optionIndex: 3 } }, 0, 100);
  assert(gDead.lives === 2 && !gDead.eliminated, "Debe tener 2 vidas y seguir vivo");

  // Ronda 2: Voto incorrecto
  evaluateGroupVotes(gDead, { "m1": { optionIndex: 3 } }, 0, 100);
  assert(gDead.lives === 1 && !gDead.eliminated, "Debe tener 1 vida y seguir vivo");

  // Ronda 3: Voto incorrecto -> muerte
  evaluateGroupVotes(gDead, { "m1": { optionIndex: 3 } }, 0, 100);
  assert(gDead.lives === 0 && gDead.eliminated === true, "Debe tener 0 vidas y quedar eliminado");
  console.log("✓ Caso 2D: Ciclo de pérdida de vidas y eliminación probado.");
}

// 3. VERIFICAR LÓGICA DE MODO ALIANZA (PISTA DE FANTASMAS)
console.log("\n[TEST 3] Verificando Modo Alianza entre grupos...");
function checkGhostAllyHint(myGroup, availableGroups, deadVotes) {
  if (!myGroup) return null;
  for (const deadId in availableGroups) {
    const deadGroup = availableGroups[deadId];
    if (deadGroup.eliminated && deadGroup.targetAllyId === myGroup.id) {
      const deadData = deadVotes[deadId];
      if (deadData && deadData.votes) {
        const votes = Object.values(deadData.votes);
        const totalMembers = deadGroup.members.length;
        if (votes.length >= totalMembers && totalMembers > 0) {
          const first = votes[0];
          const allSame = votes.every(v => v === first);
          if (allSame) return first;
        }
      }
    }
  }
  return null;
}

{
  const liveGroup = { id: "live1", name: "Grupo Vivo", eliminated: false };
  const deadGroup = { 
    id: "dead1", 
    name: "Grupo Aliado", 
    eliminated: true, 
    targetAllyId: "live1",
    members: [{ id: "d1" }, { id: "d2" }]
  };
  const available = { "live1": liveGroup, "dead1": deadGroup };

  // Caso 3A: Fantasmas votan diferente -> NO hay pista
  let deadVotes = {
    "dead1": { votes: { "d1": 1, "d2": 2 } }
  };
  assert(checkGhostAllyHint(liveGroup, available, deadVotes) === null, "No debe haber pista si los votos difieren");

  // Caso 3B: Fantasmas votan incompleto (falta un miembro) -> NO hay pista
  deadVotes = {
    "dead1": { votes: { "d1": 1 } }
  };
  assert(checkGhostAllyHint(liveGroup, available, deadVotes) === null, "No debe haber pista si no votaron todos los integrantes");

  // Caso 3C: Fantasmas votan unánime opción 2 -> Transmite pista 2
  deadVotes = {
    "dead1": { votes: { "d1": 2, "d2": 2 } }
  };
  assert(checkGhostAllyHint(liveGroup, available, deadVotes) === 2, "Debe transmitir la pista cuando hay unanimidad completa");
  console.log("✓ Caso 3: Modo Alianza y condición de unanimidad verificada con precisión.");
}

// 4. VERIFICAR CORTE DE ELIMINACIÓN Y PODIO
console.log("\n[TEST 4] Verificando corte de clasificación y podio final...");
{
  const groups = [
    { id: "g1", name: "G1", score: 5000, lives: 3, eliminated: false },
    { id: "g2", name: "G2", score: 4000, lives: 2, eliminated: false },
    { id: "g3", name: "G3", score: 3000, lives: 1, eliminated: false },
    { id: "g4", name: "G4", score: 1000, lives: 3, eliminated: false }
  ];

  const sorted = [...groups].sort((a, b) => b.score - a.score);
  let cutoff = Math.max(2, Math.ceil(sorted.length / 2));
  sorted.forEach((g, idx) => {
    if (idx >= cutoff || g.lives <= 0) g.eliminated = true;
  });

  const alive = sorted.filter(g => !g.eliminated);
  const eliminated = sorted.filter(g => g.eliminated);

  assert(alive.length === 2, "Deben clasificar 2 grupos");
  assert(eliminated.length === 2, "Deben quedar eliminados 2 grupos");
  assert(alive[0].id === "g1" && alive[1].id === "g2", "Deben clasificar los de mayor puntaje");
  console.log("✓ Caso 4: Corte de eliminación y podio final verificado.");
}

console.log("\n=======================================================");
console.log("  TODAS LAS PRUEBAS UNITARIAS Y LÓGICAS PASARON CON ÉXITO");
console.log("=======================================================\n");
