/* ==========================================================================
   MODULE : MORPION (Tic Tac Toe)
   Joueur = X, IA = O.
   Niveaux : Facile (aléatoire), Moyen (heuristique), Difficile (Minimax parfait)
   Expose window.MG.Morpion
   ========================================================================== */
(function () {
  "use strict";

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // lignes
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // colonnes
    [0, 4, 8], [2, 4, 6],            // diagonales
  ];

  let els = {};
  let board = Array(9).fill(null);
  let gameOver = false;
  let difficulty = "difficile";

  function cacheEls() {
    els.board = document.getElementById("morpion-board");
    els.turn = document.getElementById("morpion-turn");
    els.diffBtns = document.querySelectorAll(".diff-btn");
    els.v = document.getElementById("morpion-v");
    els.d = document.getElementById("morpion-d");
    els.n = document.getElementById("morpion-n");
    els.history = document.getElementById("morpion-history");
  }

  /* -------------------- Logique du jeu -------------------- */
  function checkWinner(b) {
    for (const line of WIN_LINES) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) {
        return { winner: b[a], line };
      }
    }
    if (b.every((cell) => cell !== null)) return { winner: "nul", line: null };
    return null;
  }

  function emptyCells(b) {
    return b.reduce((acc, v, i) => { if (!v) acc.push(i); return acc; }, []);
  }

  /* -------------------- IA : Minimax (mode Difficile) -------------------- */
  function minimax(b, depth, isMaximizing) {
    const result = checkWinner(b);
    if (result) {
      if (result.winner === "O") return 10 - depth;
      if (result.winner === "X") return depth - 10;
      return 0;
    }

    if (isMaximizing) {
      let best = -Infinity;
      for (const i of emptyCells(b)) {
        b[i] = "O";
        best = Math.max(best, minimax(b, depth + 1, false));
        b[i] = null;
      }
      return best;
    } else {
      let best = Infinity;
      for (const i of emptyCells(b)) {
        b[i] = "X";
        best = Math.min(best, minimax(b, depth + 1, true));
        b[i] = null;
      }
      return best;
    }
  }

  function bestMoveMinimax(b) {
    let bestScore = -Infinity;
    let move = null;
    for (const i of emptyCells(b)) {
      b[i] = "O";
      const score = minimax(b, 0, false);
      b[i] = null;
      if (score > bestScore) { bestScore = score; move = i; }
    }
    return move;
  }

  /* -------------------- IA : heuristique (mode Moyen) -------------------- */
  function findWinningMove(b, symbol) {
    for (const i of emptyCells(b)) {
      b[i] = symbol;
      const res = checkWinner(b);
      b[i] = null;
      if (res && res.winner === symbol) return i;
    }
    return null;
  }

  function bestMoveMoyen(b) {
    // 1) Gagner si possible
    let move = findWinningMove(b, "O");
    if (move !== null) return move;
    // 2) Bloquer le joueur s'il peut gagner
    move = findWinningMove(b, "X");
    if (move !== null) return move;
    // 3) Prendre le centre si libre
    if (!b[4]) return 4;
    // 4) Sinon coup aléatoire
    return randomMove(b);
  }

  /* -------------------- IA : aléatoire (mode Facile) -------------------- */
  function randomMove(b) {
    const options = emptyCells(b);
    return options[Math.floor(Math.random() * options.length)];
  }

  function computeAiMove(b) {
    if (difficulty === "facile") return randomMove(b);
    if (difficulty === "moyen") return bestMoveMoyen(b);
    return bestMoveMinimax(b);
  }

  /* -------------------- Rendu -------------------- */
  function renderBoard() {
    els.board.innerHTML = "";
    board.forEach((val, i) => {
      const cell = document.createElement("button");
      cell.className = "morpion-cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Case ${i + 1}${val ? ", occupée par " + val : ", libre"}`);
      if (val) {
        cell.classList.add("filled", val === "X" ? "mark-x" : "mark-o");
        cell.textContent = val;
      }
      cell.addEventListener("click", () => handlePlayerMove(i));
      els.board.appendChild(cell);
    });
  }

  function highlightWinLine(line) {
    if (!line) return;
    const cells = els.board.children;
    line.forEach((i) => cells[i].classList.add("win-line"));
  }

  function updateScoreboard() {
    const stats = window.MG.Storage.getGameStats("morpion");
    els.v.textContent = stats.victoires;
    els.d.textContent = stats.defaites;
    els.n.textContent = stats.egalites;
  }

  function renderHistory() {
    const stats = window.MG.Storage.getGameStats("morpion");
    const derniers = stats.historique.slice(0, 12);
    if (derniers.length === 0) {
      els.history.innerHTML = `<p class="empty-note">Aucune partie jouée pour l'instant.</p>`;
      return;
    }
    els.history.innerHTML = derniers.map((entry) => {
      const cls = entry.resultat === "victoire" ? "win" : entry.resultat === "defaite" ? "lose" : "draw";
      const symbole = entry.resultat === "victoire" ? "Victoire" : entry.resultat === "defaite" ? "Défaite" : "Nul";
      return `<span class="history-chip ${cls}">${symbole} · ${entry.difficulte || "?"}</span>`;
    }).join("");
  }

  /* -------------------- Déroulement d'une partie -------------------- */
  function handlePlayerMove(index) {
    if (gameOver || board[index]) return;
    board[index] = "X";
    window.MG.Sound.clic();
    renderBoard();

    const result = checkWinner(board);
    if (result) return endGame(result);

    els.turn.textContent = "L'IA réfléchit...";
    setChoicesDisabled(true);

    setTimeout(() => {
      const aiIndex = computeAiMove(board);
      if (aiIndex !== undefined && aiIndex !== null) {
        board[aiIndex] = "O";
      }
      renderBoard();
      const result2 = checkWinner(board);
      if (result2) return endGame(result2);
      els.turn.textContent = "À vous de jouer (X)";
      setChoicesDisabled(false);
    }, 480);
  }

  function setChoicesDisabled(disabled) {
    Array.from(els.board.children).forEach((cell) => {
      cell.style.pointerEvents = disabled ? "none" : "";
    });
  }

  function endGame(result) {
    gameOver = true;
    let resultat;
    if (result.winner === "X") {
      resultat = "victoire";
      els.turn.textContent = "🎉 Vous avez gagné !";
      window.MG.Sound.victoire();
      window.MG.UI.launchConfetti(70);
    } else if (result.winner === "O") {
      resultat = "defaite";
      els.turn.textContent = "L'IA remporte la partie.";
      window.MG.Sound.defaite();
      window.MG.UI.shakeScreen();
    } else {
      resultat = "egalite";
      els.turn.textContent = "Match nul !";
      window.MG.Sound.egalite();
    }

    highlightWinLine(result.line);
    window.MG.Storage.recordResult("morpion", resultat, { difficulte: difficulty });
    updateScoreboard();
    renderHistory();
    window.MG.UI.refreshGlobalScore();

    if (window.MG.App && window.MG.App.onGameResult) {
      window.MG.App.onGameResult("morpion", resultat, { difficulte: difficulty });
    }
  }

  /* -------------------- Sélection de la difficulté -------------------- */
  function setDifficulty(level) {
    difficulty = level;
    els.diffBtns.forEach((btn) => {
      const active = btn.dataset.diff === level;
      btn.setAttribute("aria-checked", String(active));
    });
    window.MG.Storage.updateSettings({ morpionDifficulte: level });
  }

  function resetRound() {
    board = Array(9).fill(null);
    gameOver = false;
    els.turn.textContent = "À vous de jouer (X)";
    renderBoard();
  }

  function init() {
    cacheEls();
    difficulty = window.MG.Storage.getSettings().morpionDifficulte || "difficile";
    els.diffBtns.forEach((btn) => {
      btn.setAttribute("aria-checked", String(btn.dataset.diff === difficulty));
      btn.addEventListener("click", () => {
        setDifficulty(btn.dataset.diff);
        resetRound();
      });
    });
    updateScoreboard();
    renderHistory();
    resetRound();
  }

  window.MG = window.MG || {};
  window.MG.Morpion = { init, resetRound };
})();
