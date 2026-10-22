// Procedural lo-fi music + small sound effects, all generated with WebAudio (no assets).
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PROG = [
  { pad: [60, 64, 67, 71], bass: 36, scale: [72, 74, 76, 79, 81] },   // Cmaj7
  { pad: [57, 60, 64, 67], bass: 33, scale: [69, 72, 74, 76, 79] },   // Am7
  { pad: [62, 65, 69, 72], bass: 38, scale: [74, 77, 79, 81, 84] },   // Dm7
  { pad: [55, 59, 62, 65], bass: 31, scale: [71, 74, 76, 79, 83] },   // G7
];
const BPM = 74;

export class Sound {
  constructor() {
    let pref = null;
    try { pref = localStorage.getItem('music'); } catch {}
    this.musicOn = pref !== 'off';
    this.ctx = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain(); this.master.gain.value = this.musicOn ? 0.8 : 0; this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.5; this.sfxBus.connect(this.master);

    // music chain: bus -> lofi lowpass -> music gain -> master (+ reverb send)
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
    this.lofi = ctx.createBiquadFilter(); this.lofi.type = 'lowpass'; this.lofi.frequency.value = 3200; this.lofi.connect(this.musicGain);
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9; this.bus.connect(this.lofi);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(2.8);
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.reverb.connect(wet); wet.connect(this.lofi);

    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    return ctx;
  }

  impulse(sec) {
    const ctx = this.ctx, len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }

  // ---------- music ----------
  /** The sound toggle mutes everything: music, effects and ambience. */
  setMusic(on) {
    this.musicOn = on;
    try { localStorage.setItem('music', on ? 'on' : 'off'); } catch {}
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.15);
    on ? this.startMusic() : this.stopMusic();
  }

  startMusic() {
    if (!this.musicOn) return;
    const ctx = this.ensure();
    this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(this.musicLevel(), ctx.currentTime, 0.8);
    if (this.timer) return;
    this.next = ctx.currentTime + 0.1;
    this.startCrackle();
    this.timer = setInterval(() => this.schedule(), 30);
  }

  musicLevel() { return this.focus ? 0.3 : 0.55; }

  /** During a pomodoro focus session the music sits further back. */
  setFocus(on) {
    this.focus = on;
    if (this.ctx && this.timer) this.musicGain.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 1.5);
  }

  stopMusic() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(0, t, 0.3);
    clearInterval(this.timer); this.timer = null;
    this.crackle?.stop(t + 1.5); this.crackle = null;
  }

  startCrackle() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0006 ? (Math.random() - 0.5) * 0.6 : 0);
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.6;
    src.connect(f); f.connect(this.bus); src.start();
    this.crackle = src;
  }

  schedule() {
    const s16 = 60 / BPM / 4;
    while (this.next < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.next);
      this.step++;
      this.next += s16;
    }
  }

  playStep(step, t) {
    const s = step % 16, bar = Math.floor(step / 16);
    const chord = PROG[bar % PROG.length];
    const swing = s % 2 === 1 ? 0.04 : 0;
    t += swing;
    const barLen = (60 / BPM) * 4;
    if (s === 0) {
      chord.pad.forEach((m, i) => this.pad(mtof(m), t + i * 0.03, barLen));
    }
    if (s === 0 || s === 10) this.bass(mtof(chord.bass), t, s === 0 ? 0.9 : 0.5);
    if (s === 0 || s === 7 || s === 10) this.kick(t, s === 0 ? 1 : 0.6);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 2 === 0) this.hat(t, s % 4 === 0 ? 0.5 : 0.3);
    if (s % 2 === 0 && Math.random() < 0.28 && bar % 8 > 1) {
      const m = chord.scale[Math.floor(Math.random() * chord.scale.length)];
      this.keys(mtof(m), t);
    }
  }

  env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  pad(f, t, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
    lp.connect(g); g.connect(this.bus); g.connect(this.reverb);
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 1.2);
    }
    this.env(g, t, 0.6, 0.045, dur + 1.1, 1.0);
  }

  bass(f, t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    o.connect(g); g.connect(this.bus);
    this.env(g, t, 0.02, 0.22 * v, 1.2, 0.6);
    o.start(t); o.stop(t + 1.3);
  }

  keys(f, t) {
    const ctx = this.ctx, g = ctx.createGain();
    g.connect(this.bus); g.connect(this.reverb);
    [[1, 1], [2, 0.25], [3, 0.08]].forEach(([h, a]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * h;
      const og = ctx.createGain(); og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.2);
    });
    this.env(g, t, 0.01, 0.06, 2.1, 1.9);
  }

  kick(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    o.connect(g); g.connect(this.bus);
    g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t); o.stop(t + 0.32);
  }

  noiseHit(t, type, freq, q, peak, dur, bus = this.bus) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(g); g.connect(bus);
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
    return f;
  }
  snare(t) { this.noiseHit(t, 'bandpass', 1800, 0.8, 0.12, 0.18); }
  hat(t, v) { this.noiseHit(t, 'highpass', 7000, 0.7, 0.05 * v, 0.05); }

  // ---------- ambience: birds by day, crickets by night, crackle near the fire ----------
  setAmbience({ dark, fire = 0, water = 0, rain = 0 }) {
    this.amb = { dark, fire, water, rain };
    if (!this.ctx) return;
    if (!this.ambTimer) {
      this.ambBus = this.ctx.createGain();
      this.ambBus.gain.value = 0.5;
      this.ambBus.connect(this.master);
      this.ambTimer = setInterval(() => this.ambientTick(), 120);
      // steady rain hiss, faded in/out by the weather
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
      this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
      src.connect(lp); lp.connect(hp); hp.connect(this.rainGain); this.rainGain.connect(this.ambBus);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(rain * 0.22, this.ctx.currentTime, 1.5);
  }

  ambientTick() {
    const ctx = this.ctx, a = this.amb;
    if (!a || !this.musicOn || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.05;
    if (!a.dark && a.rain < 0.5 && Math.random() < 0.05) {
      // a little bird: 2–4 quick chirps
      const base = 2400 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.11;
        o.frequency.setValueAtTime(base, s);
        o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.3), s + 0.06);
        o.connect(g); g.connect(this.ambBus);
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
        o.start(s); o.stop(s + 0.09);
      }
    }
    if (a.dark && a.rain < 0.5 && Math.random() < 0.35) {
      // crickets: pulsed high tone
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 4300 + Math.random() * 400;
      o.connect(g); g.connect(this.ambBus);
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.035;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.012, s + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.03);
      }
      o.start(t); o.stop(t + 0.12);
    }
    if (a.fire > 0.05 && Math.random() < a.fire * 0.8) this.noiseHit(t + Math.random() * 0.1, 'highpass', 2500, 0.5, 0.12 * a.fire, 0.03, this.ambBus);
    if (a.water > 0.05 && Math.random() < 0.25) {
      const f = this.noiseHit(t, 'bandpass', 500 + Math.random() * 400, 2, 0.05 * a.water, 0.4, this.ambBus);
      f.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    }
  }

  // ---------- sfx ----------
  sfx(name) {
    if (!this.ctx || !this.musicOn) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (name === 'flip') {
      const f = this.noiseHit(t, 'bandpass', 900, 1.2, 0.35, 0.28, this.sfxBus);
      f.frequency.exponentialRampToValueAtTime(3800, t + 0.25);
    } else if (name === 'whoosh') {
      const f = this.noiseHit(t, 'bandpass', 300, 0.9, 0.3, 0.7, this.sfxBus);
      f.frequency.exponentialRampToValueAtTime(1600, t + 0.6);
    } else if (name === 'bell') {
      // soft three-note chime
      [[880, 0], [1318.5, 0.18], [1760, 0.36]].forEach(([f, d]) => {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o2.frequency.value = f * 2.76;
        const g2 = ctx.createGain(); g2.gain.value = 0.15;
        o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.sfxBus);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 2.2);
        o.start(t + d); o2.start(t + d); o.stop(t + d + 2.3); o2.stop(t + d + 2.3);
      });
    } else if (name === 'quack') {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.14);
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 4;
      o.connect(f); f.connect(g); g.connect(this.sfxBus);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t); o.stop(t + 0.18);
    } else if (name === 'meow') {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(780, t + 0.18); o.frequency.exponentialRampToValueAtTime(430, t + 0.55);
      f.type = 'lowpass'; f.frequency.value = 2200;
      o.connect(f); f.connect(g); g.connect(this.sfxBus);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.start(t); o.stop(t + 0.62);
    } else if (name === 'plop') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.09);
      o.connect(g); g.connect(this.sfxBus);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); o.stop(t + 0.13);
    } else if (name === 'splash') {
      const f = this.noiseHit(t, 'bandpass', 1200, 0.7, 0.35, 0.45, this.sfxBus);
      f.frequency.exponentialRampToValueAtTime(400, t + 0.4);
    } else if (name === 'step') {
      this.noiseHit(t, 'lowpass', 260, 0.7, 0.1, 0.08, this.sfxBus);
    } else if (name === 'bump') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      o.connect(g); g.connect(this.sfxBus);
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    } else if (name === 'jump' || name === 'pop' || name === 'click') {
      const [a, b, d, v] = { jump: [280, 640, 0.18, 0.18], pop: [500, 1200, 0.12, 0.2], click: [1400, 900, 0.05, 0.08] }[name];
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + d);
      o.connect(g); g.connect(this.sfxBus);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.05);
      o.start(t); o.stop(t + d + 0.06);
    }
  }
}

export const sound = new Sound();
