import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, canvasTexture, addWind } from './toon.js';
import { woodSign, wrapLines, paintPlanks, INK } from './signs.js';
import { ZONES, PATHS } from './scenery.js';
import { EXPERIENCE } from './profile.js';

/*  One themed area per role around Việt's Garden, Bruno-Simon style:
 *  UI Plaza (frontend) · Agent Lab (AI engineer) · Data Observatory (DS&AI) · Origins (education). */

const rbox = (w, h, d, r = 0.12) => new RoundedBoxGeometry(w, h, d, 5, r);
const glow = (color, intensity = 1.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });

function shadowed(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent?.add(m); return m; }

function wrapText(g, text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Text sprite-like plane that always faces the camera. */
function label(text, { color = '#3d2f2a', bg = '#fffaf0', w = 2.4, h = 0.6, font = 800 } = {}) {
  const tex = canvasTexture(512, Math.round(512 * h / w), (g, cw, ch) => {
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, cw - 8, ch - 8, ch / 2.4); g.fill();
    g.fillStyle = color; g.font = `${font} ${Math.round(ch * 0.42)}px Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 2, cw - 30);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(w, h, 1);
  return s;
}

/** A little wooden plaque (camera-facing) for award names. */
function plaque(text, w = 1.7, h = 0.42) {
  const tex = canvasTexture(512, Math.round((512 * h) / w), (g, cw, ch) => {
    paintPlanks(g, cw, ch, 2);
    g.fillStyle = INK; g.font = `900 ${Math.round(ch * 0.42)}px Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 2, cw - 50);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  s.scale.set(w, h, 1);
  return s;
}

// each area grows its own flowers and fruit
const THEMES = {
  frontend: { flower: 'tulip', fruit: 'strawberry' },
  ai: { flower: 'lavender', fruit: 'grape' },
  data: { flower: 'sunflower', fruit: 'pumpkin' },
  origin: { flower: 'daisy', fruit: 'orange' },
};

export class Experience {
  constructor(w) {
    this.w = w;
    this.group = new THREE.Group();
    w.scene.add(this.group);
    this.anims = [];
    this.build('frontend', (g, c) => this.uiPlaza(g, c));
    this.build('ai', (g, c) => this.agentLab(g, c));
    this.build('data', (g, c) => this.observatory(g, c));
    this.build('origin', (g, c) => this.origins(g, c));
  }

  /** shared: themed floor disc with the area name, a sign, and an info spot */
  build(key, decorate) {
    const Z = ZONES[key], e = EXPERIENCE[key];
    const root = new THREE.Group();
    root.position.set(Z.x, 0, Z.z);
    this.group.add(root);

    const floor = canvasTexture(1024, 1024, (g, s) => {
      const c = s / 2;
      // packed straw + soil, with the role colour only as an accent
      g.fillStyle = '#e4c98f'; g.beginPath(); g.arc(c, c, c - 4, 0, 7); g.fill();
      const tones = ['rgba(176,132,70,.4)', 'rgba(255,240,200,.55)', 'rgba(214,170,90,.5)', 'rgba(140,100,50,.3)', 'rgba(240,214,150,.6)'];
      for (let i = 0; i < 3200; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (c - 20), x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
        const t = Math.random() * Math.PI, len = 10 + Math.random() * 26, bend = (Math.random() - 0.5) * 10;
        g.strokeStyle = tones[i % tones.length]; g.lineWidth = 1.5 + Math.random() * 2;
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(t) * len / 2 - Math.sin(t) * bend, y + Math.sin(t) * len / 2 + Math.cos(t) * bend, x + Math.cos(t) * len, y + Math.sin(t) * len);
        g.stroke();
      }
      g.fillStyle = 'rgba(150,105,60,.18)';
      for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(150 + Math.random() * 720, 150 + Math.random() * 720, 40 + Math.random() * 60, 25 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill(); }
      g.globalAlpha = 0.6; g.lineWidth = 14; g.strokeStyle = e.color; g.setLineDash([46, 22]);
      g.beginPath(); g.arc(c, c, c - 30, 0, 7); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 0.12; g.lineWidth = 3; g.strokeStyle = e.color; g.fillStyle = e.color;
      this.floorPattern(key, g, s);
    });
    const disc = mesh(new THREE.CircleGeometry(Z.r, 64), new THREE.MeshToonMaterial({ map: floor, transparent: true }), 0, 0.025, 0, root);
    disc.rotation.x = -Math.PI / 2;
    disc.receiveShadow = true;
    this.strawBits(root, Z);

    // info sign just outside the fence, so the area name on the ground stays readable
    const sign = this.sign(e);
    sign.position.set(0, 0, Z.r + 0.7);
    root.add(sign);
    this.w.staticBox(Z.x, 0.8, Z.z + Z.r + 0.7, 1.25, 0.8, 0.2);
    this.w.addInteractable({ x: Z.x, z: Z.z + Z.r + 2.0, r: 1.6, title: `${e.title} — ${e.org}`, sub: `${e.when} · Enter for details`,
      action: () => this.w.onInfo?.(e) });

    this.fp = [];                  // footprints claimed by the role props, so farm props never overlap them
    this.key = key;
    decorate(root, Z);
    const gaps = this.gapsFor(Z);
    this.fence(root, Z, gaps);
    this.farmProps(root, Z, gaps);
    shadowed(root);
    disc.castShadow = false;
  }

  claim(x, z, r) { this.fp.push([x, z, r]); }

  /** loose 3D straw scattered on the floor */
  strawBits(root, Z) {
    const n = 420;
    const bits = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.012, 0.22), toon('#ffffff'), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    const tones = ['#f2d48a', '#e2bd6b', '#f7e3ad', '#cfa65a'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (Z.r - 0.4);
      p.set(Math.cos(a) * r, 0.035, Math.sin(a) * r);
      e.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      sc.set(1, 1, 0.6 + Math.random() * 0.8);
      bits.setMatrixAt(i, m.compose(p, q.setFromEuler(e), sc));
      bits.setColorAt(i, col.set(tones[i % tones.length]));
    }
    bits.receiveShadow = true;
    root.add(bits);
  }

  /** directions (angles in the xz plane) where paths enter the area */
  gapsFor(Z) {
    const gaps = [];
    for (const [ax, az, bx, bz] of PATHS) {
      if (Math.hypot(ax - Z.x, az - Z.z) < 0.5) gaps.push(Math.atan2(bz - Z.z, bx - Z.x));
      if (Math.hypot(bx - Z.x, bz - Z.z) < 0.5) gaps.push(Math.atan2(az - Z.z, ax - Z.x));
    }
    return gaps;
  }

  /** rustic post-and-rail fence around the area, open where the paths come in */
  fence(root, Z, gaps) {
    const wood = toon('#9a6a44'), dark = toon('#7b5238');
    const R = Z.r - 0.15, n = Math.round((Math.PI * 2 * R) / 1.1);
    const open = (a) => gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.32);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      if (open(a0) && open(a1)) continue;
      const p0 = [Math.cos(a0) * R, Math.sin(a0) * R];
      if (!open(a0)) mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 6), dark, p0[0], 0.47, p0[1], root);
      if (open(a0) || open(a1) || open(am)) continue;
      const p1 = [Math.cos(a1) * R, Math.sin(a1) * R];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const ry = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      for (const y of [0.4, 0.72]) {
        const rail = mesh(new THREE.BoxGeometry(len, 0.07, 0.05), wood, (p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2, root);
        rail.rotation.y = ry;
      }
      this.w.staticBox(Z.x + (p0[0] + p1[0]) / 2, 0.45, Z.z + (p0[1] + p1[1]) / 2, len / 2, 0.45, 0.06, ry);
    }
  }

  /** hay, sunflowers, pumpkins, crates and barrels around the edge */
  farmProps(root, Z, gaps) {
    const diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const R = Z.r - 1.0, chosen = [];
    for (let i = 0; i < 24 && chosen.length < 3; i++) {
      const a = -Math.PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12);   // start at the back, fan out
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (gaps.some((g) => diff(a, g) < 0.55) || diff(a, Math.PI / 2) < 0.8) continue;   // keep paths + the name clear
      if (this.fp.some(([fx, fz, fr]) => Math.hypot(fx - x, fz - z) < fr + 0.9)) continue;
      if (chosen.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.3)) continue;
      chosen.push([x, z]);
    }
    const th = THEMES[this.key];
    const kinds = [(x, z) => this.hayStack(root, Z, x, z), (x, z) => this.flowers(root, th.flower, x, z, 3), (x, z) => this.fruitCrate(root, Z, th.fruit, x, z), (x, z) => this.barrel(root, Z, x, z)];
    chosen.forEach(([x, z], i) => kinds[i % kinds.length](x, z));
    // little flower clumps along the inside of the fence
    const Rb = Z.r - 0.55;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + 0.05;
      const x = Math.cos(a) * Rb, z = Math.sin(a) * Rb;
      if (i % 3 === 1 || gaps.some((g) => diff(a, g) < 0.5)) continue;
      if (this.fp.some(([fx, fz, fr]) => Math.hypot(fx - x, fz - z) < fr + 0.3) || chosen.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 1.3)) continue;
      this.flowers(root, th.flower, x, z, 1, 0.75);
    }
  }

  hayStack(root, Z, x, z) {
    const hay = toon('#e9c46a'), band = toon('#b8913f');
    [[0, 0.25, 0, 0], [0.5, 0.25, 0.55, 0.3], [0.25, 0.75, 0.25, 0.15]].forEach(([dx, y, dz, ry]) => {
      const b = new THREE.Group();
      mesh(new THREE.BoxGeometry(1.0, 0.5, 0.62), hay, 0, 0, 0, b);
      for (const bx of [-0.25, 0.25]) mesh(new THREE.BoxGeometry(0.05, 0.52, 0.64), band, bx, 0, 0, b);
      b.position.set(x + dx, y, z + dz); b.rotation.y = ry; root.add(b);
    });
    this.w.staticCylinder(Z.x + x + 0.25, Z.z + z + 0.25, 0.75, 1);
  }

  /** a clump of the area's flower: tulip, lavender, sunflower or daisy */
  flowers(root, kind, x, z, count = 3, scale = 1) {
    const stem = addWind(toon('#5f8f44'), 0.05);
    const spots = count === 1 ? [[0, 0, 1]] : [[0, 0, 1], [0.42, 0.3, 0.85], [-0.34, 0.36, 0.72]];
    spots.forEach(([dx, dz, k], i) => {
      const f = new THREE.Group(); f.position.set(x + dx * scale, 0, z + dz * scale); f.scale.setScalar(scale); root.add(f);
      if (kind === 'sunflower') {
        const h = 1.5 * k;
        mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 8), stem, 0, h / 2, 0, f);
        const head = new THREE.Group(); head.position.set(0, h, 0.04); head.rotation.x = -0.5; f.add(head);
        mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), toon('#6b4a33'), 0, 0, 0, head).rotation.x = Math.PI / 2;
        for (let p = 0; p < 14; p++) {
          const petal = mesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 8), toon('#f4c430'), 0, 0, 0, head);
          const a = (p / 14) * Math.PI * 2; petal.position.set(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0); petal.rotation.z = a - Math.PI / 2;
        }
      } else if (kind === 'tulip') {
        for (let s = 0; s < 3; s++) {
          const h = (0.55 + s * 0.12) * k, ox = (s - 1) * 0.12;
          mesh(new THREE.CylinderGeometry(0.018, 0.022, h, 6), stem, ox, h / 2, 0, f);
          const cup = mesh(new THREE.SphereGeometry(0.09, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(['#e56b6f', '#f4978e', '#b39ddb'][(s + i) % 3]), ox, h + 0.04, 0, f);
          cup.rotation.x = Math.PI; cup.scale.y = 1.4;
          mesh(new THREE.CapsuleGeometry(0.03, 0.18, 4, 8), stem, ox + 0.05, h * 0.35, 0, f).rotation.z = -0.5;
        }
      } else if (kind === 'lavender') {
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2, h = (0.55 + (s % 3) * 0.1) * k;
          const tilt = new THREE.Group(); tilt.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25); f.add(tilt);
          mesh(new THREE.CylinderGeometry(0.012, 0.015, h, 5), stem, 0, h / 2, 0, tilt);
          mesh(new THREE.CapsuleGeometry(0.035, 0.18, 4, 8), toon('#9b7fd4'), 0, h + 0.08, 0, tilt);
        }
      } else {   // daisy
        for (let s = 0; s < 3; s++) {
          const h = (0.45 + s * 0.1) * k, ox = (s - 1) * 0.14;
          mesh(new THREE.CylinderGeometry(0.015, 0.018, h, 6), stem, ox, h / 2, 0, f);
          const head = new THREE.Group(); head.position.set(ox, h, 0); head.rotation.x = -0.9; f.add(head);
          mesh(new THREE.SphereGeometry(0.045, 12, 8), toon('#f4c430'), 0, 0, 0.01, head).scale.z = 0.5;
          for (let p = 0; p < 10; p++) {
            const petal = mesh(new THREE.CapsuleGeometry(0.022, 0.07, 4, 6), toon('#fffaf0'), 0, 0, 0, head);
            const a = (p / 10) * Math.PI * 2; petal.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0); petal.rotation.z = a - Math.PI / 2;
          }
        }
      }
    });
  }

  /** a crate overflowing with the area's fruit */
  fruitCrate(root, Z, fruit, x, z) {
    const wood = toon('#a8714a'), dark = toon('#7b5238');
    mesh(new THREE.BoxGeometry(0.8, 0.5, 0.65), wood, x, 0.25, z, root);
    for (const y of [0.1, 0.42]) mesh(new THREE.BoxGeometry(0.82, 0.05, 0.67), dark, x, y, z, root);
    const leaf = toon('#5f8f44');
    if (fruit === 'pumpkin') {
      [[0.75, 0.2, 0.32], [0.5, -0.55, 0.26], [0, 0, 0.28, 0.72]].forEach(([dx, dz, r, y = r * 0.8]) => {
        const p = mesh(new THREE.SphereGeometry(r, 18, 14), toon('#e8822e'), x + dx, y, z + dz, root);
        p.scale.y = 0.75;
        mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), leaf, x + dx, y + r * 0.78, z + dz, root);
      });
    } else {
      for (let i = 0; i < 9; i++) {
        const px = x - 0.25 + (i % 3) * 0.25, pz = z - 0.18 + Math.floor(i / 3) * 0.18, py = 0.56 + (i % 2) * 0.05;
        if (fruit === 'strawberry') {
          const b = mesh(new THREE.ConeGeometry(0.075, 0.15, 12), toon('#d9363e'), px, py, pz, root); b.rotation.x = Math.PI;
          mesh(new THREE.ConeGeometry(0.06, 0.04, 6), leaf, px, py + 0.08, pz, root);
        } else if (fruit === 'grape') {
          for (let k = 0; k < 6; k++) mesh(new THREE.SphereGeometry(0.045, 10, 8), toon('#6d4c9f'), px + (k % 3 - 1) * 0.045, py + 0.04 - Math.floor(k / 3) * 0.05, pz + (k % 2) * 0.03, root);
        } else {   // orange
          mesh(new THREE.SphereGeometry(0.09, 16, 12), toon('#f29a2e'), px, py + 0.02, pz, root);
          mesh(new THREE.BoxGeometry(0.06, 0.01, 0.03), leaf, px + 0.03, py + 0.11, pz, root);
        }
      }
    }
    this.w.staticBox(Z.x + x, 0.3, Z.z + z, 0.42, 0.3, 0.35);
  }

  barrel(root, Z, x, z) {
    mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 14), toon('#9a6440'), x, 0.4, z, root);
    for (const y of [0.15, 0.65]) mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 18), toon('#5b4b49'), x, y, z, root).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 12), toon('#cfd4d8'), x + 0.55, 0.25, z + 0.2, root);   // milk can
    mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.12, 12), toon('#cfd4d8'), x + 0.55, 0.56, z + 0.2, root);
    this.w.staticCylinder(Z.x + x + 0.2, Z.z + z + 0.1, 0.6, 0.8);
  }

  floorPattern(key, g, s) {
    if (key === 'frontend') {          // layout grid
      for (let i = 64; i < s; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    } else if (key === 'ai') {         // circuit traces
      for (let i = 0; i < 40; i++) {
        let x = 100 + Math.random() * 824, y = 100 + Math.random() * 824;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { if (k % 2) x += (Math.random() - 0.5) * 220; else y += (Math.random() - 0.5) * 220; g.lineTo(x, y); }
        g.stroke(); g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
      }
    } else if (key === 'data') {       // scatter + axes
      g.beginPath(); g.moveTo(160, 840); g.lineTo(880, 840); g.moveTo(160, 840); g.lineTo(160, 200); g.stroke();
      for (let i = 0; i < 160; i++) { g.beginPath(); g.arc(200 + Math.random() * 660, 240 + Math.random() * 580, 5, 0, 7); g.fill(); }
    } else {                           // ruled notebook lines
      for (let i = 80; i < s; i += 48) { g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    }
  }

  sign(e) {
    return woodSign({
      width: 2.8, height: 1.5, post: 0.75, lean: -0.78,
      draw: (g, w, h) => {
        g.textAlign = 'center';
        // the area name, burnt into the top plank like a ranch sign
        g.fillStyle = e.color; g.font = '900 104px Nunito, sans-serif'; g.fillText(e.area.toUpperCase(), w / 2, 130, w - 80);
        g.fillStyle = INK; g.font = '900 84px Nunito, sans-serif'; g.fillText(e.title, w / 2, 262, w - 80);
        g.fillStyle = '#5a3a1e'; g.font = '800 46px Nunito, sans-serif'; g.fillText(e.org, w / 2, 350, w - 80);
        g.fillText(e.when, w / 2, 412, w - 80);
        g.font = '800 34px Nunito, sans-serif'; g.fillStyle = '#7a5230'; g.fillText('press Enter for details', w / 2, h - 44);
        g.textAlign = 'left';
      },
    });
  }

  // ---------------- Frontend: UI Plaza — a little design studio ----------------
  uiPlaza(root, Z) {
    const wood = toon('#8a5a3c'), dark = toon('#6b4a33');
    const PALETTE = ['#e07a5f', '#f2cc8f', '#81b29a', '#5b8fb9', '#6d597a', '#fff4e2'];

    // the easel: a golden-ratio composition that is being edited
    const easel = new THREE.Group(); easel.position.set(0, 0, -2.5); root.add(easel);
    for (const [x, rz] of [[-0.75, 0.12], [0.75, -0.12]]) { const l = mesh(new THREE.BoxGeometry(0.09, 2.7, 0.09), wood, x, 1.3, 0, easel); l.rotation.z = rz; }
    const back = mesh(new THREE.BoxGeometry(0.09, 2.5, 0.09), wood, 0, 1.15, -0.55, easel); back.rotation.x = 0.4;
    mesh(new THREE.BoxGeometry(2.0, 0.08, 0.2), dark, 0, 0.82, 0.08, easel);
    const art = canvasTexture(1024, 640, (g, w, h) => {
      g.fillStyle = '#fff8ee'; g.fillRect(0, 0, w, h);
      // fibonacci rectangles laid out by the golden ratio
      const H = h - 80, W = H * 1.618;
      let rx = (w - W) / 2, ry = 40, rw = W, rh = H;
      const squares = [];
      for (let i = 0; i < 8; i++) {       // carve squares off the golden rectangle: left, top, right, bottom, …
        const dir = i % 4;
        if (dir === 0) { squares.push([rx, ry, rh, dir]); rx += rh; rw -= rh; }
        else if (dir === 1) { squares.push([rx, ry, rw, dir]); ry += rw; rh -= rw; }
        else if (dir === 2) { squares.push([rx + rw - rh, ry, rh, dir]); rw -= rh; }
        else { squares.push([rx, ry + rh - rw, rw, dir]); rh -= rw; }
      }
      squares.forEach(([sx, sy, side], i) => {
        g.fillStyle = PALETTE[i % PALETTE.length]; g.fillRect(sx, sy, side, side);
        g.strokeStyle = '#2e1f12'; g.lineWidth = 6; g.strokeRect(sx, sy, side, side);
      });
      // golden spiral through the squares
      g.strokeStyle = '#2e1f12'; g.lineWidth = 7;
      const corners = [[1, 1, Math.PI, Math.PI * 1.5], [0, 1, Math.PI * 1.5, Math.PI * 2], [0, 0, 0, Math.PI / 2], [1, 0, Math.PI / 2, Math.PI]];
      squares.forEach(([sx, sy, side, dir]) => {
        const [cx, cy, a0, a1] = corners[dir];
        g.beginPath(); g.arc(sx + cx * side, sy + cy * side, side, a0, a1); g.stroke();
      });
      g.fillStyle = '#2e1f12'; g.font = '900 54px Nunito, sans-serif'; g.fillText('φ = 1.618', w - 280, h - 26);
    });
    const canvas = mesh(new THREE.BoxGeometry(2.3, 1.44, 0.06), [dark, dark, dark, dark, new THREE.MeshToonMaterial({ map: art, emissiveMap: art, emissive: '#ffffff', emissiveIntensity: 0.25 }), dark], 0, 1.65, 0.12, easel);
    canvas.rotation.x = -0.35;
    // selection box with handles, resizing around part of the artwork
    const sel = new THREE.Group(); sel.position.z = 0.05; canvas.add(sel);
    const blue = new THREE.MeshBasicMaterial({ color: '#2f80ed' });
    const edges = [0, 1, 2, 3].map(() => mesh(new THREE.BoxGeometry(1, 0.02, 0.01), blue, 0, 0, 0, sel));
    const handles = [0, 1, 2, 3].map(() => mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0, 0, 0, sel));
    handles.forEach((hd) => mesh(new THREE.BoxGeometry(0.09, 0.09, 0.01), blue, 0, 0, -0.006, hd));
    const arrow = new THREE.Shape([[0, 0], [0, -1], [0.28, -0.75], [0.48, -1.15], [0.62, -1.08], [0.43, -0.68], [0.78, -0.68]].map(([x, y]) => new THREE.Vector2(x, y)));
    const cursor = mesh(new THREE.ExtrudeGeometry(arrow, { depth: 0.04, bevelEnabled: false }), toon('#ffffff'), 0, 0, 0.04, sel);
    mesh(new THREE.ExtrudeGeometry(arrow, { depth: 0.03, bevelEnabled: false }), toon('#2e1f12'), -0.02, 0.03, -0.01, cursor).scale.set(1.12, 1.1, 1);
    cursor.scale.setScalar(0.28);
    this.anims.push((t) => {
      const k = (Math.sin(t * 0.9) + 1) / 2;                 // the corner handle is dragged in and out
      const x0 = -0.45, y0 = 0.42, x1 = 0.05 + k * 0.6, y1 = -0.05 - k * 0.35;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, h = y0 - y1;
      edges[0].position.set(cx, y0, 0); edges[0].scale.x = w;
      edges[1].position.set(cx, y1, 0); edges[1].scale.x = w;
      edges[2].position.set(x0, cy, 0); edges[2].scale.x = h; edges[2].rotation.z = Math.PI / 2;
      edges[3].position.set(x1, cy, 0); edges[3].scale.x = h; edges[3].rotation.z = Math.PI / 2;
      [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([hx, hy], i) => handles[i].position.set(hx, hy, 0));
      cursor.position.set(x1 + 0.02, y1 - 0.02, 0.04);
    });
    this.claim(0, -2.5, 1.5);
    this.w.staticBox(Z.x, 1, Z.z - 2.5, 1.0, 1, 0.45);

    // pen-tool curve: a bezier sculpture whose control points drift
    const pen = new THREE.Group(); pen.position.set(2.6, 0, -0.1); root.add(pen);
    const P = [new THREE.Vector3(-0.8, 0.5, 0), new THREE.Vector3(-0.5, 2.0, 0.2), new THREE.Vector3(0.5, 0.1, -0.2), new THREE.Vector3(0.8, 1.6, 0)];
    const tubeMat = toon('#e07a5f');
    let tube = mesh(new THREE.TubeGeometry(new THREE.CubicBezierCurve3(...P), 48, 0.06, 10), tubeMat, 0, 0, 0, pen);
    const pts = P.map((p, i) => mesh(i === 0 || i === 3 ? new THREE.BoxGeometry(0.14, 0.14, 0.14) : new THREE.SphereGeometry(0.08, 16, 12), toon(i === 0 || i === 3 ? '#ffffff' : '#2f80ed'), p.x, p.y, p.z, pen));
    const handleLine = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([P[0], P[1], P[2], P[3]]), new THREE.LineBasicMaterial({ color: '#2f80ed' }));
    pen.add(handleLine);
    mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.15, 24), dark, 0, 0.07, 0, pen);
    this.anims.push((t) => {
      P[1].set(-0.5 + Math.sin(t * 0.7) * 0.35, 2.0 + Math.cos(t * 0.9) * 0.2, 0.2);
      P[2].set(0.5 + Math.cos(t * 0.6) * 0.3, 0.1 + Math.sin(t * 0.8) * 0.25, -0.2);
      pts[1].position.copy(P[1]); pts[2].position.copy(P[2]);
      tube.geometry.dispose();
      tube.geometry = new THREE.TubeGeometry(new THREE.CubicBezierCurve3(...P), 48, 0.06, 10);
      handleLine.geometry.setFromPoints([P[0], P[1], P[2], P[3]]);
    });
    this.claim(2.6, -0.1, 1.1);
    this.w.staticCylinder(Z.x + 2.6, Z.z - 0.1, 0.45, 0.3);

    // painter's palette on a stool, with blobs of the palette colours and a brush
    const stool = new THREE.Group(); stool.position.set(-2.6, 0, 0.3); root.add(stool);
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), wood, 0, 0.62, 0, stool);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.62, 8), dark, Math.cos(a) * 0.28, 0.31, Math.sin(a) * 0.28, stool); leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); }
    const ps = new THREE.Shape(); ps.absellipse(0, 0, 0.42, 0.3, 0, Math.PI * 2);
    const hole = new THREE.Path(); hole.absellipse(-0.24, -0.08, 0.06, 0.05, 0, Math.PI * 2, true); ps.holes.push(hole);
    const pal = mesh(new THREE.ExtrudeGeometry(ps, { depth: 0.03, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.01 }), toon('#d9b27a'), 0, 0.68, 0, stool);
    pal.rotation.x = -Math.PI / 2;
    PALETTE.slice(0, 5).forEach((c, i) => {
      const a = -0.6 + i * 0.5;
      mesh(new THREE.SphereGeometry(0.06, 14, 10), toon(c), Math.cos(a) * 0.26, 0.72, -Math.sin(a) * 0.18 + 0.02, stool).scale.y = 0.45;
    });
    const brush = mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.55, 8), toon('#c48a5a'), 0.1, 0.75, 0.12, stool);
    brush.rotation.z = Math.PI / 2.3;
    mesh(new THREE.ConeGeometry(0.03, 0.09, 8), toon('#5b8fb9'), 0.36, 0.86, 0.12, stool).rotation.z = -1.2;
    this.claim(-2.6, 0.3, 0.8);
    this.w.staticCylinder(Z.x - 2.6, Z.z + 0.3, 0.45, 0.7);

    // the real-time map from the 44+ Inc days, as a little table with cars driving round
    const mapTex = canvasTexture(512, 512, (g, s) => {
      g.fillStyle = '#e8efe1'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#cfe0c0'; for (let i = 0; i < 9; i++) g.fillRect(30 + (i % 3) * 165, 30 + Math.floor(i / 3) * 165, 120, 120);
      g.fillStyle = '#9fc2df'; g.beginPath(); g.ellipse(420, 90, 60, 40, 0.3, 0, 7); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 26;
      for (const v of [165, 330]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, s); g.moveTo(0, v); g.lineTo(s, v); g.stroke(); }
    });
    const tableWood = toon('#a8714a');
    const map = mesh(new THREE.BoxGeometry(1.8, 0.08, 1.8), [tableWood, tableWood, new THREE.MeshToonMaterial({ map: mapTex }), tableWood, tableWood, tableWood], 0.9, 0.6, 2.1, root);
    for (const [lx, lz] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) mesh(new THREE.BoxGeometry(0.1, 0.58, 0.1), dark, 0.9 + lx, 0.29, 2.1 + lz, root);
    this.w.staticBox(Z.x + 0.9, 0.33, Z.z + 2.1, 0.95, 0.33, 0.95);
    this.claim(0.9, 2.1, 1.3);
    const road = [[-0.32, -0.9], [-0.32, 0.9], [0.32, 0.9], [0.32, -0.9]];
    ['#e07a5f', '#5b8fb9'].forEach((c, i) => {
      const car = new THREE.Group();
      mesh(rbox(0.13, 0.08, 0.22, 0.03), toon(c), 0, 0.05, 0, car);
      const pin = mesh(new THREE.ConeGeometry(0.06, 0.16, 12), glow(c, 0.8), 0, 0.34, 0, car); pin.rotation.x = Math.PI;
      mesh(new THREE.SphereGeometry(0.075, 16, 12), glow(c, 0.8), 0, 0.45, 0, car);
      map.add(car);
      this.anims.push((t) => {
        const p = ((t * 0.12 + i / 2) % 1) * 4, seg = Math.floor(p), k = p - seg;
        const a = road[seg], b = road[(seg + 1) % 4];
        car.position.set(a[0] + (b[0] - a[0]) * k, 0.05, a[1] + (b[1] - a[1]) * k);
        car.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      });
    });

    // a colour-palette garden: one pot per palette colour, each with a tulip
    PALETTE.slice(0, 5).forEach((c, i) => {
      const a = 2.05 + i * 0.26, x = Math.cos(a) * 3.6, z = Math.sin(a) * 3.6;
      mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 20), toon(c), x, 0.15, z, root);
      mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 20), toon(c), x, 0.31, z, root);
      mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), toon('#6b4a33'), x, 0.32, z, root);
      this.flowers(root, 'tulip', x, z, 1, 0.6);
      this.claim(x, z, 0.3);
      this.w.staticCylinder(Z.x + x, Z.z + z, 0.22, 0.35);
    });

    // a giant pencil lying in the straw
    const pencil = new THREE.Group(); pencil.position.set(-0.9, 0.17, 1.15); pencil.rotation.y = 0.55; root.add(pencil);
    const body = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.7, 6), toon('#f4c430'), 0, 0, 0, pencil); body.rotation.z = Math.PI / 2;
    const ferrule = mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.14, 16), toon('#c9c9c9'), -0.92, 0, 0, pencil); ferrule.rotation.z = Math.PI / 2;
    const eraser = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 16), toon('#f4978e'), -1.08, 0, 0, pencil); eraser.rotation.z = Math.PI / 2;
    const shaved = mesh(new THREE.ConeGeometry(0.16, 0.36, 6), toon('#f2d4a8'), 1.03, 0, 0, pencil); shaved.rotation.z = -Math.PI / 2;
    const lead = mesh(new THREE.ConeGeometry(0.055, 0.13, 6), toon('#3d405b'), 1.2, 0, 0, pencil); lead.rotation.z = -Math.PI / 2;
    this.claim(-0.9, 1.15, 1.0);
    this.w.staticBox(Z.x - 0.9, 0.17, Z.z + 1.15, 1.15, 0.17, 0.17, 0.55);

    // wooden letter blocks: a little font specimen
    const blockFace = (txt, bg) => canvasTexture(128, 128, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(46,31,18,.35)'; g.lineWidth = 8; g.strokeRect(6, 6, 116, 116);
      g.fillStyle = '#2e1f12'; g.font = '900 78px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 70);
    });
    [['Aa', '#f2cc8f', 0, 0.22, 0, 0.1], ['B', '#81b29a', 0.5, 0.22, 0.05, -0.2], ['C', '#e07a5f', 0.25, 0.66, 0.02, 0.15]].forEach(([txt, bg, dx, y, dz, ry]) => {
      const tex = blockFace(txt, bg);
      const m = new THREE.MeshToonMaterial({ map: tex });
      const b = mesh(rbox(0.44, 0.44, 0.44, 0.04), m, 2.7 + dx, y, 2.0 + dz, root);
      b.rotation.y = ry;
    });
    this.claim(2.95, 2.0, 0.6);
    this.w.staticBox(Z.x + 2.95, 0.4, Z.z + 2.0, 0.5, 0.4, 0.3);

    // a big wooden set square leaning by the pen sculpture
    const tri = new THREE.Shape([[0, 0], [1.1, 0], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y)));
    tri.holes.push(new THREE.Path([[0.18, 0.15], [0.62, 0.15], [0.18, 0.51]].map(([x, y]) => new THREE.Vector2(x, y))));
    const square = mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }), toon('#d9b27a'), 3.2, 0.05, -2.1, root);
    square.rotation.set(-0.25, -0.7, 0);
  }

  // ---------------- AI Engineer: Agent Lab ----------------
  agentLab(root, Z) {
    // friendly farmhand robot (rounded, so it reads as a toy rather than a box)
    const bot = new THREE.Group();
    const shell = toon('#f3f1ec'), accent = toon('#8a6fd1'), dark = toon('#2b2d42');
    mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.22, 32), accent, 0, 0.11, 0, bot);
    const tire = mesh(new THREE.TorusGeometry(0.52, 0.07, 12, 40), dark, 0, 0.12, 0, bot); tire.rotation.x = Math.PI / 2;
    mesh(rbox(1.0, 0.92, 0.78, 0.22), shell, 0, 0.78, 0, bot);
    mesh(rbox(0.56, 0.36, 0.06, 0.08), glow('#8a6fd1', 0.7), 0, 0.84, 0.38, bot);
    for (const x of [-0.14, 0, 0.14]) mesh(new THREE.SphereGeometry(0.035, 12, 10), glow('#ffd28a', 1.4), x, 0.62, 0.4, bot);
    mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.16, 20), accent, 0, 1.3, 0, bot);
    const head = new THREE.Group(); head.position.set(0, 1.68, 0); bot.add(head);
    mesh(rbox(0.96, 0.7, 0.72, 0.24), shell, 0, 0, 0, head);
    mesh(rbox(0.78, 0.5, 0.05, 0.14), dark, 0, 0, 0.35, head);
    const eyes = [-0.17, 0.17].map((x) => { const e = mesh(new THREE.CapsuleGeometry(0.06, 0.1, 6, 16), glow('#7af0ff', 1.6), x, 0.04, 0.39, head); return e; });
    const smile = mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20, Math.PI), glow('#7af0ff', 1.2), 0, -0.1, 0.39, head); smile.rotation.z = Math.PI;
    for (const x of [-0.3, 0.3]) mesh(new THREE.SphereGeometry(0.045, 12, 10), toon('#f4978e'), x, -0.1, 0.38, head);
    for (const s of [-1, 1]) { const ear = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), accent, s * 0.5, 0, 0, head); ear.rotation.z = Math.PI / 2; }
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), shell, 0.12, 0.5, 0, head);
    const bulb = mesh(new THREE.SphereGeometry(0.07, 16, 12), glow('#ff9e4a', 2), 0.12, 0.68, 0, head);
    // a farmhand's straw hat
    const straw = toon('#e9c46a');
    mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.04, 40), straw, 0, 0.36, 0, head);
    mesh(new THREE.CylinderGeometry(0.3, 0.37, 0.24, 32), straw, 0, 0.48, 0, head);
    mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.07, 32), toon('#b5484e'), 0, 0.4, 0, head);
    const arms = [-1, 1].map((s) => {
      const arm = new THREE.Group(); arm.position.set(s * 0.6, 1.08, 0); bot.add(arm);
      mesh(new THREE.CapsuleGeometry(0.08, 0.4, 8, 16), accent, 0, -0.26, 0, arm);
      mesh(new THREE.SphereGeometry(0.13, 20, 16), shell, 0, -0.56, 0, arm);
      return arm;
    });
    bot.position.set(-2.0, 0, -0.5);
    root.add(bot);
    this.claim(-2.0, -0.5, 1.0);
    this.w.staticCylinder(Z.x - 2.0, Z.z - 0.5, 0.6, 2);
    const botWorld = new THREE.Vector3(Z.x - 2.0, 0, Z.z - 0.5);
    this.anims.push((t, player) => {
      const look = Math.atan2(player.x - botWorld.x, player.z - botWorld.z);
      head.rotation.y = THREE.MathUtils.clamp(look, -1, 1) * 0.8;
      bot.position.y = Math.sin(t * 2) * 0.04;
      arms[1].rotation.z = 2.4 + Math.sin(t * 5) * 0.45;      // waving
      arms[0].rotation.z = -0.15;
      const blink = Math.sin(t * 0.9) > 0.97 ? 0.15 : 1;
      eyes.forEach((e) => (e.scale.y = blink));
      eyes.forEach((e) => (e.position.x = Math.sign(e.position.x) * 0.17 + THREE.MathUtils.clamp(look, -1, 1) * 0.02));
      bulb.material.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.8;
    });

    // chat bubbles that cycle above the robot
    const lines = ['Hi! I’m an agent.', 'Retrieving 1,000 candidates…', 'Re-ranking with an LLM…', 'Here are your top 10 ✨'];
    const bubbles = lines.map((l) => { const s = label(l, { color: '#2b2d42', bg: '#ffffff', w: 3.1, h: 0.62 }); s.visible = false; root.add(s); return s; });
    this.anims.push((t) => {
      const i = Math.floor(t / 2.6) % bubbles.length;
      bubbles.forEach((b, k) => { b.visible = k === i; b.position.set(-2.0, 3.2 + Math.sin(t * 2) * 0.05, -0.5); });
    });

    // re-ranking podium: cards hop between places
    const podium = new THREE.Group(); podium.position.set(1.9, 0, 1.0); root.add(podium);
    this.claim(1.9, 1.0, 1.4);
    const places = [[0, 0.9], [-0.85, 0.6], [0.85, 0.4]];
    places.forEach(([x, h], i) => {
      mesh(rbox(0.8, h, 0.8, 0.06), toon(['#f2c14e', '#cfd4d8', '#d9a066'][i]), x, h / 2, 0, podium);
      const num = canvasTexture(128, 128, (g) => {
        g.fillStyle = 'rgba(255,250,240,.92)'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
        g.fillStyle = '#2e1f12'; g.font = '900 84px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 64, 70);
      });
      const plate = mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshToonMaterial({ map: num, transparent: true }), x, h * 0.45, 0.405, podium);
      plate.renderOrder = 1;
    });
    this.w.staticBox(Z.x + 1.9, 0.45, Z.z + 1.0, 1.25, 0.45, 0.4);
    // the "candidates" being re-ranked are fruit: an apple, a banana and an orange
    const leaf = toon('#5f8f44');
    const apple = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.2, 24, 18), toon('#d9363e'), 0, 0, 0, apple).scale.y = 0.9;
    mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 6), toon('#6b4a33'), 0, 0.22, 0, apple);
    mesh(new THREE.CapsuleGeometry(0.03, 0.08, 4, 8), leaf, 0.06, 0.25, 0, apple).rotation.z = -1.1;
    const banana = new THREE.Group();
    const arc = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.26, 0.1, 0), new THREE.Vector3(0, -0.14, 0), new THREE.Vector3(0.26, 0.1, 0));
    mesh(new THREE.TubeGeometry(arc, 24, 0.07, 12), toon('#f4d03f'), 0, 0, 0, banana);
    for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.035, 10, 8), toon('#6b4a33'), sx * 0.27, 0.11, 0, banana);
    const orange = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.19, 24, 18), toon('#f29a2e'), 0, 0, 0, orange);
    mesh(new THREE.CapsuleGeometry(0.03, 0.08, 4, 8), leaf, 0.05, 0.2, 0, orange).rotation.z = -1.2;
    const cards = [apple, banana, orange];
    cards.forEach((c) => podium.add(c));
    let order = [0, 1, 2], lastSwap = 0;
    this.anims.push((t) => {
      if (t - lastSwap > 3) { lastSwap = t; order = [...order].sort(() => Math.random() - 0.5); }
      cards.forEach((c, ci) => {
        const place = places[order.indexOf(ci)];
        const target = new THREE.Vector3(place[0], place[1] + 0.22, 0);
        c.position.lerp(target, 0.08);
        c.position.y += Math.sin((t - lastSwap) * Math.PI) * 0.02 * (t - lastSwap < 1 ? 1 : 0);
        c.rotation.y = Math.sin(t + ci) * 0.3;
      });
    });

    // agent graph: tools connected to an LLM core, pulses travel along the edges
    const core = new THREE.Vector3(1.3, 2.8, -2.9);
    const tools = [['search', -0.4, 2.25, -3.3], ['rank', 3.0, 2.25, -3.3], ['memory', 0.2, 3.95, -3.4], ['tools', 2.5, 3.95, -2.9]];
    this.claim(1.3, -3.0, 1.9);
    const llm = new THREE.Group();
    for (let i = 0; i < 6; i++) {   // a soft orange sparkle for the language model
      const ray = mesh(new THREE.CapsuleGeometry(0.07, 0.42, 8, 16), glow('#e8875b', 1.1), 0, 0, 0, llm);
      ray.rotation.z = (i * Math.PI) / 6;
    }
    llm.position.copy(core); llm.scale.setScalar(1.4); root.add(llm);
    const pulses = [];
    for (const [name, x, y, z] of tools) {
      const p = new THREE.Vector3(x, y, z);
      mesh(new THREE.SphereGeometry(0.24, 24, 16), glow('#8a6fd1', 0.7), x, y, z, root);
      const tl = label(name, { w: 1.3, h: 0.42, color: '#fff', bg: '#8a6fd1' });
      tl.position.set(x, y + 0.46, z); root.add(tl);
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([core, p]), new THREE.LineBasicMaterial({ color: '#b9a8ea' })));
      const pulse = mesh(new THREE.SphereGeometry(0.09, 14, 10), glow('#ffd28a', 2.5), 0, 0, 0, root);
      pulses.push({ pulse, p, off: Math.random() });
    }
    this.anims.push((t) => {
      llm.rotation.z = t * 0.6; llm.rotation.y = Math.sin(t * 0.7) * 0.5;
      llm.scale.setScalar(1.4 * (1 + Math.sin(t * 3) * 0.06));
      for (const { pulse, p, off } of pulses) {
        const k = (t * 0.6 + off) % 1;
        pulse.position.lerpVectors(core, p, k < 0.5 ? k * 2 : 2 - k * 2);
      }
    });

    // chalkboard on a wooden easel: the retrieval → ranking pipeline
    const board = canvasTexture(1024, 640, (g, w, h) => {
      g.fillStyle = '#2f3b33'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 30;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); }
      g.fillStyle = '#f4f1e8'; g.font = '700 54px "Comic Sans MS", Nunito, sans-serif'; g.fillText('today’s plan:', 50, 90);
      const steps = ['retrieve', 'rank', 'LLM re-rank', 'answer ✓'];
      g.font = '700 46px "Comic Sans MS", Nunito, sans-serif';
      steps.forEach((t, i) => {
        const x = 60 + (i % 2) * 470, y = 220 + Math.floor(i / 2) * 210;
        g.strokeStyle = ['#f2cc8f', '#9ad1d4', '#e8a0bf', '#a8e6a1'][i]; g.lineWidth = 7;
        g.strokeRect(x, y - 70, 390, 110);
        g.fillStyle = '#f4f1e8'; g.fillText(t, x + 30, y + 2);
      });
      g.strokeStyle = '#f4f1e8'; g.lineWidth = 6;
      [[450, 205, 530, 205], [790, 260, 790, 340], [530, 415, 450, 415]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    });
    const cb = new THREE.Group(); cb.position.set(-2.7, 0, -2.6); cb.rotation.y = 0.45; root.add(cb);
    const woodC = toon('#8a5a3c');
    for (const [x, rz] of [[-0.7, 0.1], [0.7, -0.1]]) { const l = mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), woodC, x, 1.05, 0, cb); l.rotation.z = rz; }
    const chalk = mesh(new THREE.BoxGeometry(1.8, 1.12, 0.06), [woodC, woodC, woodC, woodC, new THREE.MeshToonMaterial({ map: board, emissiveMap: board, emissive: '#ffffff', emissiveIntensity: 0.2 }), woodC], 0, 1.4, 0.08, cb);
    chalk.rotation.x = -0.35;
    mesh(new THREE.BoxGeometry(1.7, 0.05, 0.14), woodC, 0, 0.82, 0.18, cb);
    this.claim(-2.7, -2.6, 1.1);
    this.w.staticBox(Z.x - 2.7, 1, Z.z - 2.6, 0.9, 1, 0.3, 0.45);

    // a neural-net bonsai: glowing nodes for leaves, wired together
    const bonsai = new THREE.Group(); bonsai.position.set(3.1, 0, -0.6); root.add(bonsai);
    mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.35, 24), toon('#6d597a'), 0, 0.17, 0, bonsai);
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.12, 0.7, 0), new THREE.Vector3(-0.08, 1.05, 0.05), new THREE.Vector3(0.05, 1.3, 0)]);
    mesh(new THREE.TubeGeometry(trunk, 20, 0.05, 8), toon('#7b5238'), 0, 0, 0, bonsai);
    const layers = [[-0.45, 0, 0.45], [-0.6, -0.2, 0.2, 0.6], [-0.3, 0.3]];
    const nodePts = layers.map((xs, li) => xs.map((x) => new THREE.Vector3(x, 1.25 + li * 0.32, (li % 2) * 0.08)));
    const wires = [];
    for (let li = 0; li < nodePts.length - 1; li++) for (const a of nodePts[li]) for (const b of nodePts[li + 1]) wires.push(a, b);
    bonsai.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wires), new THREE.LineBasicMaterial({ color: '#b9a8ea', transparent: true, opacity: 0.8 })));
    const nodes = nodePts.flat().map((p, i) => mesh(new THREE.SphereGeometry(0.09, 16, 12), glow(['#8a6fd1', '#7af0ff', '#81b29a'][i % 3], 0.9), p.x, p.y, p.z, bonsai));
    this.anims.push((t) => nodes.forEach((n, i) => { n.material.emissiveIntensity = 0.6 + Math.max(0, Math.sin(t * 3 - i * 0.6)) * 1.4; }));
    this.claim(3.1, -0.6, 0.7);
    this.w.staticCylinder(Z.x + 3.1, Z.z - 0.6, 0.35, 0.4);

    // an open toolbox, for an agent's tool use
    const tb = new THREE.Group(); tb.position.set(-2.9, 0, 1.9); tb.rotation.y = 0.4; root.add(tb);
    mesh(rbox(0.9, 0.38, 0.45, 0.05), toon('#c8574d'), 0, 0.19, 0, tb);
    const lid = mesh(rbox(0.9, 0.06, 0.45, 0.03), toon('#b5484e'), 0, 0.42, -0.24, tb); lid.rotation.x = -1.1;
    const handle = mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 20, Math.PI), toon('#3d405b'), 0, 0.4, 0, tb);
    const wrench = new THREE.Group(); wrench.position.set(-0.15, 0.48, 0.05); wrench.rotation.z = 0.5; tb.add(wrench);
    mesh(rbox(0.06, 0.5, 0.03, 0.01), toon('#c9c9c9'), 0, 0, 0, wrench);
    mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16, Math.PI * 1.5), toon('#c9c9c9'), 0, 0.27, 0, wrench);
    const hammer = new THREE.Group(); hammer.position.set(0.2, 0.5, 0); hammer.rotation.z = -0.4; tb.add(hammer);
    mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 8), toon('#c48a5a'), 0, 0, 0, hammer);
    mesh(rbox(0.22, 0.08, 0.08, 0.02), toon('#5b6170'), 0, 0.26, 0, hammer);
    this.claim(-2.9, 1.9, 0.6);
    this.w.staticBox(Z.x - 2.9, 0.25, Z.z + 1.9, 0.5, 0.25, 0.3, 0.4);

    // a little helper drone buzzing around the robot
    const drone = new THREE.Group(); root.add(drone);
    mesh(new THREE.SphereGeometry(0.16, 20, 14), toon('#f3f1ec'), 0, 0, 0, drone).scale.y = 0.7;
    mesh(new THREE.SphereGeometry(0.06, 12, 10), glow('#7af0ff', 1.6), 0, 0, 0.13, drone);
    const rotors = [-1, 1].map((sx) => {
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), toon('#8a6fd1'), sx * 0.11, 0.08, 0, drone).rotation.z = sx * 0.6;
      const r = mesh(new THREE.BoxGeometry(0.28, 0.01, 0.04), toon('#3d405b'), sx * 0.2, 0.17, 0, drone);
      return r;
    });
    this.anims.push((t) => {
      drone.position.set(-2.0 + Math.cos(t * 0.8) * 1.3, 2.4 + Math.sin(t * 1.7) * 0.15, -0.5 + Math.sin(t * 0.8) * 1.0);
      drone.rotation.y = -t * 0.8;
      rotors.forEach((r) => (r.rotation.y = t * 30));
    });
  }

  // ---------------- DS&AI: Data Observatory ----------------
  observatory(root, Z) {
    // pipeline: source → transform gear → warehouse
    mesh(new THREE.BoxGeometry(4.2, 0.18, 0.7), toon('#8a5a3c'), 0, 0.45, -2.2, root);
    for (const x of [-1.8, 0, 1.8]) mesh(new THREE.BoxGeometry(0.12, 0.45, 0.6), toon('#6b4a33'), x, 0.22, -2.2, root);
    this.w.staticBox(Z.x, 0.4, Z.z - 2.2, 2.6, 0.4, 0.4);
    this.claim(-2.5, -2.2, 0.8); this.claim(0, -2.2, 1.2); this.claim(2.5, -2.2, 0.9);
    // the warehouse is a grain silo — a data silo
    const db = new THREE.Group(); db.position.set(2.5, 0, -2.2); root.add(db);
    mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 40), toon('#cfd4d8'), 0, 1.1, 0, db);
    for (let i = 0; i < 5; i++) mesh(new THREE.TorusGeometry(0.605, 0.02, 6, 24), toon('#9aa3ad'), 0, 0.3 + i * 0.42, 0, db).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.6, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), toon('#4d908e'), 0, 2.2, 0, db);
    const siloSign = label('Data silo', { color: '#fff', bg: '#4d908e', w: 1.2, h: 0.32 });
    siloSign.position.set(0, 2.95, 0); db.add(siloSign);
    const src = mesh(new THREE.BoxGeometry(0.8, 1.1, 0.8), toon('#a8714a'), -2.5, 0.55, -2.2, root);
    src.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.02), glow('#4d908e', 0.6), 0, 0.2, 0.41));
    const gear = new THREE.Group(); gear.position.set(0, 1.05, -2.2); root.add(gear);
    mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.14, 16), toon('#f2c14e'), 0, 0, 0, gear).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const tooth = mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), toon('#f2c14e'), 0, 0, 0, gear);
      const a = (i / 8) * Math.PI * 2; tooth.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0); tooth.rotation.z = a;
    }
    const packets = Array.from({ length: 6 }, (_, i) => mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), toon(i % 3 ? '#9be2d6' : '#ffffff'), 0, 0.66, -2.2, root));
    this.w.staticCylinder(Z.x + 2.5, Z.z - 2.2, 0.62, 2.6);
    this.w.staticBox(Z.x - 2.5, 0.55, Z.z - 2.2, 0.4, 0.55, 0.4);
    this.anims.push((t) => {
      gear.rotation.z = -t * 1.5;
      packets.forEach((p, i) => {
        const k = (t * 0.18 + i / packets.length) % 1;
        p.position.x = -2 + k * 4;
        const cleaned = k > 0.5;   // after the transform step the data is tidy
        p.scale.setScalar(cleaned ? 0.8 : 1);
        p.rotation.y = cleaned ? 0 : t * 2 + i;
      });
    });

    // fraud detection: an apple tree full of good apples, a couple of glowing bad apples, a magnifier finding them
    const pts = new THREE.Group(); pts.position.set(-1.7, 0, 0.9); root.add(pts);
    this.claim(-1.7, 0.9, 1.3);
    mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 8), toon('#7b5238'), 0, 0.95, 0, pts);
    const canopy = addWind(toon('#6fa35e'), 0.03);
    [[0, 2.35, -0.1, 0.95], [-0.6, 2.15, -0.1, 0.6], [0.6, 2.2, -0.3, 0.62]].forEach(([x, y, z, r]) => {
      const c = mesh(new THREE.IcosahedronGeometry(r, 0), canopy, x, y, z, pts); c.scale.y = 0.7;
    });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.75;
      mesh(new THREE.SphereGeometry(0.09, 14, 10), toon('#a8c256'), Math.cos(a) * r, 1.0 + Math.random() * 0.35, Math.sin(a) * r, pts);
    }
    this.w.staticCylinder(Z.x - 1.7, Z.z + 0.9, 0.25, 2);
    const outliers = [[0.85, 1.15, 0.55], [-0.75, 1.2, 0.35]].map(([x, y, z]) => mesh(new THREE.SphereGeometry(0.12, 18, 14), glow('#ff4d4d', 1.8), x, y, z, pts));
    const glass = new THREE.Group();
    mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 28), toon('#3d405b'), 0, 0, 0, glass);
    mesh(new THREE.CircleGeometry(0.29, 28), new THREE.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: 0.35 }), 0, 0, 0, glass);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), toon('#8a5a3c'), 0.28, -0.4, 0, glass).rotation.z = 0.6;
    pts.add(glass);
    const flag = label('Bad apple?', { color: '#fff', bg: '#e5484d', w: 1.4, h: 0.36, font: 900 });
    pts.add(flag);
    this.anims.push((t) => {
      const i = Math.floor(t / 3) % outliers.length, o = outliers[i];
      glass.position.lerp(new THREE.Vector3(o.position.x - 0.1, o.position.y + 0.1, o.position.z + 0.35), 0.05);
      glass.rotation.y = Math.sin(t) * 0.3;
      flag.position.set(o.position.x, o.position.y + 0.5, o.position.z);
      outliers.forEach((p, k) => { p.material.emissiveIntensity = k === i ? 1.6 + Math.sin(t * 8) * 0.8 : 0.9; });
    });

    // shield + animated bar chart
    const shield = new THREE.Group(); shield.position.set(0.25, 1.4, 0.4); root.add(shield);
    this.claim(0.25, 0.4, 0.6);
    const shape = new THREE.Shape(); shape.moveTo(0, 0.55); shape.quadraticCurveTo(0.45, 0.5, 0.45, 0.2); shape.quadraticCurveTo(0.4, -0.35, 0, -0.6);
    shape.quadraticCurveTo(-0.4, -0.35, -0.45, 0.2); shape.quadraticCurveTo(-0.45, 0.5, 0, 0.55);
    mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), toon('#4d908e'), 0, 0, 0, shield);
    const check = new THREE.Shape([[-0.22, 0], [-0.08, -0.16], [0.24, 0.2], [0.18, 0.26], [-0.08, -0.03], [-0.16, 0.06]].map(([x, y]) => new THREE.Vector2(x, y)));
    mesh(new THREE.ExtrudeGeometry(check, { depth: 0.06, bevelEnabled: false }), toon('#ffffff'), 0, 0, 0.14, shield);
    this.anims.push((t) => { shield.rotation.y = Math.sin(t * 0.8) * 0.5; shield.position.y = 1.4 + Math.sin(t * 1.3) * 0.08; });

    const bars = [0.6, 1.0, 0.8, 1.4, 1.2].map((h, i) => {
      const b = mesh(rbox(0.28, 1, 0.28, 0.06), toon(i === 3 ? '#f2c14e' : '#4d908e'), 1.4 + i * 0.36, 0, 1.0, root);
      return { b, h };
    });
    this.w.staticBox(Z.x + 2.12, 0.5, Z.z + 1.0, 0.95, 0.5, 0.2);
    this.claim(2.12, 1.0, 1.1);
    this.anims.push((t) => bars.forEach(({ b, h }, i) => {
      const v = h * (0.8 + 0.25 * Math.sin(t * 1.2 + i));
      b.scale.y = v; b.position.y = v / 2;
    }));

  }

  // ---------------- Origins: Swinburne + self-taught ----------------
  origins(root, Z) {
    // graduation cap on a pedestal
    mesh(new THREE.CylinderGeometry(0.62, 0.78, 1.1, 28), toon('#7b5238'), 0, 0.55, -0.9, root);
    mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.03, 20), toon('#e8cfa6'), 0, 1.11, -0.9, root);
    for (let i = 0; i < 4; i++) {   // roots
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const r = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.22), toon('#6b4a33'), Math.cos(a) * 0.75, 0.08, -0.9 + Math.sin(a) * 0.75, root);
      r.rotation.y = -a;
    }
    this.w.staticCylinder(Z.x, Z.z - 0.9, 0.75, 1.1);
    this.claim(0, -0.9, 1.1);
    const cap = new THREE.Group(); cap.position.set(0, 1.55, -0.9); root.add(cap);
    mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.3, 32), toon('#2b2d42'), 0, 0, 0, cap);
    mesh(new THREE.BoxGeometry(1.25, 0.06, 1.25), toon('#2b2d42'), 0, 0.18, 0, cap);
    const tassel = new THREE.Group(); tassel.position.set(0, 0.22, 0); cap.add(tassel);
    mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 4), toon('#f2c14e'), 0.31, 0, 0, tassel).rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.32, 8), toon('#f2c14e'), 0.62, -0.16, 0, tassel);
    this.anims.push((t) => { cap.rotation.y = t * 0.4; cap.position.y = 1.55 + Math.sin(t * 1.5) * 0.08; tassel.rotation.y = Math.sin(t * 2) * 0.2; });

    // two "Best Unit Performance" trophies
    [-1.9, 1.9].forEach((x, i) => {
      const tr = new THREE.Group(); tr.position.set(x, 0, -0.3); root.add(tr);
      this.claim(x, -0.3, 0.7);
      mesh(rbox(0.62, 0.34, 0.62, 0.06), toon('#6b4a33'), 0, 0.17, 0, tr);
      mesh(rbox(0.4, 0.1, 0.02, 0.01), toon('#d9b25a'), 0, 0.2, 0.315, tr);
      const gold = toon('#efc14f', { emissive: '#5a3d00', emissiveIntensity: 0.12 });   // warm matte gold, like the rest of the village
      // one smooth lathe for base, stem and cup
      const profile = [[0, 0], [0.22, 0], [0.22, 0.05], [0.1, 0.1], [0.05, 0.16], [0.045, 0.36], [0.09, 0.42], [0.22, 0.5], [0.29, 0.62], [0.31, 0.78], [0.3, 0.8], [0.27, 0.78], [0.25, 0.63], [0.16, 0.54], [0, 0.52]]
        .map(([r, y]) => new THREE.Vector2(r, y));
      mesh(new THREE.LatheGeometry(profile, 40), gold, 0, 0.34, 0, tr);
      for (const s of [-1, 1]) {
        const handle = mesh(new THREE.TorusGeometry(0.12, 0.025, 12, 28, Math.PI), gold, s * 0.3, 1.0, 0, tr);
        handle.rotation.z = -s * Math.PI / 2;
      }
      mesh(new THREE.SphereGeometry(0.06, 16, 12), gold, 0, 1.22, 0, tr).scale.y = 0.4;
      const l = plaque(i ? 'AI for Engineers' : 'Interface Design');
      l.position.set(0, 1.6, 0); tr.add(l);
      this.w.staticCylinder(Z.x + x, Z.z - 0.3, 0.35, 1.2);
    });

    // books, diploma scroll and the 2021 laptop where it all started
    this.claim(-1.2, 1.0, 0.6); this.claim(1.25, 1.0, 0.6); this.claim(0, 1.3, 0.6);
    ['#e07a5f', '#81b29a', '#f2cc8f', '#5b8fb9'].forEach((c, i) => mesh(new THREE.BoxGeometry(0.75, 0.14, 0.55), toon(c), -1.2, 0.07 + i * 0.14, 1.0, root).rotation.y = i * 0.25);
    const scroll = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12), toon('#fff6e6'), 1.25, 0.12, 1.0, root);
    scroll.rotation.z = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.105, 0.025, 6, 16), toon('#e5484d'), 0, 0, 0, scroll).rotation.y = Math.PI / 2;
    const laptop = new THREE.Group(); laptop.position.set(0, 0, 1.3); root.add(laptop);
    mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), toon('#9aa3ad'), 0, 0.03, 0, laptop);
    const screenTex = canvasTexture(256, 160, (g, w, h) => {
      g.fillStyle = '#2b2d42'; g.fillRect(0, 0, w, h);
      g.font = '700 18px monospace';
      ['# 2021', 'import torch', 'print("hello, ML")'].forEach((l, i) => { g.fillStyle = ['#8f9bb3', '#f2cc8f', '#81b29a'][i]; g.fillText(l, 14, 40 + i * 34); });
    });
    const screen = mesh(new THREE.BoxGeometry(0.9, 0.58, 0.04), [toon('#9aa3ad'), toon('#9aa3ad'), toon('#9aa3ad'), toon('#9aa3ad'), new THREE.MeshBasicMaterial({ map: screenTex }), toon('#9aa3ad')], 0, 0.32, -0.3, laptop);
    screen.rotation.x = -0.25;
    this.w.staticBox(Z.x - 1.2, 0.3, Z.z + 1.0, 0.4, 0.3, 0.3);
  }

  update(t, player) {
    for (const fn of this.anims) fn(t, player);
  }
}
