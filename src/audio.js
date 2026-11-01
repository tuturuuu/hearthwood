// Procedural lo-fi music + small sound effects, all generated with WebAudio (no assets).
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Three lo-fi tracks. Each has its own tempo, chords, drums and lead voice.
 * Auto mode picks one that suits the weather and rotates between them on clear days.
 */
export const TRACKS = {
  hearth: {
    name: 'Hearth', bpm: 74, cutoff: 3200, wet: 0.35, lead: 'keys', leadProb: 0.28, pad: 0.045,
    kick: { 0: 1, 7: 0.6, 10: 0.6 }, snare: [4, 12], hat: 0.4, bassSteps: { 0: 0.9, 10: 0.5 },
    prog: [
      { pad: [60, 64, 67, 71], bass: 36, scale: [72, 74, 76, 79, 81] },   // Cmaj7
      { pad: [57, 60, 64, 67], bass: 33, scale: [69, 72, 74, 76, 79] },   // Am7
      { pad: [62, 65, 69, 72], bass: 38, scale: [74, 77, 79, 81, 84] },   // Dm7
      { pad: [55, 59, 62, 65], bass: 31, scale: [71, 74, 76, 79, 83] },   // G7
    ],
  },
  rain: {
    // slow, minor-ish electric piano, brushed drums: rain on the window
    name: 'Rainy window', bpm: 66, cutoff: 2500, wet: 0.45, lead: 'rhodes', leadProb: 0.22, pad: 0.035, arp: 0.5,
    kick: { 0: 0.8, 9: 0.45 }, snare: [4, 12], brush: true, hat: 0.25, bassSteps: { 0: 0.9, 6: 0.4, 11: 0.5 },
    prog: [
      { pad: [53, 57, 60, 64], bass: 41, scale: [69, 72, 74, 76, 77] },   // Fmaj7
      { pad: [52, 55, 59, 62], bass: 40, scale: [67, 71, 74, 76, 79] },   // Em7
      { pad: [50, 53, 57, 60, 64], bass: 38, scale: [65, 69, 72, 74, 76] }, // Dm9
      { pad: [48, 52, 55, 59, 62], bass: 36, scale: [67, 71, 72, 74, 76] }, // Cmaj9
    ],
  },
  snow: {
    // drumless and airy: music box over long pads, a soft heartbeat kick
    name: 'First snow', bpm: 58, cutoff: 2800, wet: 0.6, lead: 'musicbox', leadProb: 0.34, pad: 0.05, arp: 0.35,
    kick: { 0: 0.35 }, snare: [], hat: 0.1, bassSteps: { 0: 0.7 },
    prog: [
      { pad: [62, 66, 69, 73], bass: 38, scale: [78, 81, 85, 86, 88] },   // Dmaj7
      { pad: [59, 62, 66, 69], bass: 35, scale: [74, 78, 81, 83, 86] },   // Bm7
      { pad: [55, 59, 62, 66], bass: 31, scale: [74, 78, 79, 83, 86] },   // Gmaj7
      { pad: [57, 61, 64, 71], bass: 33, scale: [76, 78, 81, 83, 85] },   // A6/9
    ],
  },
};
export const TRACK_MODES = { auto: 'Auto', hearth: 'Hearth', rain: 'Rainy window', snow: 'First snow' };

export class Sound {
  constructor() {
    let music = null, fx = null, track = null;
    try { music = localStorage.getItem('music'); fx = localStorage.getItem('sfx'); track = localStorage.getItem('track'); } catch {}
    this.musicOn = music !== 'off';
    // effects + ambience have their own switch; someone who muted everything before stays muted
    this.sfxOn = fx ? fx !== 'off' : music !== 'off';
    this.trackMode = TRACK_MODES[track] ? track : 'auto';
    this.track = this.trackMode === 'auto' ? 'hearth' : this.trackMode;
    this.ctx = null;
    this.step = 0;
    this.amb = { dark: false, fire: 0, water: 0, rain: 0, snow: 0 };
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);
    // effects and ambience share one switchable gain, separate from the music
    this.fx = ctx.createGain(); this.fx.gain.value = this.sfxOn ? 1 : 0; this.fx.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.5; this.sfxBus.connect(this.fx);

    // music chain: bus -> lofi lowpass -> music gain -> master (+ reverb send)
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
    this.lofi = ctx.createBiquadFilter(); this.lofi.type = 'lowpass'; this.lofi.frequency.value = TRACKS[this.track].cutoff; this.lofi.connect(this.musicGain);
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9; this.bus.connect(this.lofi);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(3.2);
    this.wet = ctx.createGain(); this.wet.gain.value = TRACKS[this.track].wet;
    this.reverb.connect(this.wet); this.wet.connect(this.lofi);
    // tape wow: every pitched note drifts a few cents together, like a warped cassette
    this.wow = ctx.createGain(); this.wow.gain.value = 7;
    const wowLfo = ctx.createOscillator(); wowLfo.frequency.value = 0.33; wowLfo.connect(this.wow); wowLfo.start();

    this.noise = this.noiseBuffer('white', 2);
    this.pink = this.noiseBuffer('pink', 6);
    this.brown = this.noiseBuffer('brown', 6);
    return ctx;
  }

  noiseBuffer(kind, sec) {
    const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5;
      } else d[i] = w;
    }
    // fade the loop seam so it never clicks
    const fade = Math.min(2000, d.length / 4);
    for (let i = 0; i < fade; i++) { const k = i / fade; d[d.length - 1 - i] = d[d.length - 1 - i] * k + d[fade - 1 - i] * (1 - k); }
    return b;
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

  /** An oscillator that follows the tape wow. */
  osc(type, f, det = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
    this.wow.connect(o.detune);
    return o;
  }

  pan(p, to) {
    const n = this.ctx.createStereoPanner(); n.pan.value = p; n.connect(to); return n;
  }

  // ---------- music ----------
  /** The lo-fi track only; effects and ambience have their own switch (setEffects). */
  setMusic(on) {
    this.musicOn = on;
    try { localStorage.setItem('music', on ? 'on' : 'off'); } catch {}
    on ? this.startMusic() : this.stopMusic();
  }

  /** Clicks, page flips, voices and the world's ambience: rain, fire, water, wind, birds and crickets. */
  setEffects(on) {
    this.sfxOn = on;
    try { localStorage.setItem('sfx', on ? 'on' : 'off'); } catch {}
    if (this.ctx) this.fx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.15);
  }

  /** 'auto' follows the weather; otherwise one of TRACKS. */
  setTrack(mode) {
    this.trackMode = TRACK_MODES[mode] ? mode : 'auto';
    try { localStorage.setItem('track', this.trackMode); } catch {}
    this.barsOnTrack = 0;
    this.queueTrack(this.autoTrack());
  }

  autoTrack() {
    if (this.trackMode !== 'auto') return this.trackMode;
    const a = this.amb;
    if (a.rain > 0.5) return 'rain';
    if (a.snow > 0.5) return 'snow';
    // clear skies: drift through all three, a few minutes each
    if ((this.barsOnTrack || 0) >= 40) {
      const order = a.dark ? ['snow', 'rain', 'hearth'] : ['hearth', 'rain', 'snow'];
      return order[(order.indexOf(this.track) + 1) % order.length];
    }
    return this.track;
  }

  /** Fade out, swap the track at the next bar, fade back in. */
  queueTrack(id) {
    if (id === this.track && !this.pending) return;
    if (id === this.track) { this.pending = null; if (this.ctx && this.timer) this.musicGain.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 1); return; }
    if (!this.ctx || !this.timer) { this.track = id; return; }
    if (this.pending === id) return;
    this.pending = id;
    this.switchAt = this.ctx.currentTime + 2.2;
    this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.7);
  }

  get trackName() { return TRACKS[this.pending || this.track].name; }

  startMusic() {
    if (!this.musicOn) return;
    const ctx = this.ensure();
    this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(this.musicLevel(), ctx.currentTime, 0.8);
    if (this.timer) return;
    this.next = ctx.currentTime + 0.1;
    this.step = 0;
    this.startCrackle();
    this.timer = setInterval(() => this.schedule(), 30);
  }

  musicLevel() { return this.focus ? 0.3 : 0.55; }

  /** During a pomodoro focus session the music sits further back. */
  setFocus(on) {
    this.focus = on;
    if (this.ctx && this.timer && !this.pending) this.musicGain.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 1.5);
  }

  stopMusic() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(0, t, 0.3);
    clearInterval(this.timer); this.timer = null;
    if (this.pending) { this.track = this.pending; this.pending = null; }
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
    while (this.next < this.ctx.currentTime + 0.15) {
      const s = this.step % 16;
      if (s === 0) {
        if (this.pending && this.next >= this.switchAt) this.applyTrack(this.next);
        else if (!this.pending) {
          this.barsOnTrack = (this.barsOnTrack || 0) + 1;
          const want = this.autoTrack();
          if (want !== this.track) this.queueTrack(want);
        }
      }
      this.playStep(this.step, this.next);
      this.step++;
      this.next += 60 / TRACKS[this.track].bpm / 4;
    }
  }

  applyTrack(t) {
    this.track = this.pending; this.pending = null;
    this.step = 0; this.barsOnTrack = 0;
    const tr = TRACKS[this.track];
    this.wet.gain.setTargetAtTime(tr.wet, t, 0.5);
    this.updateCutoff(t);
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(this.musicLevel(), t, 1.2);
  }

  /** Rain and snow muffle the music a little, like listening from inside. */
  updateCutoff(t = this.ctx.currentTime) {
    const muffle = 1 - 0.22 * Math.max(this.amb.rain, this.amb.snow);
    this.lofi.frequency.setTargetAtTime(TRACKS[this.track].cutoff * muffle, t, 2);
  }

  playStep(step, t) {
    const tr = TRACKS[this.track];
    const s = step % 16, bar = Math.floor(step / 16);
    const chord = tr.prog[bar % tr.prog.length];
    t += s % 2 === 1 ? 0.04 * (74 / tr.bpm) : 0; // swing
    const barLen = (60 / tr.bpm) * 4;
    if (s === 0) chord.pad.forEach((m, i) => this.pad(mtof(m), t + i * 0.03, barLen, tr.pad));
    if (tr.bassSteps[s]) this.bass(mtof(chord.bass), t, tr.bassSteps[s]);
    if (tr.kick[s]) this.kick(t, tr.kick[s]);
    if (tr.snare.includes(s)) tr.brush ? this.brush(t) : this.snare(t);
    if (s % 2 === 0 && tr.hat) this.hat(t, (s % 4 === 0 ? 0.5 : 0.3) * tr.hat / 0.4);
    // a broken chord drifting down on some bars
    if (tr.arp && s % 4 === 2 && bar % 4 === 3 && Math.random() < tr.arp) {
      const m = chord.pad[(s / 4 | 0) % chord.pad.length] + 12;
      this.lead(tr.lead, mtof(m), t, 0.7);
    }
    if (s % 2 === 0 && Math.random() < tr.leadProb && bar % 8 > 1) {
      const m = chord.scale[Math.floor(Math.random() * chord.scale.length)];
      this.lead(tr.lead, mtof(m), t, 1);
    }
  }

  env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  pad(f, t, dur, level = 0.045) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
    lp.connect(g); g.connect(this.bus); g.connect(this.reverb);
    for (const det of [-7, 7]) {
      const o = this.osc('triangle', f, det);
      o.connect(lp); o.start(t); o.stop(t + dur + 1.2);
    }
    this.env(g, t, 0.6, level, dur + 1.1, 1.0);
  }

  bass(f, t, v) {
    const ctx = this.ctx, o = this.osc('sine', f), g = ctx.createGain();
    o.connect(g); g.connect(this.bus);
    this.env(g, t, 0.02, 0.22 * v, 1.2, 0.6);
    o.start(t); o.stop(t + 1.3);
  }

  lead(kind, f, t, v) {
    if (kind === 'rhodes') this.rhodes(f, t, v);
    else if (kind === 'musicbox') this.musicbox(f, t, v);
    else this.keys(f, t, v);
  }

  keys(f, t, v = 1) {
    const ctx = this.ctx, g = ctx.createGain();
    g.connect(this.bus); g.connect(this.reverb);
    [[1, 1], [2, 0.25], [3, 0.08]].forEach(([h, a]) => {
      const o = this.osc('sine', f * h);
      const og = ctx.createGain(); og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.2);
    });
    this.env(g, t, 0.01, 0.06 * v, 2.1, 1.9);
  }

  /** Electric piano: a sine carrier with a quickly fading FM "tine". */
  rhodes(f, t, v = 1) {
    const ctx = this.ctx, car = this.osc('sine', f), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    mod.frequency.value = f; mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.7);
    mod.connect(mg); mg.connect(car.frequency);
    const p = this.pan((Math.random() - 0.5) * 0.5, this.bus);
    car.connect(g); g.connect(p); g.connect(this.reverb);
    this.env(g, t, 0.008, 0.075 * v, 2.6, 2.3);
    car.start(t); mod.start(t); car.stop(t + 2.7); mod.stop(t + 2.7);
  }

  /** Music box: bright and bell-like, with slightly inharmonic overtones. */
  musicbox(f, t, v = 1) {
    const ctx = this.ctx, g = ctx.createGain();
    const p = this.pan((Math.random() - 0.5) * 0.7, this.bus);
    g.connect(p); g.connect(this.reverb);
    [[1, 1], [3.01, 0.18], [5.43, 0.06]].forEach(([h, a]) => {
      const o = this.osc('sine', f * h), og = ctx.createGain();
      og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(a * 0.02, t + 1.6 / h);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.4);
    });
    this.env(g, t, 0.004, 0.05 * v, 2.3, 2.2);
  }

  kick(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    o.connect(g); g.connect(this.bus);
    g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t); o.stop(t + 0.32);
  }

  noiseHit(t, type, freq, q, peak, dur, bus = this.bus, buf = this.noise) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(g); g.connect(bus);
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t, Math.random() * (buf.duration - dur - 0.1)); src.stop(t + dur + 0.02);
    return f;
  }
  snare(t) { this.noiseHit(t, 'bandpass', 1800, 0.8, 0.12, 0.18); }
  /** A brushed snare: a soft swish rather than a crack. */
  brush(t) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.5;
    src.connect(f); f.connect(g); g.connect(this.bus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    src.start(t, Math.random()); src.stop(t + 0.34);
  }
  hat(t, v) { this.noiseHit(t, 'highpass', 7000, 0.7, 0.05 * v, 0.05); }

  // ---------- ambience ----------
  /** A looping noise bed through a filter, faded by its gain. */
  bed(buf, type, freq, q, extra) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0;
    let tail = f;
    if (extra) { extra.forEach((n) => { tail.connect(n); tail = n; }); }
    src.connect(f); tail.connect(g); g.connect(this.ambBus);
    src.start(0, Math.random() * buf.duration);
    return { g, f };
  }

  lfo(rate, depth, target) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(target); o.start();
  }

  startAmbience() {
    const ctx = this.ctx;
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.6; this.ambBus.connect(this.fx);
    // ambience gets a little room of its own
    this.ambVerb = ctx.createConvolver(); this.ambVerb.buffer = this.impulse(2.2);
    const av = ctx.createGain(); av.gain.value = 0.25; this.ambVerb.connect(av); av.connect(this.ambBus);

    // rain: a soft pink hiss that breathes, a low rumble under it, droplets in the tick
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280;
    this.rainHiss = this.bed(this.pink, 'lowpass', 2200, 0.4, [hp]);
    this.lfo(0.09, 500, this.rainHiss.f.frequency);
    this.rainLow = this.bed(this.brown, 'lowpass', 380, 0.5);

    // wind for snowy days: band-passed noise whose pitch and strength drift in slow gusts
    this.wind = this.bed(this.pink, 'bandpass', 480, 1.4);
    this.lfo(0.05, 220, this.wind.f.frequency);
    const gust = ctx.createGain(); gust.gain.value = 1; this.wind.g.disconnect(); this.wind.g.connect(gust); gust.connect(this.ambBus);
    this.lfo(0.07, 0.45, gust.gain);

    // the campfire: a deep breathing roar plus a faint hiss; pops and snaps come from the tick
    this.fireRoar = this.bed(this.brown, 'lowpass', 260, 0.7);
    this.lfo(0.6, 90, this.fireRoar.f.frequency);
    this.fireHiss = this.bed(this.noise, 'highpass', 3500, 0.5);

    this.ambTimer = setInterval(() => this.ambientTick(), 100);
  }

  setAmbience({ dark, fire = 0, water = 0, rain = 0, snow = 0 }) {
    const prev = this.amb;
    this.amb = { dark, fire, water, rain, snow };
    if (this.trackMode === 'auto' && this.timer && !this.pending &&
        ((rain > 0.5) !== (prev.rain > 0.5) || (snow > 0.5) !== (prev.snow > 0.5))) this.queueTrack(this.autoTrack());
    if (!this.ctx) return;
    if (!this.ambTimer) this.startAmbience();
    const t = this.ctx.currentTime;
    this.rainHiss.g.gain.setTargetAtTime(rain * 0.2, t, 1.5);
    this.rainLow.g.gain.setTargetAtTime(rain * 0.35, t, 1.5);
    this.wind.g.gain.setTargetAtTime(snow * 0.32 + rain * 0.04, t, 2);
    this.fireRoar.g.gain.setTargetAtTime(fire * 0.55, t, 0.6);
    this.fireHiss.g.gain.setTargetAtTime(fire * 0.012, t, 0.6);
    if (this.timer && !this.pending) this.updateCutoff(t);
  }

  ambientTick() {
    const ctx = this.ctx, a = this.amb;
    if (!a || !this.sfxOn || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.05, r = Math.random;
    const calm = a.rain < 0.5 && a.snow < 0.5;
    if (!a.dark && a.rain < 0.5 && r() < (a.snow > 0.5 ? 0.012 : 0.04)) {
      // a little bird: 2–4 quick chirps from somewhere to the side
      const base = 2400 + r() * 1600, n = 2 + Math.floor(r() * 3), p = this.pan(r() * 1.6 - 0.8, this.ambBus);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.11;
        o.frequency.setValueAtTime(base, s);
        o.frequency.exponentialRampToValueAtTime(base * (1.3 + r() * 0.3), s + 0.06);
        o.connect(g); g.connect(p);
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.025, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
        o.start(s); o.stop(s + 0.09);
      }
    }
    if (a.dark && calm && r() < 0.3) {
      // crickets: pulsed high tone
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 4300 + r() * 400;
      o.connect(g); g.connect(this.pan(r() * 1.4 - 0.7, this.ambBus));
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.035;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.01, s + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.03);
      }
      o.start(t); o.stop(t + 0.12);
    }
    if (a.dark && calm && r() < 0.0025) this.owl(t);
    if (a.rain > 0.05) {
      // droplets: tiny ticks on leaves, and now and then a fat drip off the eaves
      const n = Math.round(a.rain * (2 + r() * 3));
      for (let i = 0; i < n; i++) {
        const s = t + r() * 0.1;
        this.noiseHit(s, 'bandpass', 2500 + r() * 4000, 3, 0.02 + r() * 0.03, 0.015, this.pan(r() * 2 - 1, this.ambBus));
      }
      if (r() < a.rain * 0.08) this.drip(t + r() * 0.1, 0.05 * a.rain);
      if (a.rain > 0.7 && a.dark && r() < 0.0012) this.thunder(t);
    }
    if (a.snow > 0.3 && r() < 0.006) this.chime(t, a.snow);
    if (a.fire > 0.05) {
      // small pops most of the time, a sharp snap now and then, a log settling rarely
      if (r() < a.fire * 0.7) {
        const p = this.pan(r() * 0.8 - 0.4, this.ambBus);
        this.noiseHit(t + r() * 0.09, 'bandpass', 1200 + r() * 3500, 1.5 + r() * 2, (0.05 + r() * 0.1) * a.fire, 0.008 + r() * 0.02, p);
        if (r() < 0.3) this.noiseHit(t + r() * 0.09, 'bandpass', 1800 + r() * 2500, 2, 0.04 * a.fire, 0.006, p);
      }
      if (r() < a.fire * 0.05) this.noiseHit(t, 'highpass', 1500, 0.7, 0.22 * a.fire, 0.05, this.pan(r() * 0.6 - 0.3, this.ambBus));
      if (r() < a.fire * 0.006) {
        const f = this.noiseHit(t, 'lowpass', 500, 1, 0.25 * a.fire, 0.35, this.ambBus, this.brown);
        f.frequency.exponentialRampToValueAtTime(150, t + 0.3);
      }
    }
    if (a.water > 0.05 && r() < 0.2) {
      const f = this.noiseHit(t, 'bandpass', 500 + r() * 400, 2, 0.05 * a.water, 0.4, this.pan(r() * 1.2 - 0.6, this.ambBus));
      f.frequency.exponentialRampToValueAtTime(900, t + 0.35);
      if (a.rain > 0.3 && r() < 0.5) this.drip(t + r() * 0.1, 0.04 * a.water); // rain plinking on the pond
    }
  }

  drip(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f0 = 900 + Math.random() * 1400;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.05);
    const p = this.pan(Math.random() * 1.6 - 0.8, this.ambBus);
    o.connect(g); g.connect(p); g.connect(this.ambVerb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.start(t); o.stop(t + 0.08);
  }

  /** Far-off thunder: a slow swell of low rumble, never a crack. */
  thunder(t) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.brown; f.type = 'lowpass'; f.frequency.value = 160;
    src.connect(f); f.connect(g); g.connect(this.ambBus); g.connect(this.ambVerb);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.25, t + 2.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5);
    src.start(t, Math.random()); src.stop(t + 6.6);
  }

  /** Wind chimes stirred by a gust: a few notes from a pentatonic set. */
  chime(t, v) {
    const notes = [84, 86, 88, 91, 93, 96], n = 2 + Math.floor(Math.random() * 3);
    const p = this.pan(Math.random() * 1.2 - 0.6, this.ambBus);
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.18 + Math.random() * 0.25), f = mtof(notes[Math.floor(Math.random() * notes.length)]);
      const ctx = this.ctx, g = ctx.createGain();
      g.connect(p); g.connect(this.ambVerb);
      [[1, 1], [2.76, 0.12]].forEach(([h, a]) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f * h; og.gain.value = a;
        o.connect(og); og.connect(g); o.start(s); o.stop(s + 2.6);
      });
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.018 * v, s + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, s + 2.5);
    }
  }

  /** An owl somewhere in the trees: hoo, hoo-hoo. */
  owl(t) {
    const ctx = this.ctx, p = this.pan(Math.random() < 0.5 ? -0.7 : 0.7, this.ambBus);
    [[0, 0.32], [0.55, 0.16], [0.78, 0.4]].forEach(([d, len]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + d;
      o.frequency.setValueAtTime(390, s); o.frequency.linearRampToValueAtTime(360, s + len);
      o.connect(g); g.connect(p); g.connect(this.ambVerb);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03, s + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, s + len);
      o.start(s); o.stop(s + len + 0.02);
    });
  }

  // ---------- sfx ----------
  sfx(name, pitch = 1) {
    if (!this.ctx || !this.sfxOn) return;
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
    } else if (name === 'talk') {
      // a little murmured "voice" per syllable, Animal Crossing style; each villager has their own pitch.
      // A square wave through a soft band-pass reads like a vowel and stays audible on laptop speakers.
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      const hz = 480 * pitch * (0.88 + Math.random() * 0.3);
      o.type = 'square';
      o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(hz * 1.18, t + 0.05);
      f.type = 'bandpass'; f.frequency.value = 1300 + 500 * pitch; f.Q.value = 1.1;
      o.connect(f); f.connect(g); g.connect(this.sfxBus);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
      o.start(t); o.stop(t + 0.085);
    }
  }
}

export const sound = new Sound();
