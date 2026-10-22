import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon } from './toon.js';
import { sound } from './audio.js';

// Fishing from the end of the dock: F to cast, wait for the bobber to dip, F again to reel in.
const FISH = [
  { name: 'Minnow', w: 30, cm: [4, 9] },
  { name: 'Perch', w: 24, cm: [15, 30] },
  { name: 'Bluegill', w: 20, cm: [10, 22] },
  { name: 'Carp', w: 12, cm: [30, 70], big: true },
  { name: 'Rainbow Trout', w: 8, cm: [25, 55], big: true },
  { name: 'Golden Koi', w: 2.5, cm: [30, 60], big: true, rare: true },
  { name: 'Moon Koi', w: 3, cm: [35, 65], big: true, rare: true, night: true },
  { name: 'Soggy library book', w: 1.5, cm: [20, 20], junk: true },
  { name: 'Old boot', w: 3, cm: [28, 28], junk: true },
];
const KEY = 'fishLog';

const loader = new GLTFLoader();
const model = (n) => loader.loadAsync(`assets/survival/${n}.glb`).then((g) => g.scene);

export class Fishing {
  constructor(w) {
    this.w = w;
    this.state = 'idle';          // idle | casting | waiting | bite | reeling
    try { this.log = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { this.log = {}; }

    this.rod = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 2.2, 6), toon('#7b5238'));
    pole.position.y = 1.1;
    this.rod.add(pole);
    this.tip = new THREE.Object3D();
    this.tip.position.y = 2.2;
    this.rod.add(this.tip);
    this.rod.visible = false;
    w.scene.add(this.rod);

    this.bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#e5484d'));
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#fff8ee'));
    this.bobber.add(top, bottom);
    this.bobber.visible = false;
    w.scene.add(this.bobber);

    this.lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.8 }));
    this.line.visible = false;
    this.line.frustumCulled = false;
    w.scene.add(this.line);

    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.alertTexture(), depthTest: false }));
    this.alert.scale.set(0.6, 0.6, 1);
    this.alert.visible = false;
    w.scene.add(this.alert);

    this.trophies = { small: model('fish').catch(() => null), large: model('fish-large').catch(() => null) };
  }

  alertTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.fillStyle = '#e07a5f'; g.font = '900 96px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  get stats() {
    const entries = Object.entries(this.log);
    const total = entries.reduce((n, [, v]) => n + v.count, 0);
    return { total, kinds: entries.length };
  }

  /** F key while sitting on the dock */
  press() {
    if (this.state === 'idle') this.cast();
    else if (this.state === 'bite') this.catch();
    else if (this.state === 'waiting') { this.reset(); this.w.onFishMessage?.('Reeled in — nothing yet'); }
  }

  cast() {
    const s = this.w.seated;
    this.state = 'casting';
    this.rod.visible = this.line.visible = this.bobber.visible = true;
    this.castFrom = new THREE.Vector3(s.x, 0, s.z);
    const dist = 2.6 + Math.random() * 1.8, side = (Math.random() - 0.5) * 1.6;
    this.spot = new THREE.Vector3(s.x + Math.sin(s.face) * dist + Math.cos(s.face) * side, 0.06, s.z + Math.cos(s.face) * dist - Math.sin(s.face) * side);
    this.t = 0;
    sound.sfx('whoosh');
  }

  reset() {
    this.state = 'idle';
    this.rod.visible = this.line.visible = this.bobber.visible = this.alert.visible = false;
  }

  pick() {
    const night = this.w.dark;
    const pool = FISH.filter((f) => !f.night || night);
    let r = Math.random() * pool.reduce((n, f) => n + f.w, 0);
    for (const f of pool) { if ((r -= f.w) < 0) return f; }
    return pool[0];
  }

  async catch() {
    this.state = 'reeling';
    this.alert.visible = false;
    const f = this.pick();
    const cm = Math.round(f.cm[0] + Math.random() * (f.cm[1] - f.cm[0]));
    const prev = this.log[f.name];
    const best = !f.junk && (!prev || cm > prev.best);
    this.log[f.name] = { count: (prev?.count || 0) + 1, best: Math.max(prev?.best || 0, cm) };
    try { localStorage.setItem(KEY, JSON.stringify(this.log)); } catch {}
    sound.sfx('splash');
    sound.sfx(f.rare ? 'bell' : 'pop');

    // show the catch above your head for a moment
    const src = f.junk ? null : await (f.big ? this.trophies.large : this.trophies.small);
    let shown = null;
    if (src) {
      shown = src.clone(true);
      shown.traverse((o) => { if (o.isMesh) o.material = toon(f.rare ? '#f2c14e' : '#ffffff', { map: o.material.map }); });
      shown.scale.setScalar(2.6 * (0.7 + (cm - f.cm[0]) / Math.max(1, f.cm[1] - f.cm[0]) * 0.5));
      this.w.scene.add(shown);
    }
    const msg = f.junk ? `You fished out… a ${f.name.toLowerCase()}.` : `You caught a ${f.name} — ${cm} cm${best ? ' · new best!' : ''}`;
    this.w.onFishMessage?.(msg, f.rare);
    this.reset();
    if (shown) {
      const p = this.w.player.position;
      await this.w.tween(1.8, (t) => {
        shown.position.set(p.x, p.y + 2.2 + Math.sin(t * Math.PI) * 0.4, p.z);
        shown.rotation.y = t * Math.PI * 3;
      });
      this.w.scene.remove(shown);
    }
  }

  update(dt) {
    if (this.state === 'idle') return;
    const s = this.w.seated;
    if (!s) { this.reset(); return; }
    // rod in the reader's hands, angled out over the water
    const p = this.w.player.position;
    this.rod.position.set(p.x + Math.sin(s.face) * 0.25, p.y + 0.75, p.z + Math.cos(s.face) * 0.25);
    this.rod.rotation.set(0, s.face, 0);
    this.rod.rotateX(this.state === 'bite' ? 0.55 : 0.85);
    this.t += dt;

    if (this.state === 'casting') {
      const k = Math.min(1, this.t / 0.6);
      const tipW = this.tip.getWorldPosition(new THREE.Vector3());
      this.bobber.position.lerpVectors(tipW, this.spot, k);
      this.bobber.position.y += Math.sin(k * Math.PI) * 1.2;
      if (k >= 1) { this.state = 'waiting'; this.t = 0; this.biteAt = 3 + Math.random() * 7; sound.sfx('plop'); }
    } else if (this.state === 'waiting') {
      this.bobber.position.y = 0.06 + Math.sin(this.t * 2) * 0.015;
      if (this.t > this.biteAt - 1.2 && Math.random() < dt * 3) this.bobber.position.y -= 0.03;   // nibbles
      if (this.t > this.biteAt) { this.state = 'bite'; this.t = 0; sound.sfx('plop'); this.alert.visible = true; }
    } else if (this.state === 'bite') {
      this.bobber.position.y = 0.06 - 0.09 - Math.sin(this.t * 30) * 0.03;
      this.alert.position.set(p.x, p.y + 2.4 + Math.sin(this.t * 12) * 0.05, p.z);
      if (this.t > 1.3) { this.reset(); this.w.onFishMessage?.('It got away… press F to cast again'); }
    }
    const tip = this.tip.getWorldPosition(new THREE.Vector3());
    this.lineGeo.setFromPoints([tip, this.bobber.position]);
  }
}
