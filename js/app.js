/**
 * app.js - Enrutador maestro con acceso secreto por URL #admin
 */

class AppManager {
  constructor() {
    this.currentViewId = 'view-landing';
    this.isAdmin = false;
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRouting());

    const soundToggle = document.getElementById('btn-sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        const isMuted = window.soundFX.toggleMute();
        soundToggle.style.opacity = isMuted ? '0.35' : '1';
        soundToggle.title = isMuted ? 'Activar Sonido' : 'Silenciar';
      });
    }

    this.handleRouting();
  }

  handleRouting() {
    const hash = window.location.hash.toLowerCase();

    // Modo de control de partida (#admin)
    if (hash === '#admin') {
      this.isAdmin = true;
      this.switchView('view-admin-lobby');
      window.adminController.init();
    } else {
      this.isAdmin = false;
      // Pantalla de inicio para alumnos
      this.switchView('view-landing');
      window.playerController.init();
    }
  }

  switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      this.currentViewId = viewId;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  resetToHome() {
    window.location.hash = '';
    window.location.reload();
  }

  showToast(message, duration = 4000) {
    const el = document.getElementById('app-toast');
    if (!el) return;
    el.innerHTML = message;
    el.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      el.classList.remove('show');
    }, duration);
  }
}

window.app = new AppManager();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
