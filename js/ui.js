/* ==========================================================================
   MODULE : UI
   Gère la navigation entre écrans, la barre supérieure, les modales,
   les notifications toast, les confettis et l'écran de statistiques.
   Expose window.MG.UI
   ========================================================================== */
(function () {
  "use strict";

  const els = {}; // cache des éléments DOM, rempli au init()

  const GAME_LABELS = {
    accueil: "Mini Games",
    chifoumi: "Chifoumi",
    morpion: "Morpion",
    bataille: "Bataille Navale",
  };

  let currentScreen = "accueil";

  function cacheEls() {
    els.loader = document.getElementById("loader");
    els.topbarTitle = document.getElementById("current-game-name");
    els.scoreV = document.getElementById("score-victoires");
    els.scoreD = document.getElementById("score-defaites");
    els.scoreN = document.getElementById("score-egalites");
    els.btnReplay = document.getElementById("btn-replay");
    els.screens = document.querySelectorAll(".screen");
    els.confettiLayer = document.getElementById("confetti-layer");
    els.toastContainer = document.getElementById("toast-container");
    els.modalSettings = document.getElementById("modal-settings");
    els.modalStats = document.getElementById("modal-stats");
    els.statsBody = document.getElementById("stats-body");
  }

  /* -------------------- Navigation entre écrans -------------------- */
  function showScreen(id) {
    currentScreen = id;
    els.screens.forEach((s) => {
      s.hidden = s.id !== `screen-${id}`;
    });
    els.topbarTitle.textContent = GAME_LABELS[id] || "Mini Games";
    els.btnReplay.hidden = id === "accueil";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getCurrentScreen() {
    return currentScreen;
  }

  /* -------------------- Score global (barre supérieure) -------------------- */
  function refreshGlobalScore() {
    const g = window.MG.Storage.getGlobal();
    els.scoreV.textContent = g.victoires;
    els.scoreD.textContent = g.defaites;
    els.scoreN.textContent = g.egalites;
  }

  /* -------------------- Modales -------------------- */
  function openModal(modalEl) {
    modalEl.hidden = false;
    document.body.style.overflow = "hidden";
    const closable = modalEl.querySelector("button, input, [tabindex]");
    if (closable) closable.focus({ preventScroll: true });
  }
  function closeModal(modalEl) {
    modalEl.hidden = true;
    document.body.style.overflow = "";
  }

  /* -------------------- Toasts (succès débloqués, messages) -------------------- */
  function showToast({ icon = "🔔", title, desc = "", duration = 4200 }) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <span class="toast__icon">${icon}</span>
      <div>
        <p class="toast__title">${title}</p>
        ${desc ? `<p class="toast__desc">${desc}</p>` : ""}
      </div>
    `;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* -------------------- Confettis CSS -------------------- */
  const CONFETTI_COLORS = ["#5b8cff", "#9b6bff", "#4ade80", "#fbbf66", "#ff6b81", "#ffffff"];
  function launchConfetti(count = 60) {
    if (document.body.classList.contains("no-animations")) return;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const left = Math.random() * 100;
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const duration = 2.2 + Math.random() * 1.6;
      const delay = Math.random() * 0.4;
      const rotate = Math.random() > 0.5 ? "50%" : "0%";
      piece.style.left = left + "vw";
      piece.style.background = color;
      piece.style.borderRadius = rotate;
      piece.style.animationDuration = duration + "s";
      piece.style.animationDelay = delay + "s";
      els.confettiLayer.appendChild(piece);
      setTimeout(() => piece.remove(), (duration + delay) * 1000 + 100);
    }
  }

  /* -------------------- Effet de défaite (vibration écran) -------------------- */
  function shakeScreen() {
    if (document.body.classList.contains("no-animations")) return;
    const active = document.querySelector(".screen:not([hidden])");
    if (!active) return;
    active.classList.remove("shake");
    void active.offsetWidth; // force reflow pour rejouer l'animation
    active.classList.add("shake");
  }

  /* -------------------- Écran Statistiques / Succès -------------------- */
  function formatDuree(ms) {
    if (!ms) return "0 min";
    const min = Math.round(ms / 60000);
    if (min < 1) return "< 1 min";
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} h ${min % 60} min`;
  }

  function renderStats() {
    const g = window.MG.Storage.getGlobal();
    const jeux = window.MG.Storage.getAll().jeux;
    const achievements = window.MG.Achievements || [];
    const unlocked = window.MG.Storage.getAchievements();

    const tauxVictoire = g.parties > 0 ? Math.round((g.victoires / g.parties) * 100) : 0;

    // Jeu préféré = celui avec le plus de parties jouées
    const gameNames = { chifoumi: "Chifoumi", morpion: "Morpion", bataille: "Bataille Navale" };
    let favori = "—";
    let favoriParties = 0;
    for (const key of Object.keys(jeux)) {
      if (jeux[key].parties > favoriParties) { favoriParties = jeux[key].parties; favori = gameNames[key]; }
    }

    const tuiles = `
      <div class="stats-grid">
        <div class="stats-tile"><p class="stats-tile__label">Parties jouées</p><p class="stats-tile__value">${g.parties}</p></div>
        <div class="stats-tile"><p class="stats-tile__label">Taux de victoire</p><p class="stats-tile__value">${tauxVictoire}%</p></div>
        <div class="stats-tile"><p class="stats-tile__label">Meilleure série</p><p class="stats-tile__value">${g.meilleureSerie}</p></div>
        <div class="stats-tile"><p class="stats-tile__label">Temps de jeu</p><p class="stats-tile__value">${formatDuree(g.tempsJeuTotalMs)}</p></div>
        <div class="stats-tile"><p class="stats-tile__label">Jeu préféré</p><p class="stats-tile__value" style="font-size:1.1rem">${favori}</p></div>
        <div class="stats-tile"><p class="stats-tile__label">Séquence actuelle</p><p class="stats-tile__value">${g.serieActuelle}</p></div>
      </div>
    `;

    const repartition = Object.keys(jeux).map((key) => {
      const j = jeux[key];
      const pct = g.parties > 0 ? Math.round((j.parties / g.parties) * 100) : 0;
      return `
        <div class="bar-row">
          <span class="bar-row__label">${gameNames[key]}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-row__value">${j.parties}</span>
        </div>`;
    }).join("");

    const badges = achievements.map((a) => {
      const isUnlocked = unlocked.includes(a.id);
      return `
        <div class="achievement ${isUnlocked ? "unlocked" : ""}">
          <div class="achievement__icon">${a.icon}</div>
          <p class="achievement__name">${a.nom}</p>
          <p class="achievement__desc">${a.description}</p>
        </div>`;
    }).join("");

    els.statsBody.innerHTML = `
      ${tuiles}
      <div>
        <p class="history-panel__title" style="margin-bottom:10px;">Répartition par jeu</p>
        ${repartition}
      </div>
      <div>
        <p class="history-panel__title" style="margin-bottom:10px;">🏆 Succès (${unlocked.length}/${achievements.length})</p>
        <div class="achievements-grid">${badges}</div>
      </div>
    `;
  }

  /* -------------------- Application du thème / animations -------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }
  function applyAnimations(enabled) {
    document.body.classList.toggle("no-animations", !enabled);
  }

  /* -------------------- Init -------------------- */
  function init() {
    cacheEls();
    refreshGlobalScore();
  }

  window.MG = window.MG || {};
  window.MG.UI = {
    init,
    showScreen,
    getCurrentScreen,
    refreshGlobalScore,
    openModal,
    closeModal,
    showToast,
    launchConfetti,
    shakeScreen,
    renderStats,
    applyTheme,
    applyAnimations,
    get els() { return els; },
  };
})();
