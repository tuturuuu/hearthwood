// Pomodoro timer: focus → short break → … → long break every Nth session.
// State lives in localStorage with an absolute end time, so it survives reloads.
const KEY = 'pomodoro';
export const POMO_DEFAULTS = { focus: 25, break: 5, long: 15, every: 4 };
export const MODE_LABELS = { focus: 'Focus', break: 'Break', long: 'Long break' };

export class Pomodoro {
  constructor({ onChange, onDone }) {
    this.onChange = onChange;
    this.onDone = onDone;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
    this.settings = { ...POMO_DEFAULTS, ...saved.settings };
    this.mode = saved.mode || 'focus';
    this.running = !!saved.running;
    this.endsAt = saved.endsAt || 0;
    this.remaining = saved.remaining ?? this.duration;
    this.done = saved.done || 0;
    setInterval(() => this.tick(), 500);
    this.tick();
  }

  get duration() { return this.settings[this.mode] * 60_000; }
  get left() { return this.running ? Math.max(0, this.endsAt - Date.now()) : this.remaining; }
  get progress() { return 1 - this.left / this.duration; }

  save() {
    const { settings, mode, running, endsAt, remaining, done } = this;
    try { localStorage.setItem(KEY, JSON.stringify({ settings, mode, running, endsAt, remaining, done })); } catch {}
    this.onChange?.(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.endsAt = Date.now() + this.remaining;
    this.save();
  }

  pause() {
    if (!this.running) return;
    this.remaining = this.left;
    this.running = false;
    this.save();
  }

  toggle() { this.running ? this.pause() : this.start(); }

  reset() {
    this.running = false;
    this.remaining = this.duration;
    this.save();
  }

  setMode(mode) {
    this.mode = mode;
    this.reset();
  }

  /** cycle focus → break → long break while stopped */
  cycleMode() {
    const order = ['focus', 'break', 'long'];
    this.setMode(order[(order.indexOf(this.mode) + 1) % order.length]);
  }

  setSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    if (!this.running) this.remaining = this.duration;
    this.save();
  }

  skip() { this.complete(false); }

  complete(natural = true) {
    const finished = this.mode;
    if (finished === 'focus') this.done++;
    this.mode = finished === 'focus' ? (this.done % this.settings.every === 0 ? 'long' : 'break') : 'focus';
    this.remaining = this.duration;
    this.running = false;
    // breaks start on their own; the next focus waits for you
    if (finished === 'focus') this.start();
    this.save();
    if (natural) this.onDone?.(finished, this.mode);
  }

  tick() {
    if (this.running && Date.now() >= this.endsAt) this.complete(true);
    else this.onChange?.(this);
  }
}

export const fmt = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
