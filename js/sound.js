/* ==========================================================================
   MODULE : SOUND
   Génère tous les effets sonores directement via la Web Audio API.
   Aucun fichier binaire requis : le site reste 100% autonome et léger,
   et fonctionne même en ouvrant index.html directement (file://).
   Expose window.MG.Sound
   ========================================================================== */
(function () {
  "use strict";

  let ctx = null;
  let enabled = true;
  let volume = 0.6; // 0..1

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    // Certains navigateurs suspendent le contexte tant qu'aucune interaction n'a eu lieu.
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /**
   * Joue une simple note synthétisée (oscillateur + enveloppe).
   */
  function tone({ freq = 440, duration = 0.15, type = "sine", startGain = 0.25, delay = 0 }) {
    const audioCtx = getContext();
    if (!audioCtx || !enabled) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);

    const g = startGain * volume;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(Math.max(g, 0.0001), audioCtx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + duration + 0.02);
  }

  /** Bruit blanc court (utile pour explosions / touches) */
  function noiseBurst({ duration = 0.25, startGain = 0.3, delay = 0, filterFreq = 1200 }) {
    const audioCtx = getContext();
    if (!audioCtx || !enabled) return;

    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;

    const gain = audioCtx.createGain();
    const g = startGain * volume;
    gain.gain.setValueAtTime(Math.max(g, 0.0001), audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(audioCtx.currentTime + delay);
  }

  const Sound = {
    setEnabled(value) { enabled = !!value; },
    setVolume(v01to100) { volume = Math.max(0, Math.min(100, v01to100)) / 100; },

    clic() {
      tone({ freq: 620, duration: 0.08, type: "triangle", startGain: 0.18 });
    },
    victoire() {
      tone({ freq: 523.25, duration: 0.14, type: "square", startGain: 0.2 });
      tone({ freq: 659.25, duration: 0.14, type: "square", startGain: 0.2, delay: 0.12 });
      tone({ freq: 783.99, duration: 0.22, type: "square", startGain: 0.22, delay: 0.24 });
    },
    defaite() {
      tone({ freq: 300, duration: 0.18, type: "sawtooth", startGain: 0.2 });
      tone({ freq: 220, duration: 0.22, type: "sawtooth", startGain: 0.2, delay: 0.14 });
      tone({ freq: 160, duration: 0.3, type: "sawtooth", startGain: 0.2, delay: 0.28 });
    },
    egalite() {
      tone({ freq: 440, duration: 0.16, type: "sine", startGain: 0.18 });
      tone({ freq: 440, duration: 0.16, type: "sine", startGain: 0.18, delay: 0.18 });
    },
    placementBateau() {
      tone({ freq: 380, duration: 0.08, type: "square", startGain: 0.15 });
      tone({ freq: 480, duration: 0.08, type: "square", startGain: 0.15, delay: 0.06 });
    },
    explosion() {
      noiseBurst({ duration: 0.35, startGain: 0.35, filterFreq: 900 });
      tone({ freq: 90, duration: 0.3, type: "sawtooth", startGain: 0.25 });
    },
    touche() {
      noiseBurst({ duration: 0.2, startGain: 0.25, filterFreq: 1600 });
      tone({ freq: 700, duration: 0.1, type: "triangle", startGain: 0.15 });
    },
    manque() {
      tone({ freq: 260, duration: 0.12, type: "sine", startGain: 0.14 });
    },
    achievement() {
      tone({ freq: 660, duration: 0.1, type: "sine", startGain: 0.2 });
      tone({ freq: 880, duration: 0.1, type: "sine", startGain: 0.2, delay: 0.1 });
      tone({ freq: 1108.73, duration: 0.2, type: "sine", startGain: 0.22, delay: 0.2 });
    },
  };

  window.MG = window.MG || {};
  window.MG.Sound = Sound;
})();
