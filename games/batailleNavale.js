/* ==========================================================================
   MODULE : BATAILLE NAVALE
   Grilles 10x10. Placement manuel des bateaux (rotation, aperçu, validation),
   IA de placement aléatoire, et IA de tir "chasse / cible" qui :
   - ne tire jamais deux fois au même endroit
   - recherche intelligemment un bateau après une touche
   - termine un bateau avant d'en chercher un autre
   Expose window.MG.Bataille
   ========================================================================== */
(function () {
  "use strict";

  const SIZE = 10;
  const SHIP_DEFS = [
    { id: "porte-avions", name: "Porte-avions", size: 5 },
    { id: "croiseur", name: "Croiseur", size: 4 },
    { id: "contre-torpilleur", name: "Contre-torpilleur", size: 3 },
    { id: "sous-marin", name: "Sous-marin", size: 3 },
    { id: "patrouilleur", name: "Patrouilleur", size: 2 },
  ];

  let els = {};

  // ---- État de la partie ----
  let orientation = "horizontal"; // "horizontal" | "vertical"
  let selectedShipId = null;
  let hoverIndex = null;

  let playerShips = [];   // { ...def, cells: [idx,...], hits: Set }
  let aiShips = [];
  let playerFiredByAi = new Set(); // cases de la grille JOUEUR déjà touchées par l'IA
  let aiFiredByPlayer = new Set(); // cases de la grille IA déjà touchées par le joueur

  let aiMode = "hunt"; // "hunt" | "target"
  let aiTargetQueue = [];
  let aiCurrentHits = [];

  let phase = "placement"; // "placement" | "jeu" | "fin"
  let turn = "joueur"; // "joueur" | "ia"
  let timerInterval = null;
  let startTime = null;
  let shotsFired = 0;
  let shotsHit = 0;

  /* -------------------- Cache DOM -------------------- */
  function cacheEls() {
    els.placementSection = document.getElementById("bataille-placement");
    els.jeuSection = document.getElementById("bataille-jeu");
    els.gridPlacement = document.getElementById("grid-placement");
    els.gridPlayer = document.getElementById("grid-player");
    els.gridEnemy = document.getElementById("grid-enemy");
    els.shipsTray = document.getElementById("ships-tray");
    els.btnRotate = document.getElementById("btn-rotate");
    els.btnRandom = document.getElementById("btn-random-placement");
    els.btnConfirm = document.getElementById("btn-confirm-placement");
    els.turnLabel = document.getElementById("bataille-turn");
    els.precision = document.getElementById("bataille-precision");
    els.tirs = document.getElementById("bataille-tirs");
    els.temps = document.getElementById("bataille-temps");
    els.shipsLeftPlayer = document.getElementById("ships-left-player");
    els.shipsLeftAi = document.getElementById("ships-left-ai");
    els.log = document.getElementById("bataille-log");
  }

  /* -------------------- Utilitaires grille -------------------- */
  function rowOf(i) { return Math.floor(i / SIZE); }
  function colOf(i) { return i % SIZE; }
  function coordLabel(i) { return String.fromCharCode(65 + colOf(i)) + (rowOf(i) + 1); }
  function inBounds(row, col) { return row >= 0 && row < SIZE && col >= 0 && col < SIZE; }

  function computeCells(anchorIndex, size, orient) {
    const row = rowOf(anchorIndex), col = colOf(anchorIndex);
    const cells = [];
    for (let k = 0; k < size; k++) {
      const r = orient === "vertical" ? row + k : row;
      const c = orient === "horizontal" ? col + k : col;
      if (!inBounds(r, c)) return null;
      cells.push(r * SIZE + c);
    }
    return cells;
  }

  function neighborsOrtho(i) {
    const row = rowOf(i), col = colOf(i);
    const list = [];
    if (row > 0) list.push(i - SIZE);
    if (row < SIZE - 1) list.push(i + SIZE);
    if (col > 0) list.push(i - 1);
    if (col < SIZE - 1) list.push(i + 1);
    return list;
  }

  function overlaps(cells, existingShips) {
    const occupied = new Set(existingShips.flatMap((s) => s.cells));
    return cells.some((c) => occupied.has(c));
  }

  /* -------------------- Génération des grilles vides -------------------- */
  function buildGrid(container, { clickable, onClick, onHover, onLeave }) {
    container.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "bataille-cell";
      cell.dataset.index = i;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", coordLabel(i));
      if (clickable) {
        cell.tabIndex = 0;
        cell.addEventListener("click", () => onClick(i));
        cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(i); } });
      }
      if (onHover) cell.addEventListener("mouseenter", () => onHover(i));
      if (onLeave) cell.addEventListener("mouseleave", onLeave);
      container.appendChild(cell);
    }
  }

  /* ============================================================
     PHASE DE PLACEMENT
     ============================================================ */
  function initPlacement() {
    orientation = "horizontal";
    selectedShipId = SHIP_DEFS[0].id;
    hoverIndex = null;
    playerShips = [];

    renderShipsTray();
    buildGrid(els.gridPlacement, {
      clickable: true,
      onClick: handlePlacementClick,
      onHover: (i) => { hoverIndex = i; renderPlacementPreview(); },
      onLeave: () => { hoverIndex = null; renderPlacementPreview(); },
    });
    renderPlacementPreview();
    updateConfirmState();
  }

  function renderShipsTray() {
    els.shipsTray.innerHTML = "";
    SHIP_DEFS.forEach((def) => {
      const placed = playerShips.some((s) => s.id === def.id);
      const item = document.createElement("div");
      item.className = "ship-item" + (placed ? " placed" : "") + (selectedShipId === def.id ? " selected" : "");
      item.innerHTML = `
        <span class="ship-item__name">${def.name} (${def.size})</span>
        <span class="ship-item__cells">${"<span class='ship-item__cell'></span>".repeat(def.size)}</span>
      `;
      if (!placed) {
        item.style.cursor = "pointer";
        item.addEventListener("click", () => {
          selectedShipId = def.id;
          renderShipsTray();
          renderPlacementPreview();
        });
      }
      els.shipsTray.appendChild(item);
    });
  }

  function renderPlacementPreview() {
    const cells = els.gridPlacement.children;
    Array.from(cells).forEach((c) => c.classList.remove("preview-ok", "preview-bad", "ship"));

    // Affiche les bateaux déjà posés
    playerShips.forEach((ship) => {
      ship.cells.forEach((idx) => cells[idx].classList.add("ship"));
    });

    if (hoverIndex === null || !selectedShipId) return;
    const def = SHIP_DEFS.find((d) => d.id === selectedShipId);
    const proposed = computeCells(hoverIndex, def.size, orientation);
    if (!proposed) return;

    const valid = !overlaps(proposed, playerShips);
    proposed.forEach((idx) => {
      cells[idx].classList.add(valid ? "preview-ok" : "preview-bad");
    });
  }

  function handlePlacementClick(index) {
    if (!selectedShipId) return;
    const def = SHIP_DEFS.find((d) => d.id === selectedShipId);
    const cells = computeCells(index, def.size, orientation);
    if (!cells || overlaps(cells, playerShips)) {
      window.MG.Sound.manque();
      return;
    }
    playerShips.push({ ...def, cells, hits: new Set(), sunk: false });
    window.MG.Sound.placementBateau();

    const next = SHIP_DEFS.find((d) => !playerShips.some((s) => s.id === d.id));
    selectedShipId = next ? next.id : null;

    renderShipsTray();
    renderPlacementPreview();
    updateConfirmState();
  }

  function randomPlacementFor(shipList) {
    const placed = [];
    SHIP_DEFS.forEach((def) => {
      let attempts = 0;
      while (attempts < 500) {
        attempts++;
        const orient = Math.random() < 0.5 ? "horizontal" : "vertical";
        const anchor = Math.floor(Math.random() * SIZE * SIZE);
        const cells = computeCells(anchor, def.size, orient);
        if (cells && !overlaps(cells, placed)) {
          placed.push({ ...def, cells, hits: new Set(), sunk: false });
          break;
        }
      }
    });
    return placed;
  }

  function handleRandomPlacement() {
    playerShips = randomPlacementFor(playerShips);
    selectedShipId = null;
    renderShipsTray();
    renderPlacementPreview();
    updateConfirmState();
    window.MG.Sound.placementBateau();
  }

  function updateConfirmState() {
    els.btnConfirm.disabled = playerShips.length < SHIP_DEFS.length;
  }

  function toggleRotation() {
    orientation = orientation === "horizontal" ? "vertical" : "horizontal";
    renderPlacementPreview();
    window.MG.Sound.clic();
  }

  /* ============================================================
     DÉMARRAGE DE LA PARTIE
     ============================================================ */
  function startBattle() {
    aiShips = randomPlacementFor([]);
    aiFiredByPlayer = new Set();
    playerFiredByAi = new Set();
    aiMode = "hunt";
    aiTargetQueue = [];
    aiCurrentHits = [];
    shotsFired = 0;
    shotsHit = 0;
    turn = "joueur";
    phase = "jeu";

    els.placementSection.hidden = true;
    els.jeuSection.hidden = false;

    buildGrid(els.gridPlayer, { clickable: false });
    buildGrid(els.gridEnemy, { clickable: true, onClick: handlePlayerShot });
    paintPlayerGrid();
    paintEnemyGrid();
    updateShipsLeft();
    updateStats();
    els.log.innerHTML = "";
    logEvent("⚓ La bataille commence. Bonne chance amiral !");
    els.turnLabel.textContent = "À vous de tirer";

    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    const elapsed = Date.now() - startTime;
    const s = Math.floor(elapsed / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    els.temps.textContent = `${mm}:${ss}`;
  }

  function paintPlayerGrid() {
    const cells = els.gridPlayer.children;
    Array.from(cells).forEach((c) => c.className = "bataille-cell disabled");
    playerShips.forEach((ship) => ship.cells.forEach((idx) => cells[idx].classList.add("ship")));
    playerFiredByAi.forEach((idx) => {
      const isHit = playerShips.some((s) => s.cells.includes(idx));
      cells[idx].classList.add(isHit ? "hit" : "miss");
    });
    playerShips.filter((s) => s.sunk).forEach((s) => s.cells.forEach((idx) => cells[idx].classList.add("sunk")));
  }

  function paintEnemyGrid() {
    const cells = els.gridEnemy.children;
    Array.from(cells).forEach((c) => { c.className = "bataille-cell"; });
    aiFiredByPlayer.forEach((idx) => {
      const isHit = aiShips.some((s) => s.cells.includes(idx));
      cells[idx].classList.add(isHit ? "hit" : "miss");
      cells[idx].classList.add("disabled");
    });
    aiShips.filter((s) => s.sunk).forEach((s) => s.cells.forEach((idx) => { cells[idx].classList.add("sunk"); }));
  }

  function updateShipsLeft() {
    const pLeft = playerShips.filter((s) => !s.sunk).length;
    const aLeft = aiShips.filter((s) => !s.sunk).length;
    els.shipsLeftPlayer.textContent = `(${pLeft} restants)`;
    els.shipsLeftAi.textContent = `(${aLeft} restants)`;
  }

  function updateStats() {
    const precision = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
    els.precision.textContent = `Précision : ${precision}%`;
    els.tirs.textContent = `Tirs : ${shotsFired}`;
  }

  function logEvent(text) {
    const p = document.createElement("p");
    p.className = "log-entry";
    p.textContent = text;
    els.log.prepend(p);
  }

  /* -------------------- Tir du joueur -------------------- */
  function handlePlayerShot(index) {
    if (phase !== "jeu" || turn !== "joueur" || aiFiredByPlayer.has(index)) return;

    aiFiredByPlayer.add(index);
    shotsFired++;

    const targetShip = aiShips.find((s) => s.cells.includes(index));
    if (targetShip) {
      targetShip.hits.add(index);
      shotsHit++;
      window.MG.Sound.touche();
      logEvent(`💥 Vous touchez en ${coordLabel(index)} !`);
      if (targetShip.hits.size === targetShip.size) {
        targetShip.sunk = true;
        logEvent(`🚢 Vous avez coulé : ${targetShip.name} !`);
        window.MG.UI.showToast({ icon: "🎯", title: `${targetShip.name} coulé !`, desc: "Bien joué, amiral." });
      }
    } else {
      window.MG.Sound.manque();
      logEvent(`〰️ Vous manquez en ${coordLabel(index)}.`);
    }

    paintEnemyGrid();
    updateShipsLeft();
    updateStats();

    if (aiShips.every((s) => s.sunk)) return endBattle("victoire");

    // Si touché, le joueur rejoue (règle classique : un tir réussi redonne la main) — sinon tour de l'IA
    if (!targetShip) {
      turn = "ia";
      els.turnLabel.textContent = "L'IA vise...";
      setTimeout(aiTurn, 700);
    } else {
      els.turnLabel.textContent = "Touché ! Rejouez.";
    }
  }

  /* -------------------- Tir de l'IA (chasse / cible) -------------------- */
  function aiChooseTarget() {
    // Vide la file des cibles des cases déjà tirées
    aiTargetQueue = aiTargetQueue.filter((i) => !playerFiredByAi.has(i));

    if (aiTargetQueue.length > 0) {
      return aiTargetQueue.shift();
    }
    // Mode chasse : tir aléatoire parmi les cases jamais tirées
    const options = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (!playerFiredByAi.has(i)) options.push(i);
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  function updateAiQueueAfterHit(index) {
    aiCurrentHits.push(index);

    if (aiCurrentHits.length === 1) {
      aiTargetQueue = neighborsOrtho(index).filter((i) => !playerFiredByAi.has(i));
      return;
    }

    const rows = aiCurrentHits.map(rowOf);
    const cols = aiCurrentHits.map(colOf);
    const sameRow = rows.every((r) => r === rows[0]);
    const sameCol = cols.every((c) => c === cols[0]);

    const candidates = [];
    if (sameRow) {
      const row = rows[0];
      const minCol = Math.min(...cols), maxCol = Math.max(...cols);
      if (inBounds(row, minCol - 1)) candidates.push(row * SIZE + (minCol - 1));
      if (inBounds(row, maxCol + 1)) candidates.push(row * SIZE + (maxCol + 1));
    } else if (sameCol) {
      const col = cols[0];
      const minRow = Math.min(...rows), maxRow = Math.max(...rows);
      if (inBounds(minRow - 1, col)) candidates.push((minRow - 1) * SIZE + col);
      if (inBounds(maxRow + 1, col)) candidates.push((maxRow + 1) * SIZE + col);
    } else {
      // Sécurité : ne devrait pas arriver, on retombe sur les voisins du dernier coup
      candidates.push(...neighborsOrtho(index));
    }
    aiTargetQueue = candidates.filter((i) => !playerFiredByAi.has(i));
  }

  function aiTurn() {
    if (phase !== "jeu") return;
    const index = aiChooseTarget();
    if (index === undefined) return; // sécurité : plus aucune case disponible

    playerFiredByAi.add(index);

    const targetShip = playerShips.find((s) => s.cells.includes(index));
    let hitAgain = false;

    if (targetShip) {
      targetShip.hits.add(index);
      window.MG.Sound.touche();
      logEvent(`💢 L'IA vous touche en ${coordLabel(index)} !`);
      hitAgain = true; // une touche redonne la main à l'IA, comme pour le joueur
      if (targetShip.hits.size === targetShip.size) {
        targetShip.sunk = true;
        logEvent(`☠️ L'IA a coulé votre ${targetShip.name} !`);
        aiMode = "hunt";
        aiCurrentHits = [];
        aiTargetQueue = [];
      } else {
        aiMode = "target";
        updateAiQueueAfterHit(index);
      }
    } else {
      window.MG.Sound.manque();
      logEvent(`〰️ L'IA rate en ${coordLabel(index)}.`);
      if (aiMode === "target" && aiTargetQueue.length === 0) {
        aiMode = "hunt";
        aiCurrentHits = [];
      }
    }

    paintPlayerGrid();
    updateShipsLeft();

    if (playerShips.every((s) => s.sunk)) return endBattle("defaite");

    if (hitAgain) {
      els.turnLabel.textContent = "L'IA vise à nouveau...";
      setTimeout(aiTurn, 750);
    } else {
      turn = "joueur";
      els.turnLabel.textContent = "À vous de tirer";
    }
  }

  /* -------------------- Fin de partie -------------------- */
  function endBattle(resultat) {
    phase = "fin";
    clearInterval(timerInterval);
    const tempsMs = Date.now() - startTime;
    const precision = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;

    if (resultat === "victoire") {
      els.turnLabel.textContent = "🏆 Victoire ! Flotte ennemie anéantie.";
      window.MG.Sound.victoire();
      window.MG.UI.launchConfetti(90);
    } else {
      els.turnLabel.textContent = "💀 Défaite... votre flotte a coulé.";
      window.MG.Sound.defaite();
      window.MG.UI.shakeScreen();
    }

    window.MG.Storage.recordResult("bataille", resultat, { tempsMs, precision });
    window.MG.Storage.setBatailleRecord({ tempsMs, precision });
    window.MG.UI.refreshGlobalScore();

    if (window.MG.App && window.MG.App.onGameResult) {
      window.MG.App.onGameResult("bataille", resultat, { tempsMs, precision });
    }

    // Désactive tous les tirs restants
    Array.from(els.gridEnemy.children).forEach((c) => c.classList.add("disabled"));
  }

  /* -------------------- Réinitialisation (bouton Rejouer) -------------------- */
  function resetRound() {
    clearInterval(timerInterval);
    phase = "placement";
    els.placementSection.hidden = false;
    els.jeuSection.hidden = true;
    initPlacement();
  }

  function init() {
    cacheEls();
    els.btnRotate.addEventListener("click", toggleRotation);
    els.btnRandom.addEventListener("click", handleRandomPlacement);
    els.btnConfirm.addEventListener("click", startBattle);
    initPlacement();
  }

  window.MG = window.MG || {};
  window.MG.Bataille = { init, resetRound };
})();
