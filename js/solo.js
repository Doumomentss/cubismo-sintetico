/**
 * solo.js - Modo de respaldo en una sola pantalla / Proyector sin depender de internet
 * Permite al expositor gestionar grupos, vidas y respuestas desde la misma computadora
 */

class SoloController {
  constructor() {
    this.teams = [];
    this.currentRound = 1;
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;
    this.timerInterval = null;
    this.timeLeft = 20;
  }

  init() {
    this.renderDefaultTeams();
  }

  renderDefaultTeams() {
    const list = document.getElementById('solo-teams-list');
    if (!list) return;
    list.innerHTML = '';

    // Inicializar 4 grupos por defecto
    this.teams = [
      { id: 1, name: "Grupo 1: Los Juan Gris", icon: "📐", score: 0, lives: 3, eliminated: false },
      { id: 2, name: "Grupo 2: Papier Collé", icon: "✂️", score: 0, lives: 3, eliminated: false },
      { id: 3, name: "Grupo 3: Los Picassianos", icon: "🎨", score: 0, lives: 3, eliminated: false },
      { id: 4, name: "Grupo 4: Guitarras Sintéticas", icon: "🎸", score: 0, lives: 3, eliminated: false }
    ];

    this.teams.forEach(t => {
      const row = document.createElement('div');
      row.className = 'team-badge';
      row.style.justifyContent = 'space-between';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.8rem;">
          <span style="font-size:1.8rem;">${t.icon}</span>
          <input type="text" class="form-input" value="${t.name}" style="padding:0.4rem 0.8rem; width:220px;" onchange="soloController.updateTeamName(${t.id}, this.value)">
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span id="solo-lives-${t.id}">❤️❤️❤️</span>
        </div>
      `;
      list.appendChild(row);
    });
  }

  updateTeamName(id, newName) {
    const t = this.teams.find(item => item.id === id);
    if (t) t.name = newName;
  }

  startSoloGame() {
    window.soundFX.playClick();
    this.currentRound = 1;
    this.currentQuestionIndex = 0;
    this.showSoloQuestion();
  }

  showSoloQuestion() {
    const questions = this.currentRound === 1 ? GAME_DATA.ronda1 : GAME_DATA.ronda2;

    if (this.currentQuestionIndex >= questions.length) {
      if (this.currentRound === 1) {
        this.showSoloElimination();
      } else {
        this.showSoloPodium();
      }
      return;
    }

    this.currentQuestion = questions[this.currentQuestionIndex];
    window.app.switchView('view-solo-game');

    // UI
    document.getElementById('solo-q-round').innerText = `Ronda ${this.currentRound} • Pregunta ${this.currentQuestionIndex + 1} de ${questions.length}`;
    document.getElementById('solo-q-theme').innerText = this.currentQuestion.tema || this.currentQuestion.titulo || "Cubismo Sintético";
    document.getElementById('solo-q-text').innerText = this.currentQuestion.pregunta || this.currentQuestion.afirmacion;

    const optGrid = document.getElementById('solo-options-grid');
    optGrid.innerHTML = '';
    const shapes = ['▲', '◆', '●', '■'];
    const options = this.currentQuestion.opciones || (this.currentQuestion.esVerdadero !== undefined ? ["Verdadero", "Falso"] : []);

    options.forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = `option-card opt-${idx}`;
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="opt-shape">${shapes[idx] || (idx + 1)}</div>
        <div class="opt-label">${opt}</div>
      `;
      card.onclick = () => this.revealSoloAnswer(idx);
      optGrid.appendChild(card);
    });

    // Renderizar selector de qué grupo responde
    this.renderSoloTeamTurnSelector();

    // Ocultar explicacion y siguiente
    document.getElementById('solo-explanation').classList.remove('show');
    document.getElementById('solo-next-btn').style.display = 'none';

    this.startSoloTimer(20);
  }

  renderSoloTeamTurnSelector() {
    const container = document.getElementById('solo-team-turn-container');
    if (!container) return;
    container.innerHTML = `
      <div style="margin-bottom:1rem; font-weight:bold; color:var(--cubist-ochre);">
        Selecciona qué grupo levantó la mano o responde:
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:0.8rem; justify-content:center;">
        ${this.teams.filter(t => !t.eliminated).map(t => `
          <button class="btn-primary" style="padding:0.5rem 1rem; font-size:0.9rem;" onclick="soloController.setTurnTeam(${t.id}, this)">
            ${t.icon} ${t.name} (${t.score} pts)
          </button>
        `).join('')}
      </div>
    `;
    this.activeTurnTeamId = null;
  }

  setTurnTeam(teamId, btnEl) {
    this.activeTurnTeamId = teamId;
    document.querySelectorAll('#solo-team-turn-container button').forEach(b => b.style.outline = 'none');
    btnEl.style.outline = '3px solid white';
  }

  startSoloTimer(seconds) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timeLeft = seconds;
    const timerEl = document.getElementById('solo-timer');

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (timerEl) {
        timerEl.innerText = this.timeLeft;
        if (this.timeLeft <= 5) timerEl.classList.add('urgent');
        else timerEl.classList.remove('urgent');
      }

      if (this.timeLeft <= 5 && this.timeLeft > 0) window.soundFX.playUrgentTick();
      else if (this.timeLeft > 5) window.soundFX.playTick();

      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        this.revealSoloAnswer(-1); // Tiempo agotado
      }
    }, 1000);
  }

  revealSoloAnswer(selectedIdx) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    let correctIdx = 0;
    if (this.currentQuestion.correcta !== undefined) {
      correctIdx = this.currentQuestion.correcta;
    } else if (this.currentQuestion.esVerdadero !== undefined) {
      correctIdx = this.currentQuestion.esVerdadero ? 0 : 1;
    }

    const optGrid = document.getElementById('solo-options-grid');
    Array.from(optGrid.children).forEach((el, idx) => {
      if (idx === correctIdx) {
        el.classList.add('correct-highlight');
      } else {
        el.classList.add('dimmed');
      }
    });

    const isCorrect = selectedIdx === correctIdx;
    if (isCorrect) {
      window.soundFX.playCorrect();
    } else {
      window.soundFX.playWrong();
    }

    // Si había un grupo activo, sumarle puntos o restarle vida
    if (this.activeTurnTeamId) {
      const t = this.teams.find(item => item.id === this.activeTurnTeamId);
      if (t) {
        if (isCorrect) {
          t.score += 1000 + (this.timeLeft * 25);
        } else {
          t.lives = Math.max(0, t.lives - 1);
        }
      }
    }

    // Explicación
    const expCard = document.getElementById('solo-explanation');
    const expText = document.getElementById('solo-explanation-text');
    if (expCard && expText) {
      expText.innerText = this.currentQuestion.explicacion;
      expCard.classList.add('show');
    }

    const nextBtn = document.getElementById('solo-next-btn');
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.onclick = () => {
        this.currentQuestionIndex++;
        this.showSoloQuestion();
      };
    }
  }

  showSoloElimination() {
    window.app.switchView('view-host-elimination');
    window.soundFX.playWrong();

    const sorted = [...this.teams].sort((a, b) => b.score - a.score);
    let cutoff = Math.max(2, Math.ceil(sorted.length / 2));

    sorted.forEach((t, idx) => {
      if (idx >= cutoff || t.lives <= 0) {
        t.eliminated = true;
      }
    });

    const container = document.getElementById('elimination-summary');
    container.innerHTML = `
      <div style="text-align:center; margin-bottom: 2rem;">
        <h2 style="font-family:var(--font-display); font-size:2.2rem; color:var(--cubist-terracotta);">
          ⚠️ RONDA DE ELIMINACIÓN DE GRUPOS
        </h2>
        <p style="color:var(--text-secondary);">
          Los 2 mejores grupos avanzan al Duelo Final.
        </p>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
        <div style="background:rgba(34,197,94,0.1); border:2px solid #22c55e; border-radius:var(--radius-md); padding:1.5rem;">
          <h3 style="color:#22c55e; margin-bottom:1rem;">✅ Clasificados a la Gran Final</h3>
          ${sorted.filter(t => !t.eliminated).map(t => `
            <div class="team-badge" style="border-color:#22c55e; margin-bottom:0.8rem;">
              <div class="team-icon">${t.icon}</div>
              <div class="team-info"><h4>${t.name}</h4><p>${t.score} pts</p></div>
            </div>
          `).join('')}
        </div>
        <div style="background:rgba(239,68,68,0.1); border:2px solid #ef4444; border-radius:var(--radius-md); padding:1.5rem;">
          <h3 style="color:#ef4444; margin-bottom:1rem;">❌ Grupos Eliminados</h3>
          ${sorted.filter(t => t.eliminated).map(t => `
            <div class="team-badge eliminated" style="margin-bottom:0.8rem;">
              <div class="team-icon">${t.icon}</div>
              <div class="team-info"><h4>${t.name}</h4><p>${t.score} pts</p></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const finalBtn = document.getElementById('start-final-btn');
    if (finalBtn) {
      finalBtn.onclick = () => {
        this.currentRound = 2;
        this.currentQuestionIndex = 0;
        this.showSoloQuestion();
      };
    }
  }

  showSoloPodium() {
    window.app.switchView('view-host-podium');
    window.soundFX.playFanfare();

    const sorted = [...this.teams].sort((a, b) => b.score - a.score);
    const p1 = sorted[0];
    const p2 = sorted[1];
    const p3 = sorted[2];

    const p1El = document.getElementById('podium-1');
    const p2El = document.getElementById('podium-2');
    const p3El = document.getElementById('podium-3');

    if (p1 && p1El) {
      p1El.innerHTML = `
        <div class="podium-team-name">${p1.icon}<br><strong>${p1.name}</strong><br><span style="color:var(--cubist-ochre);">${p1.score} pts</span></div>
        <div class="podium-block">1° 👑</div>
      `;
    }
    if (p2 && p2El) {
      p2El.innerHTML = `
        <div class="podium-team-name">${p2.icon}<br><strong>${p2.name}</strong><br><span>${p2.score} pts</span></div>
        <div class="podium-block">2° 🥈</div>
      `;
    }
    if (p3 && p3El) {
      p3El.innerHTML = `
        <div class="podium-team-name">${p3.icon}<br><strong>${p3.name}</strong><br><span>${p3.score} pts</span></div>
        <div class="podium-block">3° 🥉</div>
      `;
    }

    window.hostController.launchConfetti();
  }
}

window.soloController = new SoloController();
