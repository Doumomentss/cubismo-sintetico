/**
 * host.js - Controlador del MODO ADMIN / PROYECTOR SECRETO (#admin)
 * Maneja el tiempo de 3 minutos, el estado de los grupos, consensos y la ayuda de muertos.
 */

class AdminController {
  constructor() {
    this.groups = {}; // { [id]: { id, name, leaderId, leaderName, members: [{id, name}], score, lives, eliminated, targetAllyId } }
    this.currentRound = 1;
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;
    this.timeLeft = 180; // 3 minutos
    this.isTimerRunning = false;
    this.timerInterval = null;
    this.isQuestionActive = false;
    
    // Votos en tiempo real: { [groupId]: { [memberId]: { memberName, optionIndex } } }
    this.groupVotes = {};
    
    // Votos de muertos: { [deadGroupId]: { targetGroupId, votes: { [memberId]: optionIndex } } }
    this.deadVotes = {};

    this.lastTiedDecisions = {}; // Guarda qué grupos tuvieron empate y cuál salió en la ruleta
  }

  init() {
    console.log("Iniciando Modo Admin Secreto...");
    window.gameNetwork.init('admin');

    // Escuchar eventos de alumnos
    window.gameNetwork.on('create_group', (data) => this.handleCreateGroup(data));
    window.gameNetwork.on('join_group', (data) => this.handleJoinGroup(data));
    window.gameNetwork.on('leave_group', (data) => this.handleLeaveGroup(data));
    window.gameNetwork.on('cast_vote', (data) => this.handleCastVote(data));
    window.gameNetwork.on('set_dead_target', (data) => this.handleSetDeadTarget(data));
    window.gameNetwork.on('cast_dead_vote', (data) => this.handleCastDeadVote(data));
    window.gameNetwork.on('announce_groups', (data) => {
      if (data && data.groups) {
        Object.assign(this.groups, data.groups);
        this.saveState();
        this.renderAdminLobby();
        if (this.isQuestionActive) this.renderAdminQuestionStatus();
      }
    });
    window.gameNetwork.on('req_sync', () => this.broadcastSync());

    // Solicitar anuncio de grupos creados previamente
    window.gameNetwork.send('req_groups_announce', {});
    setTimeout(() => window.gameNetwork.send('req_groups_announce', {}), 1500);

    // Cargar grupos desde localStorage por si recarga la página
    const saved = localStorage.getItem('cubismo_classroom_groups') || localStorage.getItem('cubismo_admin_groups');
    if (saved) {
      try { this.groups = JSON.parse(saved); } catch (e) {}
    }

    // Escuchar cambios de localStorage en tiempo real (misma computadora)
    window.addEventListener('storage', (e) => {
      if (e.key === 'cubismo_classroom_groups' && e.newValue) {
        try {
          this.groups = JSON.parse(e.newValue);
          this.renderAdminLobby();
          if (this.isQuestionActive) this.renderAdminQuestionStatus();
        } catch (err) {}
      }
    });

    this.renderAdminLobby();
    this.broadcastSync();
  }

  saveState() {
    localStorage.setItem('cubismo_admin_groups', JSON.stringify(this.groups));
    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.groups));
  }

  broadcastSync() {
    window.gameNetwork.send('sync_state', {
      groups: this.groups,
      currentQuestionIndex: this.currentQuestionIndex,
      isQuestionActive: this.isQuestionActive,
      isTimerRunning: this.isTimerRunning,
      timeLeft: this.timeLeft,
      currentQuestion: this.currentQuestion,
      groupVotes: this.groupVotes,
      deadVotes: this.deadVotes
    });
  }

  // Creación de grupo por un alumno
  handleCreateGroup(data) {
    if (!data.groupId || !data.groupName) return;
    this.groups[data.groupId] = {
      id: data.groupId,
      name: data.groupName,
      leaderId: data.leaderId,
      leaderName: data.leaderName,
      members: [{ id: data.leaderId, name: data.leaderName }],
      score: 0,
      lives: 3,
      eliminated: false,
      targetAllyId: null
    };
    this.saveState();
    this.renderAdminLobby();
    this.broadcastSync();
  }

  handleJoinGroup(data) {
    const group = this.groups[data.groupId];
    if (!group) return;
    if (!group.members.some(m => m.id === data.memberId)) {
      group.members.push({ id: data.memberId, name: data.memberName });
    }
    this.saveState();
    this.renderAdminLobby();
    this.broadcastSync();
  }

  handleLeaveGroup(data) {
    const group = this.groups[data.groupId];
    if (!group) return;
    group.members = group.members.filter(m => m.id !== data.memberId);
    if (group.members.length === 0) {
      delete this.groups[data.groupId];
    } else if (group.leaderId === data.memberId) {
      group.leaderId = group.members[0].id;
      group.leaderName = group.members[0].name;
    }
    this.saveState();
    this.renderAdminLobby();
    this.broadcastSync();
  }

  // Eliminación de grupo por el Administrador
  deleteGroup(groupId) {
    const group = this.groups[groupId];
    if (!group) return;

    const ok = confirm(`¿Estás seguro de que deseas eliminar el grupo "${group.name}"?\nLos integrantes volverán a la lista de grupos para unirse a otro.`);
    if (!ok) return;

    window.soundFX.playClick();
    const groupName = group.name;

    delete this.groups[groupId];
    if (this.groupVotes[groupId]) delete this.groupVotes[groupId];
    if (this.deadVotes[groupId]) delete this.deadVotes[groupId];

    // Desvincular si algún grupo muerto lo tenía como objetivo
    for (const gid in this.groups) {
      if (this.groups[gid].targetAllyId === groupId) {
        this.groups[gid].targetAllyId = null;
      }
    }

    this.saveState();

    // Sincronizar en tiempo real con todos los dispositivos por la red
    window.gameNetwork.send('delete_group', { groupId, groupName });
    this.broadcastSync();

    this.renderAdminLobby();
    if (this.isQuestionActive) {
      this.renderAdminQuestionStatus();
    }
    if (window.app && window.app.showToast) {
      window.app.showToast(`Grupo "${groupName}" eliminado`);
    }
  }

  // Recepción de voto de un integrante vivo
  handleCastVote(data) {
    if (!this.isQuestionActive) return;
    const { groupId, memberId, memberName, optionIndex } = data;
    if (!this.groupVotes[groupId]) this.groupVotes[groupId] = {};
    
    this.groupVotes[groupId][memberId] = {
      memberName: memberName,
      optionIndex: optionIndex
    };

    this.renderAdminQuestionStatus();
    this.broadcastSync();
  }

  // Recepción de objetivo de ayuda para grupo muerto
  handleSetDeadTarget(data) {
    const { deadGroupId, targetGroupId } = data;
    if (this.groups[deadGroupId]) {
      this.groups[deadGroupId].targetAllyId = targetGroupId;
      if (!this.deadVotes[deadGroupId]) this.deadVotes[deadGroupId] = { targetGroupId, votes: {} };
      this.deadVotes[deadGroupId].targetGroupId = targetGroupId;
      this.saveState();
      this.broadcastSync();
    }
  }

  // Recepción de voto de ayuda desde el más allá
  handleCastDeadVote(data) {
    if (!this.isQuestionActive) return;
    const { deadGroupId, memberId, optionIndex } = data;
    if (!this.deadVotes[deadGroupId]) {
      this.deadVotes[deadGroupId] = { targetGroupId: null, votes: {} };
    }
    this.deadVotes[deadGroupId].votes[memberId] = optionIndex;
    this.broadcastSync();
  }

  // Render del Lobby de Control
  renderAdminLobby() {
    const container = document.getElementById('admin-groups-list');
    const countEl = document.getElementById('admin-groups-count');
    const startBtn = document.getElementById('admin-start-first-btn');

    const groupList = Object.values(this.groups);
    if (countEl) countEl.innerText = `${groupList.length} Grupos Creados`;
    if (startBtn) {
      startBtn.disabled = groupList.length === 0;
      startBtn.innerText = groupList.length === 0 
        ? "Esperando a que los alumnos creen grupos..." 
        : `Iniciar Ronda con ${groupList.length} Grupo(s)`;
    }

    if (!container) return;
    container.innerHTML = '';

    if (groupList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <p style="font-size: 1.05rem;">Los alumnos ingresan con su nombre desde sus dispositivos y crean o se unen a un grupo.</p>
        </div>
      `;
      return;
    }

    groupList.forEach(g => {
      const card = document.createElement('div');
      card.className = 'team-badge';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'flex-start';
      card.style.gap = '0.5rem';

      const memberNames = g.members.map(m => {
        const isL = m.id === g.leaderId ? '<span class="badge-tag" style="margin-right:4px; font-size:0.65rem;">Líder</span>' : '';
        return `${isL}${this.escapeHtml(m.name)}`;
      }).join(', ');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <h4 style="font-size:1.2rem; color:var(--cubist-ochre); margin:0;">${this.escapeHtml(g.name)}</h4>
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <span style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:0.2rem 0.6rem; border-radius:12px;">
              ${g.members.length} integrante(s)
            </span>
            <button class="btn-delete-group" id="btn-delete-group-${g.id}" title="Eliminar grupo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>
        <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.4; margin:0;">
          <strong>Integrantes:</strong> ${memberNames}
        </p>
      `;

      const deleteBtn = card.querySelector(`#btn-delete-group-${g.id}`);
      if (deleteBtn) {
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          this.deleteGroup(g.id);
        };
      }

      container.appendChild(card);
    });
  }

  // Iniciar la ronda de preguntas
  startQuestionSession() {
    window.soundFX.playClick();
    this.currentQuestionIndex = 0;
    this.startQuestion(0);
  }

  startQuestion(index) {
    const questions = this.currentRound === 1 ? GAME_DATA.ronda1 : GAME_DATA.ronda2;
    if (index >= questions.length) {
      if (this.currentRound === 1) {
        this.showAdminElimination();
      } else {
        this.showAdminPodium();
      }
      return;
    }

    this.currentQuestionIndex = index;
    this.currentQuestion = questions[index];
    this.isQuestionActive = true;
    this.groupVotes = {};
    this.deadVotes = {};
    this.timeLeft = 180; // 3 minutos
    this.isTimerRunning = true;

    // Cambiar a vista de juego del admin
    window.app.switchView('view-admin-game');

    // UI Admin
    document.getElementById('admin-q-round').innerText = `Ronda ${this.currentRound} • Pregunta ${index + 1} de ${questions.length}`;
    document.getElementById('admin-q-theme').innerText = this.currentQuestion.tema || this.currentQuestion.titulo || "Cubismo Sintético";
    document.getElementById('admin-q-text').innerText = this.currentQuestion.pregunta || this.currentQuestion.afirmacion;

    const optGrid = document.getElementById('admin-options-grid');
    optGrid.innerHTML = '';
    const shapes = ['▲', '◆', '●', '■'];
    const options = this.currentQuestion.opciones || (this.currentQuestion.esVerdadero !== undefined ? ["Verdadero", "Falso"] : []);

    options.forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = `option-card opt-${idx}`;
      card.id = `admin-opt-${idx}`;
      card.innerHTML = `
        <div class="opt-shape">${shapes[idx] || (idx + 1)}</div>
        <div class="opt-label">${this.escapeHtml(opt)}</div>
      `;
      optGrid.appendChild(card);
    });

    document.getElementById('admin-explanation').classList.remove('show');
    document.getElementById('admin-close-eval-btn').style.display = 'inline-flex';
    document.getElementById('admin-next-q-btn').style.display = 'none';

    this.renderAdminQuestionStatus();
    this.startTimer();
    this.broadcastSync();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (!this.isTimerRunning) return;
      this.timeLeft--;
      this.updateTimerDisplay();

      // Sincronizar periódicamente el reloj con todos los celulares cada 3 segundos
      if (this.timeLeft % 3 === 0) {
        this.broadcastSync();
      }

      if (this.timeLeft <= 10 && this.timeLeft > 0) {
        window.soundFX.playUrgentTick();
      } else if (this.timeLeft % 30 === 0 && this.timeLeft > 0) {
        window.soundFX.playTick();
      }

      if (this.timeLeft <= 0) {
        this.pauseTimer();
        const timerEl = document.getElementById('admin-timer');
        if (timerEl) timerEl.innerText = "0:00";
      }
    }, 1000);
  }

  togglePauseTimer() {
    this.isTimerRunning = !this.isTimerRunning;
    const btn = document.getElementById('admin-pause-timer-btn');
    if (btn) btn.innerText = this.isTimerRunning ? "Pausar" : "Reanudar";
    this.broadcastSync();
  }

  addTime(seconds) {
    this.timeLeft += seconds;
    this.updateTimerDisplay();
    this.broadcastSync();
  }

  pauseTimer() {
    this.isTimerRunning = false;
    const btn = document.getElementById('admin-pause-timer-btn');
    if (btn) btn.innerText = "Reanudar";
    this.broadcastSync();
  }

  updateTimerDisplay() {
    const mins = Math.floor(Math.max(0, this.timeLeft) / 60);
    const secs = Math.max(0, this.timeLeft) % 60;
    const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const timerEl = document.getElementById('admin-timer');
    if (timerEl) {
      timerEl.innerText = timeFormatted;
      if (this.timeLeft <= 30) timerEl.classList.add('urgent');
      else timerEl.classList.remove('urgent');
    }
  }

  // Render del estado de votación de los grupos en pantalla de Admin
  renderAdminQuestionStatus() {
    const container = document.getElementById('admin-teams-voting-status');
    const readyCounter = document.getElementById('admin-ready-count');
    if (!container) return;

    const aliveGroups = Object.values(this.groups).filter(g => !g.eliminated);
    let readyGroupsCount = 0;

    container.innerHTML = '';

    aliveGroups.forEach(g => {
      const votes = this.groupVotes[g.id] || {};
      const totalMembers = g.members.length;
      const votedMembers = Object.keys(votes).length;
      const isReady = votedMembers >= totalMembers && totalMembers > 0;
      if (isReady) readyGroupsCount++;

      // Desglose de votos
      const memberVoteBadges = g.members.map(m => {
        const v = votes[m.id];
        if (v !== undefined) {
          const shapes = ['▲', '◆', '●', '■'];
          return `<span style="background:rgba(255,255,255,0.15); padding:2px 6px; border-radius:4px; font-size:0.8rem;">
            ${this.escapeHtml(m.name)}: <strong>${shapes[v.optionIndex] || (v.optionIndex + 1)}</strong>
          </span>`;
        }
        return `<span style="opacity:0.4; font-size:0.8rem;">${this.escapeHtml(m.name)} (pensando...)</span>`;
      }).join(' ');

      const row = document.createElement('div');
      row.className = 'leaderboard-item';
      row.style.padding = '0.8rem 1.2rem';
      row.style.border = isReady ? '2px solid #22c55e' : '1px solid var(--border-glass)';

      row.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <strong style="color:var(--cubist-ochre); font-size:1.1rem;">${this.escapeHtml(g.name)}</strong>
              <button class="btn-delete-group" id="btn-del-game-${g.id}" title="Eliminar grupo" style="padding:0.2rem 0.5rem; font-size:0.7rem;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Eliminar</span>
              </button>
            </div>
            <span style="font-weight:bold; color:${isReady ? '#22c55e' : 'var(--text-muted)'}; font-size:0.85rem; letter-spacing:0.5px;">
              ${isReady ? 'LISTO' : `${votedMembers}/${totalMembers} votaron`}
            </span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
            ${memberVoteBadges}
          </div>
        </div>
      `;

      const delBtn = row.querySelector(`#btn-del-game-${g.id}`);
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          this.deleteGroup(g.id);
        };
      }

      container.appendChild(row);
    });

    if (readyCounter) {
      readyCounter.innerText = `${readyGroupsCount} de ${aliveGroups.length} grupos listos`;
    }
  }

  // CERRAR VOTACIÓN Y EVALUAR CONSENSOS / EMPATES
  closeQuestionAndEvaluate() {
    this.isQuestionActive = false;
    this.pauseTimer();
    window.soundFX.playCorrect();

    let correctIdx = 0;
    if (this.currentQuestion.correcta !== undefined) {
      correctIdx = this.currentQuestion.correcta;
    } else if (this.currentQuestion.esVerdadero !== undefined) {
      correctIdx = this.currentQuestion.esVerdadero ? 0 : 1;
    }

    // Iluminar la respuesta correcta en la pantalla del proyector
    const optionsGrid = document.getElementById('admin-options-grid');
    if (optionsGrid) {
      Array.from(optionsGrid.children).forEach((el, idx) => {
        if (idx === correctIdx) el.classList.add('correct-highlight');
        else el.classList.add('dimmed');
      });
    }

    // Mostrar explicación histórica
    const expCard = document.getElementById('admin-explanation');
    const expText = document.getElementById('admin-explanation-text');
    if (expCard && expText) {
      expText.innerText = this.currentQuestion.explicacion || "";
      expCard.classList.add('show');
    }

    // CÁLCULO DE RESPUESTAS POR GRUPO CON REGLA DE DESEMPATE
    const evaluationResults = {};
    this.lastTiedDecisions = {};

    Object.values(this.groups).forEach(g => {
      if (g.eliminated) return;

      const votes = this.groupVotes[g.id] || {};
      const voteCounts = {}; // { optionIndex: count }

      Object.values(votes).forEach(v => {
        voteCounts[v.optionIndex] = (voteCounts[v.optionIndex] || 0) + 1;
      });

      let chosenOption = null;
      let hadTie = false;
      let tiedOptions = [];

      const entries = Object.entries(voteCounts);
      if (entries.length > 0) {
        // Encontrar cantidad máxima de votos
        let maxVotes = 0;
        entries.forEach(([opt, count]) => {
          if (count > maxVotes) maxVotes = count;
        });

        // Opciones que tienen el máximo
        tiedOptions = entries.filter(([opt, count]) => count === maxVotes).map(([opt]) => parseInt(opt));

        if (tiedOptions.length === 1) {
          chosenOption = tiedOptions[0];
        } else {
          // Desigualdad / Empate: sorteo aleatorio entre las opciones más votadas
          hadTie = true;
          chosenOption = tiedOptions[Math.floor(Math.random() * tiedOptions.length)];
          this.lastTiedDecisions[g.id] = {
            tiedOptions: tiedOptions,
            chosenOption: chosenOption
          };
        }
      }

      const isCorrect = chosenOption === correctIdx;
      if (isCorrect) {
        g.score += 1000 + Math.round((this.timeLeft / 180) * 500);
      } else {
        g.lives = Math.max(0, g.lives - 1);
        if (g.lives === 0) g.eliminated = true;
      }

      evaluationResults[g.id] = {
        chosenOption: chosenOption,
        hadTie: hadTie,
        tiedOptions: tiedOptions,
        isCorrect: isCorrect,
        score: g.score,
        lives: g.lives,
        eliminated: g.eliminated
      };
    });

    this.saveState();

    // Notificar a todos los celulares de los alumnos
    window.gameNetwork.send('eval_result', {
      correctIndex: correctIdx,
      explanation: this.currentQuestion.explicacion,
      results: evaluationResults,
      tiedDecisions: this.lastTiedDecisions
    });

    // Mostrar botón de siguiente pregunta
    document.getElementById('admin-close-eval-btn').style.display = 'none';
    const nextBtn = document.getElementById('admin-next-q-btn');
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.innerText = "Ver Marcador de la Ronda ➔";
      nextBtn.onclick = () => this.showAdminLeaderboard();
    }
  }

  showAdminLeaderboard() {
    window.app.switchView('view-admin-leaderboard');
    window.soundFX.playClick();

    const listEl = document.getElementById('admin-leaderboard-items');
    if (!listEl) return;
    listEl.innerHTML = '';

    const sorted = Object.values(this.groups).sort((a, b) => b.score - a.score);

    sorted.forEach((g, idx) => {
      const item = document.createElement('div');
      item.className = `leaderboard-item ${idx === 0 ? 'rank-1' : ''} ${g.eliminated ? 'eliminated' : ''}`;
      
      const lifeDots = '<div class="life-bar">' + Array.from({length: 3}, (_, i) => 
        `<span class="life-dot ${i >= g.lives ? 'lost' : ''}"></span>`
      ).join('') + '</div>';

      let tieBadge = '';
      if (this.lastTiedDecisions[g.id]) {
        const d = this.lastTiedDecisions[g.id];
        const shapes = ['▲', '◆', '●', '■'];
        tieBadge = `<span style="font-size:0.75rem; color:#e5a93b; display:block;">Desempate al azar: opción ${shapes[d.chosenOption]}</span>`;
      }

      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:1rem;">
          <span style="font-weight:900; font-size:1.4rem; color:var(--cubist-ochre); width:35px;">#${idx + 1}</span>
          <div>
            <strong style="font-size:1.2rem;">${this.escapeHtml(g.name)}</strong>
            <div style="font-size:0.85rem; color:var(--text-muted); display:flex; align-items:center; gap:0.5rem; margin-top:2px;">
              <span>Vidas:</span> ${lifeDots} ${g.eliminated ? '<span style="color:#ef4444; margin-left:4px;">(Eliminado)</span>' : ''}
            </div>
            ${tieBadge}
          </div>
        </div>
        <div style="font-family:var(--font-display); font-size:1.5rem; font-weight:800; color:var(--cubist-kraft);">
          ${g.score.toLocaleString()} pts
        </div>
      `;
      listEl.appendChild(item);
    });

    const nextQBtn = document.getElementById('admin-leaderboard-next-btn');
    if (nextQBtn) {
      nextQBtn.onclick = () => {
        this.startQuestion(this.currentQuestionIndex + 1);
      };
    }
  }

  showAdminElimination() {
    window.app.switchView('view-admin-elimination');
    window.soundFX.playWrong();

    const sorted = Object.values(this.groups).sort((a, b) => b.score - a.score);
    const container = document.getElementById('admin-elimination-summary');
    if (!container) return;

    let cutoff = Math.max(2, Math.ceil(sorted.length / 2));
    if (sorted.length <= 2) cutoff = sorted.length;

    sorted.forEach((g, idx) => {
      if (idx >= cutoff || g.lives <= 0) {
        g.eliminated = true;
      }
    });

    this.saveState();

    const alive = sorted.filter(g => !g.eliminated);
    const dead = sorted.filter(g => g.eliminated);

    container.innerHTML = `
      <div style="text-align:center; margin-bottom: 2rem;">
        <h2 style="font-family:var(--font-display); font-size:2.2rem; color:var(--cubist-terracotta);">
          CORTE DE ELIMINACIÓN
        </h2>
        <p style="color:var(--text-secondary); font-size:1.05rem;">
          Los grupos eliminados pasan al <strong>Modo Alianza</strong> para transmitir sugerencias a sus equipos aliados en la Final.
        </p>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
        <div style="background:rgba(34,197,94,0.08); border:2px solid #22c55e; border-radius:var(--radius-md); padding:1.5rem;">
          <h3 style="color:#22c55e; margin-bottom:1rem; font-size:1.2rem;">Clasificados a la Gran Final (${alive.length})</h3>
          ${alive.map(g => `
            <div class="team-badge" style="border-color:#22c55e; margin-bottom:0.8rem;">
              <div class="team-info"><h4>${this.escapeHtml(g.name)}</h4><p>${g.score} pts • Vidas: ${g.lives}</p></div>
            </div>
          `).join('')}
        </div>

        <div style="background:rgba(239,68,68,0.08); border:2px solid #ef4444; border-radius:var(--radius-md); padding:1.5rem;">
          <h3 style="color:#ef4444; margin-bottom:1rem; font-size:1.2rem;">Grupos en Modo Alianza (${dead.length})</h3>
          ${dead.length === 0 ? '<p style="color:var(--text-muted);">Ningún grupo eliminado en esta fase.</p>' : dead.map(g => `
            <div class="team-badge eliminated" style="margin-bottom:0.8rem;">
              <div class="team-info"><h4>${this.escapeHtml(g.name)}</h4><p>${g.score} pts • Transmisión activa</p></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.broadcastSync();

    const startFinalBtn = document.getElementById('admin-start-final-btn');
    if (startFinalBtn) {
      startFinalBtn.onclick = () => {
        this.currentRound = 2;
        this.currentQuestionIndex = 0;
        this.startQuestion(0);
      };
    }
  }

  showAdminPodium() {
    window.app.switchView('view-admin-podium');
    window.soundFX.playFanfare();

    const sorted = Object.values(this.groups).sort((a, b) => b.score - a.score);
    const p1 = sorted[0];
    const p2 = sorted[1];
    const p3 = sorted[2];

    const p1El = document.getElementById('admin-podium-1');
    const p2El = document.getElementById('admin-podium-2');
    const p3El = document.getElementById('admin-podium-3');

    if (p1 && p1El) {
      p1El.innerHTML = `
        <div class="podium-team-name"><strong>${this.escapeHtml(p1.name)}</strong><br><span style="color:var(--cubist-ochre);">${p1.score.toLocaleString()} pts</span></div>
        <div class="podium-block">1°</div>
      `;
    }
    if (p2 && p2El) {
      p2El.innerHTML = `
        <div class="podium-team-name"><strong>${this.escapeHtml(p2.name)}</strong><br><span>${p2.score.toLocaleString()} pts</span></div>
        <div class="podium-block">2°</div>
      `;
    }
    if (p3 && p3El) {
      p3El.innerHTML = `
        <div class="podium-team-name"><strong>${this.escapeHtml(p3.name)}</strong><br><span>${p3.score.toLocaleString()} pts</span></div>
        <div class="podium-block">3°</div>
      `;
    }

    this.launchConfetti();
    this.broadcastSync();
  }

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#d35235', '#e5a93b', '#2c6e91', '#e8d8b8', '#ffffff'];

    for (let i = 0; i < 140; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: 10 + Math.random() * 15,
        h: 6 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * 360,
        speedY: 2 + Math.random() * 5,
        rotSpeed: (Math.random() - 0.5) * 5
      });
    }

    let animationId;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.speedY;
        p.angle += p.rotSpeed;
        if (p.y > canvas.height) p.y = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      animationId = requestAnimationFrame(render);
    }
    render();
    setTimeout(() => cancelAnimationFrame(animationId), 12000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

window.adminController = new AdminController();
