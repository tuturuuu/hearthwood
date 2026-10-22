import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { createElement, Github, Linkedin } from 'lucide';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { toon, canvasTexture, addWind } from './toon.js';
import { woodSign, wrapLines, INK } from './signs.js';
import { ZONES } from './scenery.js';
import { PROFILE, PROJECTS, SKILLS } from './profile.js';

/*  Việt's Garden — a Bruno-Simon-style portfolio clearing behind the Reading Grove:
 *  giant physics letters, project boards, a career walkway and social pads. */
const C = ZONES.portfolio;
const FONT = 'https://cdn.jsdelivr.net/fontsource/fonts/nunito@latest';
const LEAF_COLORS = ['#5f9a52', '#6fa35e', '#7fb069', '#4f8a5b', '#8fbf62'];
const FLOWER_COLORS = ['#f4978e', '#fff8ee', '#f4c95d', '#b39ddb'];

const openUrl = (url) => window.open(url, '_blank', 'noopener');

/** Latin + Vietnamese subsets merged into one typeface so "VIỆT PHẠM" keeps its diacritics. */
async function loadFont() {
  const loader = new TTFLoader();
  const [latin, viet] = await Promise.all([
    loader.loadAsync(`${FONT}/latin-900-normal.ttf`),
    loader.loadAsync(`${FONT}/vietnamese-900-normal.ttf`),
  ]);
  latin.glyphs = { ...latin.glyphs, ...viet.glyphs };
  return new Font(latin);
}

function iconImage(iconNode, color) {
  const el = createElement(iconNode);
  el.setAttribute('stroke', color);
  el.setAttribute('width', '256');
  el.setAttribute('height', '256');
  const img = new Image();
  img.src = `data:image/svg+xml;utf8,${encodeURIComponent(el.outerHTML)}`;
  return img.decode().then(() => img);
}

export class Portfolio {
  constructor(w) {
    this.w = w;
    this.group = new THREE.Group();
    w.scene.add(this.group);
    this.pads = [];
    this.buildPlaque();
    this.buildBoards();
    this.buildPads();
    this.buildFountain();
    this.buildBench();
    this.ready = this.buildLetters().catch((e) => console.warn('name letters failed', e));
  }

  // ---------- giant name you can knock over ----------
  async buildLetters() {
    const font = await loadFont();
    const size = 1.7, depth = 0.55, gap = 0.18, space = 0.9;
    const chars = [...PROFILE.name];
    const geos = chars.map((ch) => {
      if (ch === ' ') return null;
      const g = new TextGeometry(ch, { font, size, depth, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 });
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new THREE.Vector3());
      g.translate(-c.x, -c.y, -c.z);
      g.computeBoundingBox();
      return g;
    });
    const widths = geos.map((g) => (g ? g.boundingBox.max.x - g.boundingBox.min.x : space));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    let x = C.x - total / 2;
    geos.forEach((g, i) => {
      const w = widths[i];
      if (g) {
        const s = g.boundingBox.getSize(new THREE.Vector3());
        const mesh = this.topiary(g);
        const body = new CANNON.Body({ mass: 3, material: this.w.world.defaultMaterial,
          shape: new CANNON.Box(new CANNON.Vec3(s.x / 2, s.y / 2, s.z / 2)) });
        body.position.set(x + w / 2, s.y / 2 + 0.02, C.z - 6.3);
        this.w.addProp(mesh, body);
      }
      x += w + gap;
    });
  }

  /** A clipped hedge in the shape of a letter: dark green core covered in leaf clumps and a few flowers. */
  topiary(geo) {
    const core = new THREE.Mesh(geo, toon('#4f8a5b'));
    const sampler = new MeshSurfaceSampler(core).build();
    const count = 170;
    this.leafMat ??= addWind(toon('#ffffff'), 0.02);
    const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.095, 1), this.leafMat, count);
    const p = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      sampler.sample(p, n);
      p.addScaledVector(n, 0.03);
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0));
      const k = 0.75 + Math.random() * 0.5;
      leaves.setMatrixAt(i, m.compose(p, q, sc.set(k, k, k)));
      leaves.setColorAt(i, col.set(LEAF_COLORS[i % LEAF_COLORS.length]));
    }
    leaves.castShadow = true;
    core.add(leaves);
    for (let i = 0; i < 5; i++) {
      sampler.sample(p, n);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(FLOWER_COLORS[i % FLOWER_COLORS.length]));
      f.position.copy(p).addScaledVector(n, 0.16);
      core.add(f);
    }
    return core;
  }

  // ---------- flat text on the ground ----------
  buildPlaque() {
    const tex = canvasTexture(2048, 420, (g, w, h) => {
      g.fillStyle = 'rgba(255,250,240,0.92)';
      g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 70); g.fill();
      g.textAlign = 'center';
      g.fillStyle = '#3d2f2a'; g.font = '800 120px Nunito, sans-serif';
      g.fillText(PROFILE.role, w / 2, 165);
      g.fillStyle = '#8f7a6c'; g.font = '700 70px Nunito, sans-serif';
      g.fillText(`${PROFILE.now}  ·  ${PROFILE.location}`, w / 2, 290);
      g.font = '600 46px Nunito, sans-serif';
      g.fillText('push the letters around — they don’t mind', w / 2, 370);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.76), new THREE.MeshToonMaterial({ map: tex, transparent: true }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(C.x, 0.025, C.z - 3.8);
    m.receiveShadow = true;
    this.group.add(m);
  }

  // ---------- project boards ----------
  drawProject(p) {
    return (g, w, h) => {
      g.fillStyle = INK; g.font = '900 92px Nunito, sans-serif'; g.fillText(p.title, 52, 122, w - 140);
      g.fillStyle = p.color; g.beginPath(); g.arc(w - 72, 92, 26, 0, 7); g.fill();
      g.fillStyle = '#5a3a1e'; g.font = '800 44px Nunito, sans-serif'; g.fillText(p.kind, 54, 186, w - 100);
      g.fillStyle = INK; g.font = '700 44px Nunito, sans-serif';
      wrapLines(g, p.text, w - 110).slice(0, 2).forEach((l, i, arr) => g.fillText(i === 1 && arr.length > 1 && wrapLines(g, p.text, w - 110).length > 2 ? `${l}…` : l, 52, 270 + i * 58));
      let x = 52;
      g.font = '900 36px Nunito, sans-serif';
      for (const t of p.tags) {
        const tw = g.measureText(t).width + 40;
        if (x + tw > w - 40) break;
        g.fillStyle = 'rgba(46,31,18,.14)'; g.beginPath(); g.roundRect(x, 400, tw, 60, 12); g.fill();
        g.fillStyle = INK; g.fillText(t, x + 20, 442);
        x += tw + 14;
      }
      g.fillStyle = '#7a5230'; g.font = '800 34px Nunito, sans-serif';
      g.fillText('press Enter to open on GitHub', 52, h - 48);
    };
  }

  buildBoards() {
    const half = Math.ceil(PROJECTS.length / 2);
    PROJECTS.forEach((p, i) => {
      const side = i < half ? -1 : 1, row = i % half;
      const x = C.x + side * 9.0, z = C.z + 5.4 - row * 3.4;
      const ry = -side * 0.42;
      const g = woodSign({ width: 2.7, height: 1.6, post: 0.75, lean: -0.78, draw: this.drawProject(p), twoPosts: true });
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      this.group.add(g);
      this.w.staticBox(x, 0.9, z, 1.35, 0.9, 0.25, ry);
      const fx = x + Math.sin(ry) * 1.7, fz = z + Math.cos(ry) * 1.7;
      this.w.addInteractable({ x: fx, z: fz, r: 1.5, title: p.title, sub: `${p.kind} — open on GitHub`, key: 'Enter', action: () => openUrl(p.url) });
    });
  }

  // ---------- GitHub / LinkedIn pads ----------
  async buildPads() {
    const pads = [
      { label: 'GitHub', url: PROFILE.links.github, icon: Github, color: '#3d405b', x: C.x - 5.7 },
      { label: 'LinkedIn', url: PROFILE.links.linkedin, icon: Linkedin, color: '#2f6fae', x: C.x + 5.7 },
    ];
    for (const p of pads) {
      const img = await iconImage(p.icon, '#ffffff').catch(() => null);
      const tex = canvasTexture(512, 512, (g, w) => {
        g.fillStyle = p.color; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 6, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 10; g.stroke();
        if (img) g.drawImage(img, 156, 96, 200, 200);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 70px Nunito, sans-serif';
        g.fillText(p.label, w / 2, 390);
      });
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.95, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(p.x, 0.03, C.z - 3.8);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 48), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.6 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pad.position);
      this.group.add(pad, ring);
      this.pads.push(ring);
      this.w.addInteractable({ x: p.x, z: C.z - 3.8, r: 1.1, title: p.label, sub: `Open ${p.label} profile`, key: 'Enter', action: () => openUrl(p.url) });
    }
  }

  buildBench() {
    // a bench facing the fountain and your name
    const wood = toon('#c98a5a');
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), wood);
    seat.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), wood);
    back.position.set(0, 0.85, 0.28);
    g.add(seat, back);
    for (const lx of [-0.95, 0.95]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), toon('#7a4b33'));
      l.position.set(lx, 0.25, 0); g.add(l);
    }
    g.position.set(C.x, 0, C.z + 4.6);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    this.group.add(g);
    this.w.staticBox(C.x, 0.5, C.z + 4.6, 1.1, 0.5, 0.35);
    this.w.seats.push({ name: 'Bench in Việt’s Garden', x: C.x, z: C.z + 4.45, y: 0.56, face: Math.PI });
  }

  // ---------- fountain with the tech stack orbiting above it (middle of the garden) ----------
  buildFountain() {
    const fx = C.x, fz = C.z + 0.6;
    const g = new THREE.Group();
    g.position.set(fx, 0, fz);
    this.group.add(g);
    const stone = toon('#d8d0c2'), dark = toon('#b9b0a1');
    // basin: a stone ring with water inside (same shader as the pond)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.18, 10, 48), stone);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.42;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.42, 48, 1, true), dark);
    wall.position.y = 0.21;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.w.scenery.waterMat);
    water.rotation.x = -Math.PI / 2; water.scale.set(1.5, 1.5, 1); water.position.y = 0.36;
    // column + upper bowl
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.1, 14), stone);
    col.position.y = 0.85;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.22, 0.24, 24), stone);
    bowl.position.y = 1.45;
    const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshStandardMaterial({ color: '#8fd3e8', emissive: '#3f9db5', emissiveIntensity: 0.25 }));
    bowlWater.rotation.x = -Math.PI / 2; bowlWater.position.y = 1.56;
    // the water falling from the bowl into the basin
    const sheet = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.95, 1.05, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#bfe9f5', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    sheet.position.y = 0.95;
    g.add(rim, wall, water, col, bowl, bowlWater, sheet);
    g.traverse((o) => { if (o.isMesh && o !== sheet) { o.castShadow = true; o.receiveShadow = true; } });
    this.w.staticCylinder(fx, fz, 1.75, 0.7);

    // droplets bubbling up from the top
    const drops = Array.from({ length: 18 }, (_, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#e6f7ff' }));
      g.add(d);
      return { d, a: (i / 18) * Math.PI * 2, off: i / 18 };
    });

    // the planet + one ring per skill group, chips orbiting on each ring
    const orbit = new THREE.Group();
    orbit.position.set(0, 2.55, 0);
    g.add(orbit);
    const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 2), new THREE.MeshStandardMaterial({ color: '#f2cc8f', emissive: '#e07a5f', emissiveIntensity: 0.35, flatShading: true }));
    orbit.add(planet);
    const rings = SKILLS.map((grp, gi) => {
      const radius = 1.3 + gi * 0.62;
      const ring = new THREE.Group();
      ring.rotation.set(0.35 + gi * 0.12, 0, (gi - 1) * 0.28);
      orbit.add(ring);
      const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: grp.color, transparent: true, opacity: 0.55 }));
      band.rotation.x = Math.PI / 2;
      ring.add(band);
      const chips = grp.items.map((name, i) => {
        const chip = this.chip(name, grp.color);
        ring.add(chip);
        return { chip, a: (i / grp.items.length) * Math.PI * 2 };
      });
      return { ring, radius, chips, speed: 0.18 - gi * 0.04 };
    });

    this.fountainAnim = (t) => {
      planet.rotation.y = t * 0.3;
      orbit.position.y = 2.55 + Math.sin(t * 0.8) * 0.08;
      for (const r of rings) for (const c of r.chips) {
        const a = c.a + t * r.speed;
        c.chip.position.set(Math.cos(a) * r.radius, 0, Math.sin(a) * r.radius);
      }
      for (const p of drops) {
        const k = (t * 0.7 + p.off) % 1;
        const rr = 0.1 + k * 0.5;
        p.d.position.set(Math.cos(p.a) * rr, 1.6 + Math.sin(k * Math.PI) * 0.35, Math.sin(p.a) * rr);
      }
    };

    const info = {
      area: 'Skills', title: 'Tech stack', org: 'From my projects and work', when: '', color: '#e07a5f',
      points: SKILLS.map((s) => `${s.group}: ${s.items.join(', ')}`),
      tags: SKILLS.map((s) => s.group),
    };
    this.w.addInteractable({ x: fx, z: fz, r: 2.7, title: 'The skills fountain', sub: 'Everything orbiting above it — Enter for the full list',
      action: () => this.w.onInfo?.(info) });
  }

  chip(text, color) {
    const tex = canvasTexture(512, 128, (g, w, h) => {
      g.font = '800 64px Nunito, sans-serif';
      const tw = Math.min(w - 20, g.measureText(text).width + 70);
      const x = (w - tw) / 2;
      g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(x, 10, tw, h - 20, (h - 20) / 2); g.fill();
      g.strokeStyle = color; g.lineWidth = 8; g.stroke();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3, tw - 40);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    s.scale.set(1.9, 0.475, 1);
    return s;
  }

  update(t) {
    this.fountainAnim?.(t);
    this.pads.forEach((r, i) => {
      const s = 1 + Math.sin(t * 2.2 + i) * 0.05;
      r.scale.set(s, s, 1);
      r.material.opacity = 0.45 + Math.sin(t * 2.2 + i) * 0.2;
    });
  }
}
