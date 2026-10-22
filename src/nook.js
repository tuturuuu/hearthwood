import * as THREE from 'three';
import { toon, addWind, canvasTexture } from './toon.js';

// A rustic reading corner at the back of the Reading Grove: a vine-covered pergola with string lights,
// a picnic blanket, hay bales you can sit on, a crate table, a wheelbarrow of books and an apple tree.
const NOOK = { x: 0, z: -17.7 };

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}

export function buildNook(w) {
  const g = new THREE.Group();
  g.position.set(NOOK.x, 0, NOOK.z);
  w.scene.add(g);
  const glows = w.scenery.glows;
  const glowMat = (color, emissive = '#ffb347') => { const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.15 }); glows.push(m); return m; };
  const wood = toon('#8a5a3c'), darkWood = toon('#6b4a33'), hay = toon('#e9c46a'), band = toon('#b8913f');
  const solid = (x, z, hx, hz, h = 1, ry = 0) => w.staticBox(NOOK.x + x, h / 2, NOOK.z + z, hx, h / 2, hz, ry);

  // checkered picnic blanket
  const blanketTex = canvasTexture(512, 512, (c, s) => {
    const n = 8, cell = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      c.fillStyle = (i + j) % 2 ? '#fff4e2' : '#d9534f'; c.fillRect(i * cell, j * cell, cell, cell);
    }
  });
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), new THREE.MeshToonMaterial({ map: blanketTex }));
  blanket.rotation.set(-Math.PI / 2, 0, 0.06);
  blanket.position.set(0, 0.03, -0.3);
  blanket.receiveShadow = true;
  g.add(blanket);

  // pergola: four posts, beams, slats and climbing vines
  for (const [x, z] of [[-2.6, -2.2], [2.6, -2.2], [-2.6, 1.4], [2.6, 1.4]]) {
    cyl(0.1, 0.12, 2.8, wood, x, 1.4, z, g, 8);
    w.staticCylinder(NOOK.x + x, NOOK.z + z, 0.14, 2.8);
  }
  for (const z of [-2.2, 1.4]) box(5.8, 0.16, 0.18, darkWood, 0, 2.85, z, g);
  for (let x = -2.4; x <= 2.41; x += 0.6) box(0.1, 0.1, 4.2, wood, x, 3.0, -0.4, g);
  const vine = addWind(toon('#6fa35e'), 0.05);
  const vineDark = addWind(toon('#4f8a5b'), 0.05);
  for (let i = 0; i < 26; i++) {
    const onTop = i < 16;
    const x = onTop ? -2.6 + Math.random() * 5.2 : (i % 2 ? -2.6 : 2.6) + (Math.random() - 0.5) * 0.25;
    const y = onTop ? 3.05 + Math.random() * 0.15 : 0.6 + Math.random() * 2.2;
    const z = onTop ? -2.4 + Math.random() * 4 : (i % 4 < 2 ? -2.2 : 1.4) + (Math.random() - 0.5) * 0.25;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + Math.random() * 0.14, 0), i % 3 ? vine : vineDark);
    leaf.position.set(x, y, z); g.add(leaf);
  }
  for (let i = 0; i < 6; i++) {   // a few little flowers in the vines
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon(['#f2cc8f', '#e56b6f', '#fff8ee'][i % 3]));
    f.position.set(-2.4 + i * 0.95, 3.18, -1.8 + (i % 3) * 1.4); g.add(f);
  }

  // string lights draped along the front beam
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24, x = -2.6 + k * 5.2, y = 2.75 - Math.sin(k * Math.PI) * 0.45;
    pts.push(new THREE.Vector3(x, y, 1.4));
    if (i > 0 && i < 24 && i % 2 === 0) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glowMat(['#ffe3a0', '#ffd0a0', '#fff2c0'][(i / 2) % 3]));
      b.position.set(x, y - 0.08, 1.4); g.add(b);
    }
  }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#4a3a30' })));

  // hay bales to sit on, facing each other across the blanket (the middle stays clear as a walkway)
  [[-1.85, 0.75], [1.85, -0.75]].forEach(([x, face]) => {
    const b = new THREE.Group();
    box(1.2, 0.5, 0.75, hay, 0, 0.25, 0, b);
    for (const bx of [-0.3, 0.3]) box(0.05, 0.52, 0.77, band, bx, 0.25, 0, b);
    box(0.7, 0.08, 0.5, toon(face > 0 ? '#81b29a' : '#e07a5f'), 0, 0.54, 0, b).rotation.y = 0.1;
    b.position.set(x, 0, -0.3);
    b.rotation.y = face + Math.PI / 2;
    g.add(b);
    solid(x, -0.3, 0.6, 0.38, 0.55, face + Math.PI / 2);
    w.seats.push({ name: 'Hay bale in the reading corner', x: NOOK.x + x, z: NOOK.z - 0.3, y: 0.58, face });
  });

  // crate table with a lantern, tea and a book
  const crate = new THREE.Group();
  box(0.8, 0.55, 0.6, wood, 0, 0.28, 0, crate);
  for (const y of [0.12, 0.3, 0.48]) box(0.82, 0.04, 0.62, darkWood, 0, y, 0, crate);
  box(0.34, 0.06, 0.24, toon('#355070'), -0.15, 0.59, 0.05, crate).rotation.y = 0.4;
  cyl(0.06, 0.05, 0.1, toon('#fff4e2'), 0.2, 0.61, 0.12, crate, 14);
  cyl(0.09, 0.11, 0.04, darkWood, 0.15, 0.58, -0.15, crate);
  cyl(0.07, 0.07, 0.2, glowMat('#ffe3b0', '#c27a24'), 0.15, 0.7, -0.15, crate);
  cyl(0.1, 0.07, 0.04, darkWood, 0.15, 0.82, -0.15, crate);
  crate.position.set(-1.85, 0, 0.75);
  crate.rotation.y = 0.2;
  g.add(crate);
  solid(-1.85, 0.75, 0.42, 0.32, 0.6, 0.2);

  // lantern posts at the front corners
  for (const x of [-3.5, 3.5]) {
    cyl(0.06, 0.07, 1.9, darkWood, x, 0.95, 1.6, g, 8);
    box(0.4, 0.06, 0.06, darkWood, x + (x < 0 ? 0.18 : -0.18), 1.85, 1.6, g);
    const lx = x + (x < 0 ? 0.34 : -0.34);
    cyl(0.1, 0.1, 0.24, glowMat('#ffe3b0', '#c27a24'), lx, 1.66, 1.6, g, 10);
    cyl(0.13, 0.08, 0.06, darkWood, lx, 1.81, 1.6, g, 10);
    w.staticCylinder(NOOK.x + x, NOOK.z + 1.6, 0.1, 1.9);
  }
  const light = new THREE.PointLight('#ffb76b', 0, 9, 1.6);
  light.position.set(0, 2.2, -0.4);
  g.add(light);
  w.scenery.lights.push({ light, key: 'lantern' });

  // wheelbarrow full of books
  const bookColors = ['#e07a5f', '#81b29a', '#f2cc8f', '#6d597a', '#355070', '#b56576'];
  const barrow = new THREE.Group();
  box(1.0, 0.35, 0.65, toon('#b5484e'), 0, 0.55, 0, barrow).rotation.z = -0.08;
  cyl(0.2, 0.2, 0.08, darkWood, 0.62, 0.2, 0, barrow, 16).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    box(0.9, 0.05, 0.05, wood, -0.65, 0.55, s * 0.28, barrow).rotation.z = 0.25;
    box(0.05, 0.38, 0.05, wood, -0.35, 0.2, s * 0.25, barrow);
  }
  for (let i = 0; i < 7; i++) {
    const b = box(0.3, 0.42, 0.08, toon(bookColors[i % 6]), -0.3 + (i % 4) * 0.2, 0.86 + Math.floor(i / 4) * 0.12, -0.15 + Math.floor(i / 4) * 0.25, barrow);
    b.rotation.set((i % 3 - 1) * 0.15, (i % 2) * 0.4, (i % 4 - 1.5) * 0.2);
  }
  barrow.position.set(3.8, 0, -0.9);
  barrow.rotation.y = -0.5;
  g.add(barrow);
  solid(3.8, -0.9, 0.75, 0.45, 0.9, -0.5);

  // apple tree growing out of a barrel
  cyl(0.42, 0.36, 0.7, toon('#9a6440'), -3.9, 0.35, -1.4, g, 16);
  for (const y of [0.15, 0.55]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.025, 6, 20), toon('#5b4b49'));
    hoop.rotation.x = Math.PI / 2; hoop.position.set(-3.9, y, -1.4); g.add(hoop);
  }
  cyl(0.07, 0.1, 1.2, toon('#7b5238'), -3.9, 1.2, -1.4, g, 8);
  const leaf = addWind(toon('#6fa35e'), 0.06);
  [[0, 2.0, 0, 0.62], [-0.35, 1.75, 0.15, 0.44], [0.35, 1.8, -0.1, 0.46], [0.05, 2.4, 0.05, 0.4]].forEach(([dx, y, dz, r]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
    m.position.set(-3.9 + dx, y, -1.4 + dz); g.add(m);
  });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon('#d9534f'));
    apple.position.set(-3.9 + Math.cos(a) * 0.55, 1.85 + (i % 3) * 0.18, -1.4 + Math.sin(a) * 0.5); g.add(apple);
  }
  w.staticCylinder(NOOK.x - 3.9, NOOK.z - 1.4, 0.45, 2);

  // a basket of apples and a book pile on the blanket
  cyl(0.26, 0.2, 0.22, toon('#c99a4b'), 1.85, 0.14, 0.85, g, 14);
  for (let i = 0; i < 5; i++) {
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(i % 2 ? '#d9534f' : '#8bc34a'));
    apple.position.set(1.77 + (i % 3) * 0.08, 0.28, 0.78 + Math.floor(i / 3) * 0.12); g.add(apple);
  }
  for (let i = 0; i < 4; i++) box(0.55, 0.1, 0.4, toon(bookColors[(i + 2) % 6]), 2.05, 0.08 + i * 0.1, -1.55, g).rotation.y = (i % 3) * 0.25 - 0.2;

  g.traverse((o) => { if (o.isMesh && o !== blanket) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
