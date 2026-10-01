/**
 * player.js - Experiencia del alumno en su celular
 * Ingreso con Nombre -> Creación y unión a grupos -> Votación con consenso interno -> Modo Alianza
 */

class PlayerController {
  constructor() {
    this.studentId = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cubismo_student_id')) || ('std_' + Math.random().toString(36).substring(2, 9));
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('cubismo_student_id', this.studentId);
    this.studentName = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cubismo_student_name')) || '';
    this.myGroup = null; // Grupo actual { id, name, leaderId, members, score, lives, eliminated, targetAllyId }
    this.myVote = null; // Opción votada por el alumno
    this.myGhostVote = null; // Voto en modo alianza
    this.availableGroups = {}; // Grupos sincronizados desde Admin/Red
    this.currentQuestion = null;
    this.isQuestionActive = false;
    this.groupVotes = {};
    this.deadVotes = {};
    
    // Temporizador local sincronizado en tiempo real
    this.timeLeft = 180;
    this.localTimerInterval = null;
  }

  init() {
    window.gameNetwork.init('player');

    // Recuperar datos previos si refresca la pantalla
    const savedName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cubismo_student_name') : null;
    if (savedName) {
      this.studentName = savedName;
      const input = document.getElementById('student-name-input');
      if (input) input.value = savedName;
    }

    // Cargar grupos almacenados previamente en memoria local
    const savedGroups = localStorage.getItem('cubismo_classroom_groups');
    if (savedGroups) {
      try {
        this.availableGroups = JSON.parse(savedGroups);
      } catch (e) {}
    }

    // 1. Escuchar sincronización periódica del Admin
    window.gameNetwork.on('sync_state', (data) => this.handleSyncState(data));
    window.gameNetwork.on('eval_result', (data) => this.handleEvalResult(data));

    // 2. Tiempo real entre alumnos: creación, unión o salida de grupo
    window.gameNetwork.on('create_group', (data) => this.handleRemoteGroupCreated(data));
    window.gameNetwork.on('join_group', (data) => this.handleRemoteGroupJoined(data));
    window.gameNetwork.on('leave_group', (data) => this.handleRemoteGroupLeft(data));
    window.gameNetwork.on('delete_group', (data) => this.handleRemoteGroupDeleted(data));
    window.gameNetwork.on('req_sync', () => this.handleReqSync());
    window.gameNetwork.on('req_groups_announce', () => {
      if (Object.keys(this.availableGroups).length > 0) {
        window.gameNetwork.send('announce_groups', { groups: this.availableGroups });
      }
    });

    // 3. Sincronización instantánea (0ms) entre pestañas de la misma computadora
    window.addEventListener('storage', (e) => {
      if (e.key === 'cubismo_classroom_groups') {
        try {
          this.availableGroups = e.newValue ? JSON.parse(e.newValue) : {};
          if (this.myGroup && !this.availableGroups[this.myGroup.id]) {
            this.myGroup = null;
            this.myVote = null;
            this.myGhostVote = null;
            this.stopLocalTimer();
            if (window.app.currentViewId !== 'view-landing') {
              window.app.switchView('view-groups-hub');
              this.renderGroupsList();
            }
          } else if (this.myGroup && this.availableGroups[this.myGroup.id]) {
            this.myGroup = this.availableGroups[this.myGroup.id];
          }
          if (window.app.currentViewId === 'view-groups-hub') {
            this.renderGroupsList();
          } else if (window.app.currentViewId === 'view-group-room') {
            this.renderGroupRoom();
          }
        } catch (err) {}
      }
    });

    // Pedir sincronización inicial
    window.gameNetwork.send('req_sync', {});
  }

  // Respuesta al pedido de sincronización de otros alumnos
  handleReqSync() {
    if (Object.keys(this.availableGroups).length > 0) {
      window.gameNetwork.send('sync_state', {
        groups: this.availableGroups,
        currentQuestion: this.currentQuestion,
        isQuestionActive: this.isQuestionActive,
        timeLeft: this.timeLeft
      });
    }
  }

  // RECEPCIÓN INSTANTÁNEA: Un compañero creó un grupo
  handleRemoteGroupCreated(data) {
    if (!data.groupId || !data.groupName) return;

    this.availableGroups[data.groupId] = {
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

    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.availableGroups));

    if (window.app.currentViewId === 'view-groups-hub') {
      this.renderGroupsList();
    }
  }

  // RECEPCIÓN INSTANTÁNEA: Un compañero se unió a un grupo
  handleRemoteGroupJoined(data) {
    const group = this.availableGroups[data.groupId];
    if (!group) return;

    if (!group.members.some(m => m.id === data.memberId || m.name === data.memberName)) {
      group.members.push({ id: data.memberId, name: data.memberName });
    }

    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.availableGroups));

    if (this.myGroup && this.myGroup.id === data.groupId) {
      this.myGroup = group;
      if (window.app.currentViewId === 'view-group-room') {
        this.renderGroupRoom();
      }
    }

    if (window.app.currentViewId === 'view-groups-hub') {
      this.renderGroupsList();
    }
  }

  // RECEPCIÓN INSTANTÁNEA: Un compañero salió de un grupo
  handleRemoteGroupLeft(data) {
    const group = this.availableGroups[data.groupId];
    if (!group) return;

    group.members = group.members.filter(m => m.id !== data.memberId);
    if (group.members.length === 0) {
      delete this.availableGroups[data.groupId];
    }

    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.availableGroups));

    if (this.myGroup && this.myGroup.id === data.groupId) {
      this.myGroup = group;
      if (window.app.currentViewId === 'view-group-room') {
        this.renderGroupRoom();
      }
    }

    if (window.app.currentViewId === 'view-groups-hub') {
      this.renderGroupsList();
    }
  }

  // RECEPCIÓN INSTANTÁNEA: El admin eliminó un grupo
  handleRemoteGroupDeleted(data) {
    if (!data || !data.groupId) return;
    const deletedId = data.groupId;

    delete this.availableGroups[deletedId];
    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.availableGroups));

    // Si el alumno pertenecía a ese grupo
    if (this.myGroup && this.myGroup.id === deletedId) {
      this.myGroup = null;
      this.myVote = null;
      this.myGhostVote = null;
      this.stopLocalTimer();
      window.soundFX.playWrong();

      // Volver a la pantalla del hub de grupos
      if (window.app.currentViewId !== 'view-landing') {
        window.app.switchView('view-groups-hub');
        this.renderGroupsList();
      }

      if (window.app && window.app.showToast) {
        window.app.showToast(`El grupo "${data.groupName || ''}" fue disuelto. Por favor elige o crea otro grupo.`);
      }
      return;
    }

    // Si este grupo era el aliado al que se le iba a dar la pista en Modo Alianza
    if (this.myGroup && this.myGroup.targetAllyId === deletedId) {
      this.myGroup.targetAllyId = null;
      if (window.app.currentViewId === 'view-player-ghost-mode') {
        this.renderGhostScreen();
      }
    }

    // Si el alumno está en la lista de grupos, actualizarla
    if (window.app.currentViewId === 'view-groups-hub') {
      this.renderGroupsList();
    }
  }

  // PASO 1: Ingreso solo con Nombre
  enterWithName() {
    const input = document.getElementById('student-name-input');
    const name = input ? input.value.trim() : '';

    if (!name) {
      alert("Por favor ingresa tu nombre o apodo para jugar.");
      return;
    }

    this.studentName = name;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cubismo_student_name', name);
    }
    window.soundFX.playClick();

    window.app.switchView('view-groups-hub');
    const greet = document.getElementById('hub-student-greeting');
    if (greet) greet.innerText = `Hola, ${this.escapeHtml(this.studentName)}`;

    this.renderGroupsList();
    window.gameNetwork.send('req_sync', {});
  }

  // PASO 2: Sincronización de Grupos y Estados
  handleSyncState(data) {
    if (!data) return;
    if (data.groups) {
      this.availableGroups = Object.assign({}, data.groups);
    }
    this.currentQuestion = data.currentQuestion;
    this.groupVotes = data.groupVotes || {};
    this.deadVotes = data.deadVotes || {};
    this.isQuestionActive = !!data.isQuestionActive;

    if (data.timeLeft !== undefined) {
      this.timeLeft = data.timeLeft;
    }

    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.availableGroups));

    // Si el alumno pertenecía a un grupo pero fue eliminado en el Admin
    if (this.myGroup && data.groups && !data.groups[this.myGroup.id]) {
      this.myGroup = null;
      this.myVote = null;
      this.myGhostVote = null;
      this.stopLocalTimer();
      window.soundFX.playWrong();
      if (window.app.currentViewId !== 'view-landing') {
        window.app.switchView('view-groups-hub');
        this.renderGroupsList();
      }
      if (window.app && window.app.showToast) {
        window.app.showToast("Tu grupo fue disuelto. Por favor únete a otro grupo.");
      }
      return;
    }

    // Actualizar mi grupo si pertenezco a alguno (estrictamente por ID de estudiante)
    if (this.myGroup) {
      this.myGroup = this.availableGroups[this.myGroup.id] || null;
    } else {
      for (const gId in this.availableGroups) {
        const g = this.availableGroups[gId];
        if (g.members && g.members.some(m => m.id === this.studentId)) {
          this.myGroup = g;
          break;
        }
      }
    }

    // Vistas previas al inicio de la pregunta
    if (window.app.currentViewId === 'view-groups-hub') {
      this.renderGroupsList();
    } else if (window.app.currentViewId === 'view-group-room') {
      this.renderGroupRoom();
    }

    // SI LA PREGUNTA ESTÁ ACTIVA
    if (this.isQuestionActive && this.myGroup) {
      // Si comenzó una nueva pregunta, reiniciar voto local
      if (this.currentQuestion && this.lastActiveQuestionId !== this.currentQuestion.id) {
        this.lastActiveQuestionId = this.currentQuestion.id;
        this.myVote = null;
        this.myGhostVote = null;
      }

      // Control de reloj en tiempo real para el jugador
      if (data.isTimerRunning !== false) {
        this.startLocalTimer();
      } else {
        this.stopLocalTimer();
        this.updatePlayerTimerDisplay();
      }

      if (this.myGroup.eliminated) {
        if (window.app.currentViewId !== 'view-player-ghost-mode') {
          window.app.switchView('view-player-ghost-mode');
        }
        this.renderGhostScreen(data);
      } else {
        if (window.app.currentViewId !== 'view-player-voting') {
          window.app.switchView('view-player-voting');
        }
        this.renderVotingScreen(data);
      }
    } else {
      this.stopLocalTimer();
      if (!this.isQuestionActive && this.myGroup && window.app.currentViewId === 'view-player-voting') {
        window.app.switchView('view-group-room');
        this.renderGroupRoom();
      }
    }
  }

  // GESTIÓN DEL RELOJ EN TIEMPO REAL (SEGUNDO A SEGUNDO)
  startLocalTimer() {
    this.updatePlayerTimerDisplay();
    if (!this.localTimerInterval) {
      this.localTimerInterval = setInterval(() => {
        if (this.timeLeft > 0) {
          this.timeLeft--;
          this.updatePlayerTimerDisplay();
        } else {
          this.stopLocalTimer();
        }
      }, 1000);
    }
  }

  stopLocalTimer() {
    if (this.localTimerInterval) {
      clearInterval(this.localTimerInterval);
      this.localTimerInterval = null;
    }
  }

  updatePlayerTimerDisplay() {
    const mins = Math.floor(Math.max(0, this.timeLeft) / 60);
    const secs = Math.max(0, this.timeLeft) % 60;
    const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const timerEl = document.getElementById('pv-timer');
    if (timerEl) {
      timerEl.innerText = timeFormatted;
      if (this.timeLeft <= 30) {
        timerEl.classList.add('urgent');
      } else {
        timerEl.classList.remove('urgent');
      }
    }

    const ghostTimerEl = document.getElementById('pv-ghost-timer');
    if (ghostTimerEl) {
      ghostTimerEl.innerText = timeFormatted;
      if (this.timeLeft <= 30) {
        ghostTimerEl.classList.add('urgent');
      } else {
        ghostTimerEl.classList.remove('urgent');
      }
    }
  }

  // Modal de creación de grupo
  showCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    if (modal) modal.style.display = 'flex';
  }

  hideCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    if (modal) modal.style.display = 'none';
  }

  confirmCreateGroup() {
    const input = document.getElementById('new-group-name-input');
    const groupName = input ? input.value.trim() : '';

    if (!groupName) {
      alert("Por favor escribe un nombre para tu grupo.");
      return;
    }

    const groupId = 'grp_' + Math.random().toString(36).substring(2, 9);
    window.soundFX.playClick();

    const newGroup = {
      id: groupId,
      name: groupName,
      leaderId: this.studentId,
      leaderName: this.studentName,
      members: [{ id: this.studentId, name: this.studentName }],
      score: 0,
      lives: 3,
      eliminated: false,
      targetAllyId: null
    };

    this.availableGroups[groupId] = newGroup;
    this.myGroup = newGroup;
    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.availableGroups));

    window.gameNetwork.send('create_group', {
      groupId: groupId,
      groupName: groupName,
      leaderId: this.studentId,
      leaderName: this.studentName
    });

    this.hideCreateGroupModal();
    window.app.switchView('view-group-room');
    this.renderGroupRoom();
  }

  joinGroup(groupId) {
    const group = this.availableGroups[groupId];
    if (!group) return;

    window.soundFX.playClick();
    if (!group.members.some(m => m.id === this.studentId || m.name === this.studentName)) {
      group.members.push({ id: this.studentId, name: this.studentName });
    }
    this.myGroup = group;
    localStorage.setItem('cubismo_classroom_groups', JSON.stringify(this.availableGroups));

    window.gameNetwork.send('join_group', {
      groupId: groupId,
      memberId: this.studentId,
      memberName: this.studentName
    });

    window.app.switchView('view-group-room');
    this.renderGroupRoom();
  }

  leaveGroup() {
    if (!this.myGroup) return;
    window.soundFX.playClick();

    window.gameNetwork.send('leave_group', {
      groupId: this.myGroup.id,
      memberId: this.studentId
    });

    this.myGroup = null;
    window.app.switchView('view-groups-hub');
    this.renderGroupsList();
  }

  // Render de la lista de grupos en el Hub
  renderGroupsList() {
    const container = document.getElementById('hub-groups-container');
    if (!container) return;
    container.innerHTML = '';

    const list = Object.values(this.availableGroups);
    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <p>No hay grupos creados todavía. Crea un grupo para comenzar.</p>
        </div>
      `;
      return;
    }

    list.forEach(g => {
      const isMyCurrentGroup = this.myGroup && this.myGroup.id === g.id;
      const card = document.createElement('div');
      card.className = 'team-badge';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.style.marginBottom = '0.8rem';

      const memberNames = g.members.map(m => this.escapeHtml(m.name)).join(', ');

      card.innerHTML = `
        <div style="flex:1;">
          <h4 style="color:var(--cubist-ochre); font-size:1.15rem; margin-bottom:0.2rem;">
            ${this.escapeHtml(g.name)}
          </h4>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.2rem;">
            Líder: <strong>${this.escapeHtml(g.leaderName)}</strong>
          </p>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            (${g.members.length}) Integrantes: ${memberNames}
          </p>
        </div>
        <div>
          ${isMyCurrentGroup ? `
            <button class="btn-primary" style="padding:0.5rem 1rem; font-size:0.85rem; background:#22c55e;" onclick="window.app.switchView('view-group-room')">
              Ver grupo ➔
            </button>
          ` : `
            <button id="btn-join-group-${g.id}" class="btn-primary btn-terracotta" style="padding:0.5rem 1.2rem; font-size:0.9rem;" onclick="playerController.joinGroup('${g.id}')">
              Unirse
            </button>
          `}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Render de la sala de espera del grupo
  renderGroupRoom() {
    if (!this.myGroup) return;

    document.getElementById('group-room-title').innerText = this.myGroup.name;
    const isLeader = this.myGroup.leaderId === this.studentId;
    document.getElementById('group-room-role').innerText = isLeader ? "Líder de Grupo" : "Integrante";

    const membersList = document.getElementById('group-room-members');
    if (membersList) {
      membersList.innerHTML = '';
      this.myGroup.members.forEach(m => {
        const item = document.createElement('div');
        item.style.padding = '0.45rem 0.8rem';
        item.style.background = 'rgba(255,255,255,0.06)';
        item.style.borderRadius = '6px';
        item.style.display = 'inline-block';
        item.style.margin = '0.3rem';
        const leaderBadge = m.id === this.myGroup.leaderId ? '<span class="badge-tag" style="margin-right:6px; font-size:0.65rem;">Líder</span>' : '';
        item.innerHTML = `${leaderBadge}${this.escapeHtml(m.name)}`;
        membersList.appendChild(item);
      });
    }
  }

  // PANTALLA DE VOTACIÓN (JUGADORES VIVOS)
  renderVotingScreen(data) {
    const q = data.currentQuestion;
    if (!q) return;

    document.getElementById('pv-q-theme').innerText = q.tema || q.titulo || "Cubismo Sintético";
    document.getElementById('pv-q-text').innerText = q.pregunta || q.afirmacion;

    this.updatePlayerTimerDisplay();

    // Botones de respuesta
    const optionsGrid = document.getElementById('pv-options-grid');
    if (optionsGrid) {
      const shapes = ['▲', '◆', '●', '■'];
      const options = q.opciones || (q.esVerdadero !== undefined ? ["Verdadero", "Falso"] : []);
      const ghostHintIndex = this.checkGhostAllyHint();

      // Reconstruir botones únicamente si cambió de pregunta o el contenedor está vacío
      if (this.renderedQuestionId !== q.id || optionsGrid.children.length !== options.length) {
        this.renderedQuestionId = q.id;
        optionsGrid.innerHTML = '';

        options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.id = `player-opt-btn-${idx}`;
          btn.className = `mobile-buzzer-btn b-${idx}`;
          btn.style.height = '85px';
          btn.style.position = 'relative';

          btn.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.6rem; font-size:1.1rem; width:100%; justify-content:flex-start; padding: 0 1rem;">
              <span style="font-size:1.6rem; font-weight:900;">${shapes[idx]}</span>
              <span style="text-align:left; font-size:0.95rem; font-weight:600; line-height:1.2;">${this.escapeHtml(opt)}</span>
              <span id="player-opt-hint-${idx}" class="badge-tag" style="display:none; margin-left:auto; background:rgba(192,132,252,0.25); border-color:#c084fc; color:#c084fc;">Pista Aliada</span>
            </div>
          `;

          btn.onclick = () => this.castVote(idx);
          optionsGrid.appendChild(btn);
        });
      }

      // Actualizar estado visual de selecciones y pista aliada sin recrear el DOM
      options.forEach((_, idx) => {
        const btn = document.getElementById(`player-opt-btn-${idx}`);
        const hint = document.getElementById(`player-opt-hint-${idx}`);
        if (btn) {
          if (this.myVote === idx) {
            btn.classList.add('selected-choice');
          } else {
            btn.classList.remove('selected-choice');
          }

          const isGhostSuggested = ghostHintIndex === idx;
          if (isGhostSuggested) {
            btn.style.boxShadow = '0 0 25px #a855f7, 0 0 50px #a855f7';
            btn.style.border = '3px solid #c084fc';
          } else {
            btn.style.boxShadow = '';
            btn.style.border = '';
          }

          if (hint) {
            hint.style.display = isGhostSuggested ? 'inline-block' : 'none';
          }
        }
      });
    }

    this.renderMyGroupVotesPanel();
  }

  castVote(optionIndex) {
    this.myVote = optionIndex;
    if (navigator.vibrate) navigator.vibrate(50);
    window.soundFX.playClick();

    // Actualizar clase seleccionada en pantalla al instante
    const optionsGrid = document.getElementById('pv-options-grid');
    if (optionsGrid) {
      Array.from(optionsGrid.children).forEach((btn, idx) => {
        if (idx === optionIndex) {
          btn.classList.add('selected-choice');
        } else {
          btn.classList.remove('selected-choice');
        }
      });
    }

    window.gameNetwork.send('cast_vote', {
      groupId: this.myGroup.id,
      memberId: this.studentId,
      memberName: this.studentName,
      optionIndex: optionIndex
    });

    if (!this.groupVotes[this.myGroup.id]) {
      this.groupVotes[this.myGroup.id] = {};
    }
    this.groupVotes[this.myGroup.id][this.studentId] = {
      optionIndex: optionIndex,
      name: this.studentName
    };

    this.renderMyGroupVotesPanel();
  }

  renderMyGroupVotesPanel() {
    const container = document.getElementById('pv-group-votes-list');
    const tieWarning = document.getElementById('pv-tie-warning');
    if (!container || !this.myGroup) return;

    container.innerHTML = '';
    const votes = this.groupVotes[this.myGroup.id] || {};
    const shapes = ['▲', '◆', '●', '■'];
    const voteCounts = {};

    this.myGroup.members.forEach(m => {
      const v = votes[m.id];
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '0.4rem 0.8rem';
      row.style.background = 'rgba(255,255,255,0.05)';
      row.style.borderRadius = '6px';
      row.style.marginBottom = '0.3rem';
      row.style.fontSize = '0.9rem';

      const isMe = m.id === this.studentId;

      if (v !== undefined) {
        voteCounts[v.optionIndex] = (voteCounts[v.optionIndex] || 0) + 1;
        row.innerHTML = `
          <span>${isMe ? '<strong>Tú</strong>' : this.escapeHtml(m.name)}:</span>
          <span style="font-weight:900; color:var(--cubist-ochre);">Opción ${shapes[v.optionIndex]}</span>
        `;
      } else {
        row.innerHTML = `
          <span style="opacity:0.6;">${isMe ? '<strong>Tú</strong>' : this.escapeHtml(m.name)}:</span>
          <span style="opacity:0.5; font-style:italic;">Eligiendo...</span>
        `;
      }
      container.appendChild(row);
    });

    // Detectar si hay empate en los votos del grupo
    if (tieWarning) {
      const counts = Object.values(voteCounts);
      if (counts.length > 1) {
        const max = Math.max(...counts);
        const topCount = counts.filter(c => c === max).length;
        if (topCount > 1) {
          tieWarning.style.display = 'block';
          tieWarning.innerHTML = `<strong>Empate de votos:</strong> Si no se ponen de acuerdo, se elegirá al azar entre las opciones más votadas al finalizar el tiempo.`;
        } else {
          tieWarning.style.display = 'none';
        }
      } else {
        tieWarning.style.display = 'none';
      }
    }
  }

  // Comprobar si algún grupo aliado tiene coincidencia unánime
  checkGhostAllyHint() {
    if (!this.myGroup) return null;

    for (const deadId in this.availableGroups) {
      const deadGroup = this.availableGroups[deadId];
      if (deadGroup.eliminated && deadGroup.targetAllyId === this.myGroup.id) {
        const deadData = this.deadVotes[deadId];
        if (deadData && deadData.votes) {
          const votes = Object.values(deadData.votes);
          const totalMembers = deadGroup.members.length;

          if (votes.length >= totalMembers && totalMembers > 0) {
            const first = votes[0];
            const allSame = votes.every(v => v === first);
            if (allSame) {
              return first;
            }
          }
        }
      }
    }
    return null;
  }

  // MODO ALIANZA (GRUPOS ELIMINADOS)
  renderGhostScreen(data) {
    if (!this.myGroup) return;

    this.updatePlayerTimerDisplay();

    const aliveGroups = Object.values(this.availableGroups).filter(g => !g.eliminated);
    const targetSelect = document.getElementById('ghost-target-select');
    if (targetSelect) {
      const currentVal = targetSelect.value || this.myGroup.targetAllyId || '';
      targetSelect.innerHTML = '<option value="">-- Elige un grupo aliado --</option>';
      aliveGroups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.innerText = g.name;
        if (currentVal === g.id) opt.selected = true;
        targetSelect.appendChild(opt);
      });
      targetSelect.onchange = (e) => {
        this.myGroup.targetAllyId = e.target.value;
        window.gameNetwork.send('set_dead_target', {
          deadGroupId: this.myGroup.id,
          targetGroupId: e.target.value
        });
        this.renderGhostConsensusStatus();
      };
    }

    const q = data.currentQuestion;
    if (!q) return;

    document.getElementById('ghost-q-text').innerText = q.pregunta || q.afirmacion;

    const grid = document.getElementById('ghost-buzzer-grid');
    if (grid) {
      const shapes = ['▲', '◆', '●', '■'];
      const options = q.opciones || (q.esVerdadero !== undefined ? ["Verdadero", "Falso"] : []);

      if (this.renderedGhostQuestionId !== q.id || grid.children.length !== options.length) {
        this.renderedGhostQuestionId = q.id;
        grid.innerHTML = '';

        options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.id = `ghost-opt-btn-${idx}`;
          btn.className = `mobile-buzzer-btn b-${idx}`;
          btn.style.height = '75px';
          btn.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.6rem; font-size:1.1rem; padding: 0 1rem;">
              <span>${shapes[idx]}</span>
              <span style="font-size:0.9rem;">${this.escapeHtml(opt)}</span>
            </div>
          `;
          btn.onclick = () => this.castGhostVote(idx);
          grid.appendChild(btn);
        });
      }

      options.forEach((_, idx) => {
        const btn = document.getElementById(`ghost-opt-btn-${idx}`);
        if (btn) {
          if (this.myGhostVote === idx) {
            btn.classList.add('selected-choice');
          } else {
            btn.classList.remove('selected-choice');
          }
        }
      });
    }

    this.renderGhostConsensusStatus();
  }

  castGhostVote(optionIndex) {
    this.myGhostVote = optionIndex;
    if (navigator.vibrate) navigator.vibrate(40);
    window.soundFX.playClick();

    const grid = document.getElementById('ghost-buzzer-grid');
    if (grid) {
      Array.from(grid.children).forEach((btn, idx) => {
        if (idx === optionIndex) {
          btn.classList.add('selected-choice');
        } else {
          btn.classList.remove('selected-choice');
        }
      });
    }

    window.gameNetwork.send('cast_dead_vote', {
      deadGroupId: this.myGroup.id,
      memberId: this.studentId,
      optionIndex: optionIndex
    });

    if (!this.deadVotes[this.myGroup.id]) {
      this.deadVotes[this.myGroup.id] = { targetGroupId: this.myGroup.targetAllyId || null, votes: {} };
    }
    this.deadVotes[this.myGroup.id].votes[this.studentId] = optionIndex;

    this.renderGhostConsensusStatus();
  }

  renderGhostConsensusStatus() {
    const statusBox = document.getElementById('ghost-consensus-status');
    if (!statusBox || !this.myGroup) return;

    const deadData = this.deadVotes[this.myGroup.id];
    const votes = (deadData && deadData.votes) ? Object.values(deadData.votes) : [];
    const totalMembers = this.myGroup.members.length;

    if (!this.myGroup.targetAllyId) {
      statusBox.innerHTML = `<em>Selecciona un grupo aliado arriba para poder transmitirle la pista.</em>`;
      statusBox.style.color = 'var(--cubist-ochre)';
      return;
    }

    if (votes.length < totalMembers) {
      statusBox.innerHTML = `<em>Han votado ${votes.length} de ${totalMembers} integrantes de tu grupo. Todos deben votar para comprobar coincidencia.</em>`;
      statusBox.style.color = 'var(--text-muted)';
      return;
    }

    const first = votes[0];
    const allSame = votes.every(v => v === first);
    const shapes = ['▲', '◆', '●', '■'];

    if (allSame) {
      statusBox.innerHTML = `<strong>COINCIDENCIA COMPLETA:</strong> Todos eligieron la opción <strong>${shapes[first]}</strong>. La sugerencia se transmitió a su aliado.`;
      statusBox.style.color = '#c084fc';
    } else {
      statusBox.innerHTML = `<strong>NO HAY COINCIDENCIA:</strong> Hay votos discrepantes. No se transmitirá la pista hasta que todos coincidan en la misma opción.`;
      statusBox.style.color = '#ef4444';
    }
  }

  // EVALUACIÓN DE LA PREGUNTA
  handleEvalResult(data) {
    this.stopLocalTimer();
    window.app.switchView('view-player-eval');
    window.soundFX.playClick();

    const resultCard = document.getElementById('player-eval-card');
    if (!resultCard || !this.myGroup) return;

    const myResult = data.results && data.results[this.myGroup.id];
    const tieInfo = data.tiedDecisions && data.tiedDecisions[this.myGroup.id];
    const shapes = ['▲', '◆', '●', '■'];

    if (this.myGroup.eliminated) {
      resultCard.innerHTML = `
        <h3 style="color:#c084fc; font-family:var(--font-display);">Ronda Finalizada</h3>
        <p style="color:var(--text-secondary); margin-top:0.5rem;">
          La respuesta correcta era: <strong>${shapes[data.correctIndex]}</strong>
        </p>
        <p style="font-size:0.9rem; color:var(--text-muted); margin-top:1rem; line-height:1.4;">${this.escapeHtml(data.explanation)}</p>
      `;
      return;
    }

    if (!myResult) return;

    let tieMessage = '';
    if (tieInfo) {
      tieMessage = `
        <div style="background:rgba(229, 169, 59, 0.15); border:1px solid #e5a93b; padding:0.6rem; border-radius:6px; margin:0.8rem 0; font-size:0.85rem; color:#e5a93b;">
          <strong>Desempate al azar:</strong> Hubo empate en los votos de tu grupo y el sistema eligió la opción <strong>${shapes[tieInfo.chosenOption]}</strong>.
        </div>
      `;
    }

    const lifePips = Array.from({ length: 3 }, (_, i) => 
      `<span class="life-dot ${i >= myResult.lives ? 'lost' : ''}"></span>`
    ).join('');

    if (myResult.isCorrect) {
      window.soundFX.playCorrect();
      resultCard.className = 'player-feedback-card correct';
      resultCard.innerHTML = `
        <div class="status-symbol correct">✓</div>
        <h2 style="color:#22c55e; font-size:1.8rem;">RESPUESTA CORRECTA</h2>
        <p style="font-size:1rem; margin-top:0.4rem;">Tu grupo eligió la opción <strong>${shapes[myResult.chosenOption]}</strong>.</p>
        ${tieMessage}
        <div style="margin-top:1rem; font-size:1.2rem; font-weight:bold; color:var(--cubist-ochre);">
          Puntaje: ${myResult.score.toLocaleString()} pts
        </div>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:1rem; line-height:1.4;">
          <em>Dato histórico: ${this.escapeHtml(data.explanation)}</em>
        </p>
      `;
    } else {
      window.soundFX.playWrong();
      resultCard.className = 'player-feedback-card wrong';
      resultCard.innerHTML = `
        <div class="status-symbol wrong">✕</div>
        <h2 style="color:#ef4444; font-size:1.8rem;">RESPUESTA INCORRECTA</h2>
        <p style="font-size:1rem; margin-top:0.4rem;">
          Tu grupo eligió <strong>${shapes[myResult.chosenOption] || 'Ninguna'}</strong>. La correcta era <strong>${shapes[data.correctIndex]}</strong>.
        </p>
        ${tieMessage}
        <div style="margin-top:1rem; font-size:1rem; color:var(--text-secondary); display:flex; align-items:center; justify-content:center; gap:0.5rem;">
          <span>Vidas:</span>
          <div class="life-bar">${lifePips}</div>
          <span style="margin-left:0.5rem;">• ${myResult.score.toLocaleString()} pts</span>
        </div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:1rem; line-height:1.4;">
          <em>Dato histórico: ${this.escapeHtml(data.explanation)}</em>
        </p>
      `;
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

window.playerController = new PlayerController();
