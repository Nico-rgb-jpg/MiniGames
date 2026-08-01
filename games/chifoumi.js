/* ==========================================================================
   MODULE : CHIFOUMI (Pierre - Feuille - Ciseaux)
   IA aléatoire. Expose window.MG.Chifoumi
   ========================================================================== */
(function () {
  "use strict";

  const CHOICES = ["pierre", "feuille", "ciseaux"];
  const ICONS = { pierre: "✊", feuille: "✋", ciseaux: "✌️" };
  const LABELS = { pierre: "Pierre", feuille: "Feuille", ciseaux: "Ciseaux" };

  // Table des victoires : BEATS[a] === b signifie "a bat b"
  const BEATS = { pierre: "ciseaux", feuille: "pierre", ciseaux: "feuille" };

  let els = {};
  let roundNumber = 1;
  let locked = false; // empêche de cliquer pendant l'animation de révélation

  function cacheEls() {
    els.playerDisplay = document.getElementById("chifoumi-player-display");
    els.aiDisplay = document.getElementById("chifoumi-ai-display");
    els.result = document.getElementById("chifoumi-result");
    els.round = document.getElementById("chifoumi-round");
    els.choices = document.querySelectorAll("#chifoumi-choices .choice-btn");
    els.v = document.getElementById("chifoumi-v");
    els.d = document.getElementById("chifoumi-d");
    els.n = document.getElementById("chifoumi-n");
    els.history = document.getElementById("chifoumi-history");
  }

  function aiChoice() {
    return CHOICES[Math.floor(Math.random() * CHOICES.length)];
  }

  function determineResult(player, ai) {
    if (player === ai) return "egalite";
    return BEATS[player] === ai ? "victoire" : "defaite";
  }

  function updateScoreboard() {
    const stats = window.MG.Storage.getGameStats("chifoumi");
    els.v.textContent = stats.victoires;
    els.d.textContent = stats.defaites;
    els.n.textContent = stats.egalites;
  }

  function renderHistory() {
    const stats = window.MG.Storage.getGameStats("chifoumi");
    const derniers = stats.historique.slice(0, 10);
    if (derniers.length === 0) {
      els.history.innerHTML = `<p class="empty-note">Aucune manche jouée pour l'instant.</p>`;
      return;
    }
    els.history.innerHTML = derniers.map((entry) => {
      const cls = entry.resultat === "victoire" ? "win" : entry.resultat === "defaite" ? "lose" : "draw";
      const symbole = entry.resultat === "victoire" ? "✔" : entry.resultat === "defaite" ? "✘" : "=";
      return `<span class="history-chip ${cls}" title="${LABELS[entry.joueur]} vs ${LABELS[entry.ia]}">${symbole} ${ICONS[entry.joueur]}/${ICONS[entry.ia]}</span>`;
    }).join("");
  }

  function setChoicesDisabled(disabled) {
    els.choices.forEach((btn) => { btn.disabled = disabled; });
  }

  function play(playerChoice) {
    if (locked) return;
    locked = true;
    setChoicesDisabled(true);
    window.MG.Sound.clic();

    els.result.textContent = "";
    els.result.className = "chifoumi-result";
    els.playerDisplay.textContent = ICONS[playerChoice];
    els.playerDisplay.classList.remove("revealed");

    // Animation de réflexion de l'IA avant révélation
    els.aiDisplay.textContent = "🤔";
    els.aiDisplay.classList.add("thinking");

    const chosenAi = aiChoice();

    setTimeout(() => {
      els.aiDisplay.classList.remove("thinking");
      els.aiDisplay.textContent = ICONS[chosenAi];
      els.aiDisplay.classList.add("revealed");
      els.playerDisplay.classList.add("revealed");

      const resultat = determineResult(playerChoice, chosenAi);
      afficherResultat(resultat);

      window.MG.Storage.recordResult("chifoumi", resultat, { joueur: playerChoice, ia: chosenAi });
      updateScoreboard();
      renderHistory();
      window.MG.UI.refreshGlobalScore();

      if (window.MG.App && window.MG.App.onGameResult) {
        window.MG.App.onGameResult("chifoumi", resultat, { joueur: playerChoice, ia: chosenAi });
      }

      roundNumber++;
      els.round.textContent = roundNumber;

      setTimeout(() => {
        setChoicesDisabled(false);
        locked = false;
      }, 400);
    }, 900);
  }

  function afficherResultat(resultat) {
    if (resultat === "victoire") {
      els.result.textContent = "Vous gagnez cette manche !";
      els.result.classList.add("win");
      window.MG.Sound.victoire();
      window.MG.UI.launchConfetti(40);
    } else if (resultat === "defaite") {
      els.result.textContent = "L'IA remporte cette manche.";
      els.result.classList.add("lose");
      window.MG.Sound.defaite();
      window.MG.UI.shakeScreen();
    } else {
      els.result.textContent = "Égalité !";
      els.result.classList.add("draw");
      window.MG.Sound.egalite();
    }
  }

  function resetRound() {
    roundNumber = 1;
    locked = false;
    if (els.round) els.round.textContent = roundNumber;
    if (els.playerDisplay) { els.playerDisplay.textContent = "?"; els.playerDisplay.classList.remove("revealed"); }
    if (els.aiDisplay) { els.aiDisplay.textContent = "?"; els.aiDisplay.classList.remove("revealed", "thinking"); }
    if (els.result) { els.result.textContent = ""; els.result.className = "chifoumi-result"; }
    setChoicesDisabled(false);
  }

  function init() {
    cacheEls();
    els.choices.forEach((btn) => {
      btn.addEventListener("click", () => play(btn.dataset.choice));
    });
    updateScoreboard();
    renderHistory();
  }

  window.MG = window.MG || {};
  window.MG.Chifoumi = { init, resetRound };
})();
