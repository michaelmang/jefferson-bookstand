/**
 * Shared Web Audio graph for the study — no audio assets, but tuned for
 * realism rather than bleeps:
 *
 * - Détente clicks use modal synthesis: a wood body rings at inharmonic
 *   partials (like a bar of walnut), under a contact-noise tick and a low
 *   knock, with per-click random detuning so no two clicks are identical.
 * - The "open window" ambience is pink-noise wind whose gusts also drive a
 *   correlated leaf rustle, plus birds outside synthesized as species-like
 *   motifs (whistles, trills, chip series, warbles) at varying distances.
 * - Everything passes partly through a small convolution reverb whose
 *   impulse response is generated on the fly, which gives the room air.
 *
 * The AudioContext is created lazily on a user gesture (browsers block
 * audio before one).
 */

/** Inharmonic partials of a struck hardwood bar: ratio, level, decay seconds. */
const WOOD_MODES: [number, number, number][] = [
  [1.0, 1.0, 0.09],
  [2.32, 0.55, 0.055],
  [3.85, 0.35, 0.04],
  [5.9, 0.2, 0.025],
  [8.1, 0.12, 0.015],
];

type BirdSpecies = "whistle" | "trill" | "chips" | "warble";
const SPECIES: BirdSpecies[] = ["whistle", "trill", "chips", "warble"];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

class StudyAudio {
  private ctx: AudioContext | null = null;
  private clickGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbReturn: GainNode | null = null;
  private ambienceStop: (() => void) | null = null;
  private birdTimer: number | null = null;
  private pinkCache: AudioBuffer | null = null;

  clicksEnabled = true;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      if (!window.AudioContext) return;
      this.ctx = new AudioContext();

      // Small-room reverb: generated stereo impulse response, ~0.7s decay
      // with a darkening tail (each sample lowpassed a bit more than the last).
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulseResponse(0.7);
      this.reverbReturn = this.ctx.createGain();
      this.reverbReturn.gain.value = 0.9;
      this.reverb.connect(this.reverbReturn);
      this.reverbReturn.connect(this.ctx.destination);

      this.clickGain = this.ctx.createGain();
      this.clickGain.gain.value = 0.5;
      this.clickGain.connect(this.ctx.destination);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.5;
      this.ambienceGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private impulseResponse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lowpassed = 0;
      for (let i = 0; i < length; i++) {
        const progress = i / length;
        // Tail darkens over time: the lowpass coefficient tightens with progress.
        const alpha = 0.55 - 0.4 * progress;
        lowpassed += alpha * (Math.random() * 2 - 1 - lowpassed);
        data[i] = lowpassed * Math.exp(-4.5 * progress);
      }
    }
    return buffer;
  }

  /** Two seconds of looping pink noise (Paul Kellet's economy filter). */
  private pinkBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.pinkCache) return this.pinkCache;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    this.pinkCache = buffer;
    return buffer;
  }

  /**
   * A struck-wood détente: contact tick + inharmonic body modes + low knock.
   * Every click detunes and re-levels slightly so the mechanism sounds like
   * wood on wood, not a sampler.
   */
  playDetentClick(intensity = 1) {
    if (!this.clicksEnabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.clickGain || !this.reverb) return;
    const t = ctx.currentTime;
    const level = Math.min(1, Math.max(0.15, intensity));
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.clickGain);
    const send = ctx.createGain();
    send.gain.value = 0.12;
    out.connect(send);
    send.connect(this.reverb);

    // Contact tick: a few milliseconds of bright filtered noise.
    const tick = ctx.createBufferSource();
    tick.buffer = this.pinkBuffer();
    tick.playbackRate.value = rand(0.9, 1.1);
    const tickFilter = ctx.createBiquadFilter();
    tickFilter.type = "bandpass";
    tickFilter.frequency.value = rand(2400, 3400);
    tickFilter.Q.value = 0.8;
    const tickEnv = ctx.createGain();
    tickEnv.gain.setValueAtTime(0.9 * level, t);
    tickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    tick.connect(tickFilter);
    tickFilter.connect(tickEnv);
    tickEnv.connect(out);
    tick.start(t, rand(0, 1.5));
    tick.stop(t + 0.03);

    // Wood body: inharmonic decaying partials, detuned a little each strike.
    const base = 175 * rand(0.96, 1.04);
    for (const [ratio, gain, decay] of WOOD_MODES) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = base * ratio * rand(0.99, 1.01);
      const env = ctx.createGain();
      const d = decay * rand(0.85, 1.2);
      env.gain.setValueAtTime(0.22 * gain * level, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + d);
      osc.connect(env);
      env.connect(out);
      osc.start(t);
      osc.stop(t + d + 0.02);
    }

    // Low knock: the mass of the stand landing in its détente.
    const knock = ctx.createOscillator();
    knock.type = "sine";
    knock.frequency.setValueAtTime(112 * rand(0.95, 1.05), t);
    knock.frequency.exponentialRampToValueAtTime(78, t + 0.05);
    const knockEnv = ctx.createGain();
    knockEnv.gain.setValueAtTime(0.3 * level, t);
    knockEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    knock.connect(knockEnv);
    knockEnv.connect(out);
    knock.start(t);
    knock.stop(t + 0.1);
  }

  get ambienceRunning(): boolean {
    return this.ambienceStop !== null;
  }

  /**
   * The open window: pink-noise wind whose gusts (two slow, incommensurate
   * LFOs) modulate both the lowpass cutoff and the level — and the same
   * gusts drive a high leaf-rustle band, so the leaves stir exactly when
   * the wind picks up. Birds call outside at random distances.
   */
  startAmbience() {
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || !this.ambienceGain || !this.reverb || this.ambienceStop) return;

    const wind = ctx.createBufferSource();
    wind.buffer = this.pinkBuffer();
    wind.loop = true;
    const rumbleCut = ctx.createBiquadFilter();
    rumbleCut.type = "highpass";
    rumbleCut.frequency.value = 45;
    const windLow = ctx.createBiquadFilter();
    windLow.type = "lowpass";
    windLow.frequency.value = 320;
    windLow.Q.value = 0.3;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.28;

    const rustle = ctx.createBufferSource();
    rustle.buffer = this.pinkBuffer();
    rustle.loop = true;
    rustle.playbackRate.value = 1.31; // decorrelate from the wind layer
    const rustleBand = ctx.createBiquadFilter();
    rustleBand.type = "bandpass";
    rustleBand.frequency.value = 2600;
    rustleBand.Q.value = 0.5;
    const rustleGain = ctx.createGain();
    rustleGain.gain.value = 0.02;

    // Gusts: two slow sines at incommensurate rates sum to a wandering,
    // never-repeating swell. Depths stay below the base values so the
    // modulation can't push a gain negative.
    const lfoNodes: (OscillatorNode | GainNode)[] = [];
    const addLfo = (rate: number, target: AudioParam, depth: number) => {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depthGain = ctx.createGain();
      depthGain.gain.value = depth;
      lfo.connect(depthGain);
      depthGain.connect(target);
      lfo.start();
      lfoNodes.push(lfo, depthGain);
    };
    addLfo(0.043, windLow.frequency, 110);
    addLfo(0.117, windLow.frequency, 55);
    addLfo(0.043, windGain.gain, 0.11);
    addLfo(0.117, windGain.gain, 0.06);
    addLfo(0.043, rustleGain.gain, 0.014);
    addLfo(0.117, rustleGain.gain, 0.005);
    // Leaf flutter: a faster shimmer on the rustle band alone.
    addLfo(3.7, rustleGain.gain, 0.003);

    wind.connect(rumbleCut);
    rumbleCut.connect(windLow);
    windLow.connect(windGain);
    windGain.connect(this.ambienceGain);
    rustle.connect(rustleBand);
    rustleBand.connect(rustleGain);
    rustleGain.connect(this.ambienceGain);
    const windSend = ctx.createGain();
    windSend.gain.value = 0.06;
    windGain.connect(windSend);
    windSend.connect(this.reverb);
    wind.start();
    rustle.start(0, 0.7);

    const scheduleBird = () => {
      this.birdTimer = window.setTimeout(
        () => {
          this.birdCall();
          // Sometimes a second bird answers from elsewhere.
          if (Math.random() < 0.3) {
            this.birdTimer = window.setTimeout(
              () => {
                this.birdCall();
                scheduleBird();
              },
              rand(900, 2200),
            );
          } else {
            scheduleBird();
          }
        },
        rand(3000, 9000),
      );
    };
    scheduleBird();

    this.ambienceStop = () => {
      wind.stop();
      rustle.stop();
      for (const node of lfoNodes) {
        if (node instanceof OscillatorNode) node.stop();
      }
      for (const node of [
        wind,
        rumbleCut,
        windLow,
        windGain,
        windSend,
        rustle,
        rustleBand,
        rustleGain,
        ...lfoNodes,
      ]) {
        node.disconnect();
      }
    };
  }

  stopAmbience() {
    if (this.birdTimer !== null) {
      window.clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
    this.ambienceStop?.();
    this.ambienceStop = null;
  }

  setAmbienceVolume(volume: number) {
    if (this.ambienceGain) this.ambienceGain.gain.value = volume;
  }

  /**
   * One bird, one motif. Distance shapes gain, brightness, and how much of
   * the call arrives via the reverb rather than directly.
   */
  private birdCall() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.ambienceGain || !this.reverb) return;
    const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
    const distance = rand(0.25, 1); // 1 = near the window
    const out = ctx.createGain();
    out.gain.value = 0.14 * distance * distance;
    const muffle = ctx.createBiquadFilter();
    muffle.type = "lowpass";
    muffle.frequency.value = 2500 + 5500 * distance;
    const panner = ctx.createStereoPanner();
    panner.pan.value = rand(-0.85, 0.85);
    out.connect(muffle);
    muffle.connect(panner);
    panner.connect(this.ambienceGain);
    const send = ctx.createGain();
    send.gain.value = 0.5 * (1 - distance) + 0.08;
    panner.connect(send);
    send.connect(this.reverb);

    let t = ctx.currentTime + 0.05;
    const syllable = (
      f0: number,
      f1: number,
      duration: number,
      peak: number,
      fmRate = 0,
      fmDepth = 0,
    ) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + duration);
      if (fmRate > 0) {
        const mod = ctx.createOscillator();
        mod.frequency.value = fmRate;
        const modDepth = ctx.createGain();
        modDepth.gain.value = fmDepth;
        mod.connect(modDepth);
        modDepth.connect(osc.frequency);
        mod.start(t);
        mod.stop(t + duration + 0.02);
      }
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, duration * 0.3));
      env.gain.setValueAtTime(peak, t + duration * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(env);
      env.connect(out);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    };

    switch (species) {
      case "whistle": {
        // Two clear descending whistles with a touch of vibrato.
        const f = rand(2600, 3600);
        syllable(f, f * 0.82, rand(0.3, 0.45), 0.5, 5.5, f * 0.012);
        t += rand(0.12, 0.25);
        syllable(f * 0.9, f * 0.7, rand(0.25, 0.4), 0.42, 5.5, f * 0.012);
        break;
      }
      case "trill": {
        // One sustained trill: fast FM on a high carrier.
        const f = rand(3000, 4400);
        syllable(f, f * rand(0.9, 1.08), rand(0.45, 0.85), 0.4, rand(16, 26), rand(280, 620));
        break;
      }
      case "chips": {
        // A series of sharp little down-chips.
        const n = 3 + Math.floor(Math.random() * 5);
        const f = rand(3600, 5000);
        for (let i = 0; i < n; i++) {
          syllable(f * rand(0.97, 1.03), f * 0.62, rand(0.035, 0.06), 0.45);
          t += rand(0.08, 0.13);
        }
        break;
      }
      case "warble": {
        // Robin-like phrase: alternating up- and down-sweeps, then a pause,
        // then usually a shorter second phrase.
        const phrase = (count: number) => {
          for (let i = 0; i < count; i++) {
            const f = rand(2000, 3200);
            const up = i % 2 === 0;
            syllable(up ? f : f * 1.35, up ? f * 1.35 : f, rand(0.09, 0.16), 0.45);
            t += rand(0.02, 0.06);
          }
        };
        phrase(2 + Math.floor(Math.random() * 3));
        if (Math.random() < 0.7) {
          t += rand(0.25, 0.5);
          phrase(2);
        }
        break;
      }
    }
  }
}

export const studyAudio = new StudyAudio();
