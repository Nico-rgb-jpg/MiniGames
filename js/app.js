/* ==========================================================================
   MODULE : APP
   Point d'entrée. Initialise tous les modules, gère la navigation globale,
   la fenêtre Paramètres, les succès (achievements) et le cycle de vie
   général de l'application.
   Expose window.MG.App
   ========================================================================== */
(function () {
  "use strict";

  /* -------------------- Définition des succès (bonus) -------------------- */
  const ACHIEVEMENTS = [
    {
      id: "premiere-victoire",
      icon: "🏅",
      nom: "Première victoire",
      description: "Remportez votre première partie, tous jeux confondus.",
      check: (data) => data.global.victoires >= 1,
    },
    {
      id: "dix-victoires",
      icon: "🥇",
      nom: "10 victoires",
      description: "Remportez 10 parties au total.",
      check: (data) => data.global.victoires >= 10,
    },
    {
      id: "cent-parties",
      icon: "💯",
      nom: "100 parties",
      description: "Jouez 100 parties, tous jeux confondus.",
      check: (data) => data.global.parties >= 100,
    },
    {
      id: "serie-5",
      icon: "🔥",
      nom: "Série de 5 victoires",
      description: "Enchaînez 5 victoires consécutives.",
      check: (data) => data.global.meilleureSerie >= 5,
    },
    {
      id: "morpion-difficile",
      icon: "🧠",
      nom: "Maître du Morpion",
      description: "Battez l'IA au Morpion en mode Difficile.",
      check: (data, evt) => evt && evt.gameId === "morpion" && evt.resultat === "victoire" && evt.meta && evt.meta.difficulte === "difficile",
    },
    {
      id: "bataille-victoire",
      icon: "⚓",
      nom: "Amiral victorieux",
      description: "Remportez votre première Bataille Navale.",
      check: (data) => data.jeux.bataille.victoires >= 1,
    },
    {
      id: "bataille-precision",
      icon: "🎯",
      nom: "Tireur d'élite",
      description: "Gagnez une Bataille Navale avec au moins 80% de précision.",
      check: (data, evt) => evt && evt.gameId === "bataille" && evt.resultat === "victoire" && evt.meta && evt.meta.precision >= 80,
    },
    {
      id: "chifoumi-fan",
      icon: "✊",
      nom: "Fan de Chifoumi",
      description: "Jouez 20 manches de Chifoumi.",
      check: (data) => data.jeux.chifoumi.parties >= 20,
    },
  ];

  /* -------------------- Navigation -------------------- */
  const GAME_MODULES = {
    chifoumi: () => window.MG.Chifoumi,
    morpion: () => window.MG.Morpion,
    bataille: () => window.MG.Bataille,
  };

  function goToGame(gameId) {
    window.MG.Sound.clic();
    window.MG.UI.showScreen(gameId);
  }

  function goHome() {
    window.MG.Sound.clic();
    window.MG.Menu.refresh();
    window.MG.UI.showScreen("accueil");
  }

  function replayCurrent() {
    const current = window.MG.UI.getCurrentScreen();
    const mod = GAME_MODULES[current] && GAME_MODULES[current]();
    if (mod && mod.resetRound) {
      window.MG.Sound.clic();
      mod.resetRound();
    }
  }

  /* -------------------- Succès -------------------- */
  function checkAchievements(evt) {
    const data = window.MG.Storage.getAll();
    ACHIEVEMENTS.forEach((ach) => {
      if (data.achievements.includes(ach.id)) return;
      try {
        if (ach.check(data, evt)) {
          const gained = window.MG.Storage.unlockAchievement(ach.id);
          if (gained) {
            window.MG.Sound.achievement();
            window.MG.UI.showToast({
              icon: ach.icon,
              title: "Succès débloqué !",
              desc: ach.nom,
            });
          }
        }
      } catch (err) {
        console.warn("[App] Erreur lors de la vérification d'un succès", ach.id, err);
      }
    });
  }

  /** Appelé par chaque module de jeu à la fin d'une manche/partie. */
  function onGameResult(gameId, resultat, meta) {
    checkAchievements({ gameId, resultat, meta });
    window.MG.Menu.refresh(); // met à jour les compteurs affichés sur les cartes d'accueil
  }

  /* -------------------- Paramètres -------------------- */
  function initSettingsPanel() {
    const settings = window.MG.Storage.getSettings();

    const themeBtns = document.querySelectorAll(".theme-btn");
    themeBtns.forEach((btn) => {
      btn.setAttribute("aria-checked", String(btn.dataset.themeChoice === settings.theme));
      btn.addEventListener("click", () => {
        const theme = btn.dataset.themeChoice;
        window.MG.Storage.updateSettings({ theme });
        window.MG.UI.applyTheme(theme);
        themeBtns.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      });
    });

    const toggleSound = document.getElementById("toggle-sound");
    toggleSound.checked = settings.soundOn;
    window.MG.Sound.setEnabled(settings.soundOn);
    toggleSound.addEventListener("change", () => {
      window.MG.Storage.updateSettings({ soundOn: toggleSound.checked });
      window.MG.Sound.setEnabled(toggleSound.checked);
    });

    const rangeVolume = document.getElementById("range-volume");
    rangeVolume.value = settings.volume;
    window.MG.Sound.setVolume(settings.volume);
    rangeVolume.addEventListener("input", () => {
      window.MG.Storage.updateSettings({ volume: Number(rangeVolume.value) });
      window.MG.Sound.setVolume(Number(rangeVolume.value));
    });

    const toggleAnim = document.getElementById("toggle-animations");
    toggleAnim.checked = settings.animationsOn;
    window.MG.UI.applyAnimations(settings.animationsOn);
    toggleAnim.addEventListener("change", () => {
      window.MG.Storage.updateSettings({ animationsOn: toggleAnim.checked });
      window.MG.UI.applyAnimations(toggleAnim.checked);
    });

    document.getElementById("btn-reset-stats").addEventListener("click", () => {
      if (confirm("Réinitialiser toutes les statistiques et succès ? Cette action est irréversible.")) {
        window.MG.Storage.resetStats();
        window.MG.UI.refreshGlobalScore();
        window.MG.Menu.refresh();
        window.MG.UI.showToast({ icon: "🧹", title: "Statistiques réinitialisées" });
      }
    });

    document.getElementById("btn-reset-all").addEventListener("click", () => {
      if (confirm("Tout effacer (statistiques, succès, préférences) ? Cette action est irréversible.")) {
        window.MG.Storage.resetAll();
        location.reload();
      }
    });

    // Applique le thème initial
    window.MG.UI.applyTheme(settings.theme);
  }

  /* -------------------- Câblage de la barre supérieure et des modales -------------------- */
  function initTopbar() {
    document.getElementById("btn-home").addEventListener("click", goHome);
    document.getElementById("btn-replay").addEventListener("click", replayCurrent);

    const modalSettings = document.getElementById("modal-settings");
    document.getElementById("btn-settings").addEventListener("click", () => window.MG.UI.openModal(modalSettings));
    document.getElementById("btn-close-settings").addEventListener("click", () => window.MG.UI.closeModal(modalSettings));
    modalSettings.addEventListener("click", (e) => { if (e.target === modalSettings) window.MG.UI.closeModal(modalSettings); });

    const modalStats = document.getElementById("modal-stats");
    document.getElementById("btn-stats").addEventListener("click", () => {
      window.MG.UI.renderStats();
      window.MG.UI.openModal(modalStats);
    });
    document.getElementById("btn-close-stats").addEventListener("click", () => window.MG.UI.closeModal(modalStats));
    modalStats.addEventListener("click", (e) => { if (e.target === modalStats) window.MG.UI.closeModal(modalStats); });

    // Fermeture des modales avec la touche Échap (accessibilité clavier)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!modalSettings.hidden) window.MG.UI.closeModal(modalSettings);
      if (!modalStats.hidden) window.MG.UI.closeModal(modalStats);
    });

    // Ajoute un léger effet "rebond" au clic sur tous les boutons (délégation d'événements)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn, .icon-btn, .choice-btn, .diff-btn, .theme-btn");
      if (!btn) return;
      btn.classList.remove("is-pressed");
      void btn.offsetWidth;
      btn.classList.add("is-pressed");
    });
  }

  /* -------------------- Initialisation générale -------------------- */
  function hideLoader() {
    const loader = document.getElementById("loader");
    loader.classList.add("is-hidden");
    setTimeout(() => loader.remove(), 600);
  }

  function init() {
    window.MG.UI.init();
    window.MG.Menu.refresh();
    window.MG.Chifoumi.init();
    window.MG.Morpion.init();
    window.MG.Bataille.init();
    initTopbar();
    initSettingsPanel();
    window.MG.UI.showScreen("accueil");

    // Petit délai pour laisser l'écran de chargement respirer (expérience plus fluide)
    setTimeout(hideLoader, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MG = window.MG || {};
  window.MG.App = { goToGame, goHome, replayCurrent, onGameResult };
  window.MG.Achievements = ACHIEVEMENTS;
})();
