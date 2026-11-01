import { sound } from './audio.js';

// RPG-style talk box: the speaker's name tag, text typed out with little voice blips, Enter to go on.
const $ = (id) => document.getElementById(id);

export class DialogueBox {
  constructor({ onAdvance }) {
    this.el = $('dialogue');
    this.el.addEventListener('click', () => onAdvance());
    this.typing = false;
  }

  get open() { return !this.el.hidden; }

  show(npc, text, { index, total }) {
    this.el.hidden = false;
    $('prompt').hidden = true;
    this.el.style.setProperty('--c', npc.color);
    this.el.querySelector('.dl-name').textContent = npc.name;
    this.el.querySelector('.dl-role').textContent = npc.role;
    this.el.querySelector('.dl-more').textContent = index < total - 1 ? '▸' : '✕';
    this.text = text;
    this.shown = 0;
    this.pitch = npc.pitch;
    this.typing = true;
    this.body = this.el.querySelector('.dl-text');
    this.body.textContent = '';
    this.el.classList.add('typing');
    cancelAnimationFrame(this.raf);
    let last = performance.now(), blip = 0;
    const tick = (now) => {
      // ~45 characters a second, a blip every few letters like a murmured voice
      const n = Math.min(this.text.length, this.shown + Math.max(0, Math.floor((now - last) / 22)));
      if (n !== this.shown) {
        last = now;
        for (; this.shown < n; this.shown++) if (/\w/.test(this.text[this.shown]) && ++blip % 3 === 0) sound.sfx('talk', this.pitch);
        this.body.textContent = this.text.slice(0, this.shown);
      }
      if (this.shown < this.text.length) this.raf = requestAnimationFrame(tick);
      else this.finish();
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Skip the typing and show the whole line. */
  finish() {
    if (!this.body) return;
    cancelAnimationFrame(this.raf);
    this.typing = false;
    this.shown = this.text.length;
    this.body.textContent = this.text;
    this.el.classList.remove('typing');
  }

  hide() {
    cancelAnimationFrame(this.raf);
    this.typing = false;
    this.el.hidden = true;
  }
}
