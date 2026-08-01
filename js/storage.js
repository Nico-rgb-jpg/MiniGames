/* ==========================================================================
   MODULE : STORAGE
   Gère toute la persistance locale (localStorage).
   Expose window.MG.Storage
   ========================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "miniGames.v1";

  // Structure de données par défaut, créée au tout premier lancement.
  function defaultData() {
    return {
      // Statistiques globales (toutes parties confondues)
      global: {
        parties: 0,
        victoires: 0,
        defaites: 0,
        egalites: 0,
        meilleureSerie: 0,
        serieActuelle: 0,
        tempsJeuTotalMs: 0,
      },
      // Statistiques détaillées par jeu
      jeux: {
        chifoumi: { parties: 0, victoires: 0, defaites: 0, egalites: 0, historique: [] },
        morpion:  { parties: 0, victoires: 0, defaites: 0, egalites: 0, historique: [] },
        bataille: { parties: 0, victoires: 0, defaites: 0, egalites: 0, historique: [], meilleurTempsMs: null, meilleurePrecision: 0 },
      },
      // Préférences utilisateur
      settings: {
        theme: "dark",
        soundOn: true,
        volume: 60,
        animationsOn: true,
        morpionDifficulte: "difficile",
      },
      // Succès débloqués (liste d'identifiants)
      achievements: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      // Fusion défensive avec les valeurs par défaut pour gérer les versions futures
      const base = defaultData();
      return deepMerge(base, parsed);
    } catch (err) {
      console.warn("[Storage] Lecture impossible, réinitialisation.", err);
      return defaultData();
    }
  }

  function deepMerge(base, override) {
    if (typeof override !== "object" || override === null) return base;
    const result = Array.isArray(base) ? base.slice() : { ...base };
    for (const key of Object.keys(base)) {
      if (override[key] === undefined) continue;
      if (typeof base[key] === "object" && base[key] !== null && !Array.isArray(base[key])) {
        result[key] = deepMerge(base[key], override[key]);
      } else {
        result[key] = override[key];
      }
    }
    return result;
  }

  let data = load();
  let saveTimer = null;

  function persist() {
    // Écriture différée légèrement (debounce) pour éviter les écritures trop fréquentes
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn("[Storage] Écriture impossible (quota dépassé ?).", err);
      }
    }, 120);
  }

  const Storage = {
    /** Retourne l'intégralité des données (lecture seule recommandée). */
    getAll() {
      return data;
    },

    getGlobal() {
      return data.global;
    },

    getGameStats(gameId) {
      return data.jeux[gameId];
    },

    getSettings() {
      return data.settings;
    },

    getAchievements() {
      return data.achievements;
    },

    updateSettings(patch) {
      data.settings = { ...data.settings, ...patch };
      persist();
    },

    /**
     * Enregistre le résultat d'une manche/partie.
     * @param {string} gameId - "chifoumi" | "morpion" | "bataille"
     * @param {"victoire"|"defaite"|"egalite"} resultat
     * @param {object} [entryExtra] - données additionnelles pour l'historique (ex: durée)
     */
    recordResult(gameId, resultat, entryExtra = {}) {
      const g = data.global;
      const j = data.jeux[gameId];

      g.parties++;
      j.parties++;

      if (resultat === "victoire") {
        g.victoires++; j.victoires++;
        g.serieActuelle++;
        g.meilleureSerie = Math.max(g.meilleureSerie, g.serieActuelle);
      } else if (resultat === "defaite") {
        g.defaites++; j.defaites++;
        g.serieActuelle = 0;
      } else {
        g.egalites++; j.egalites++;
      }

      const entry = { resultat, date: Date.now(), ...entryExtra };
      j.historique.unshift(entry);
      if (j.historique.length > 30) j.historique.length = 30;

      persist();
      return entry;
    },

    addTempsJeu(ms) {
      data.global.tempsJeuTotalMs += ms;
      persist();
    },

    unlockAchievement(id) {
      if (data.achievements.includes(id)) return false;
      data.achievements.push(id);
      persist();
      return true;
    },

    setBatailleRecord({ tempsMs, precision }) {
      const b = data.jeux.bataille;
      if (tempsMs != null && (b.meilleurTempsMs == null || tempsMs < b.meilleurTempsMs)) {
        b.meilleurTempsMs = tempsMs;
      }
      if (precision != null && precision > b.meilleurePrecision) {
        b.meilleurePrecision = precision;
      }
      persist();
    },

    resetStats() {
      const fresh = defaultData();
      data.global = fresh.global;
      data.jeux = fresh.jeux;
      data.achievements = [];
      persist();
    },

    resetAll() {
      data = defaultData();
      persist();
    },
  };

  window.MG = window.MG || {};
  window.MG.Storage = Storage;
})();
