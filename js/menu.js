/* ==========================================================================
   MODULE : MENU (écran d'accueil)
   Génère les trois cartes de jeu et gère la navigation vers un jeu.
   Expose window.MG.Menu
   ========================================================================== */
(function () {
  "use strict";

  const GAMES = [
    {
      id: "chifoumi",
      title: "Chifoumi",
      desc: "Le classique Pierre-Feuille-Ciseaux. Affrontez une IA imprévisible, manche après manche.",
      icon: `<svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 13V5a2 2 0 1 1 4 0v6M12 11V4a2 2 0 1 1 4 0v7M16 11.5V7a2 2 0 1 1 4 0v7a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L3.5 13a1.8 1.8 0 0 1 2.8-2.2L8 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
    {
      id: "morpion",
      title: "Morpion",
      desc: "Le morpion revisité avec une IA capable de jouer en Minimax. Saurez-vous l'emporter ?",
      icon: `<svg viewBox="0 0 24 24" width="30" height="30"><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    },
    {
      id: "bataille",
      title: "Bataille Navale",
      desc: "Placez votre flotte et menez une bataille stratégique sur une grille 10x10 contre une IA redoutable.",
      icon: `<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 17c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0M5 17l1-8h12l1 8M9 9V5h6v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
  ];

  function renderCards() {
    const grid = document.getElementById("cards-grid");
    grid.innerHTML = GAMES.map((game) => {
      const stats = window.MG.Storage.getGameStats(game.id);
      return `
        <article class="game-card" role="listitem" tabindex="0" data-game="${game.id}" aria-label="Jouer à ${game.title}">
          <div class="game-card__icon">${game.icon}</div>
          <h2 class="game-card__title">${game.title}</h2>
          <p class="game-card__desc">${game.desc}</p>
          <div class="game-card__stats">
            <span>${stats.parties} parties</span>
            <span>${stats.victoires} victoires</span>
          </div>
          <button class="btn btn--primary btn--block" data-play="${game.id}">Jouer</button>
        </article>
      `;
    }).join("");

    // Un clic n'importe où sur la carte, ou sur le bouton, lance le jeu
    grid.querySelectorAll(".game-card").forEach((card) => {
      card.addEventListener("click", () => window.MG.App.goToGame(card.dataset.game));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.MG.App.goToGame(card.dataset.game); }
      });
    });
  }

  function refresh() {
    renderCards();
  }

  window.MG = window.MG || {};
  window.MG.Menu = { refresh };
})();
