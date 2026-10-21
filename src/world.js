import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sound } from './audio.js';
import { Character, CHARACTERS } from './character.js';
import { toon, timeUniform } from './toon.js';
import { Scenery, zoneAt, inPond, pondDist, ZONES } from './scenery.js';

const SHELF = { W: 3.2, H: 2.3, D: 0.55, levels: [0.1, 1.17] };
const SHELF_COLS = [-7.5, -2.5, 2.5, 7.5];
const BOUND = 44;
const SPINE_COLORS = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#6d597a', '#b56576', '#355070', '#e56b6f', '#4d908e', '#c08552'];
const PROP_COLORS = ['#e07a5f', '#81b29a', '#f2cc8f', '#6d597a', '#4d908e', '#e56b6f'];

const PALETTE = {
  light: { shadow: '#2f4a2a', shadowO: 0.24, hemiSky: '#fff6e8', hemiGround: '#8fb26a', hemi: 1.2, sun: 2.3, sunColor: '#fff1d6',
    fire: 0.3, bloom: 0.12, lamp: 0, bulb: 0.6 },
  dark: { shadow: '#000000', shadowO: 0.35, hemiSky: '#6f84d0', hemiGround: '#14262a', hemi: 0.7, sun: 0.5, sunColor: '#9fb2ff',
    fire: 1, bloom: 0.85, lamp: 9, bulb: 4 },
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerpAngle = (a, b, t) => a + (((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * t;
function hash(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}
function seeded(seed) { return () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296; }


function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function spineTexture(book, color) {
  return canvasTex(128, 768, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (const y of [46, 58, h - 58, h - 46]) g.fillRect(14, y, w - 28, 5);
    g.save();
    g.translate(w / 2, h / 2); g.rotate(Math.PI / 2);
    g.fillStyle = '#fffaf0';
    let size = 56;
    const title = book.title.length > 60 ? book.title.slice(0, 57) + '…' : book.title;
    const font = (s) => `800 ${s}px Nunito, "Trebuchet MS", sans-serif`;
    g.font = font(size);
    while (g.measureText(title).width > h - 160 && size > 22) g.font = font((size -= 2));
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(title, 0, 2, h - 160);
    g.restore();
  });
}

function signTexture(lines) {
  return canvasTex(1024, 300, (g, w, h) => {
    g.fillStyle = '#fffaf0';
    g.beginPath(); g.roundRect(10, 10, w - 20, h - 20, 60); g.fill();
    g.fillStyle = '#e07a5f'; g.textAlign = 'center';
    g.font = '800 82px Nunito, "Trebuchet MS", sans-serif'; g.fillText(lines[0], w / 2, 135);
    g.font = '600 46px Nunito, "Trebuchet MS", sans-serif'; g.fillStyle = '#8a6a55'; g.fillText(lines[1], w / 2, 215);
  });
}

const FIRE_VERT = `
uniform float uTime; attribute float aSeed; varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.6 + aSeed * 10.) * 0.8;
  p.z += cos(uTime * 0.5 + aSeed * 7.) * 0.8;
  p.y += sin(uTime * 0.9 + aSeed * 4.) * 0.5;
  vA = 0.5 + 0.5 * sin(uTime * 2.5 + aSeed * 30.);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_PointSize = (40. + 30. * aSeed) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FIRE_FRAG = `uniform float uO; uniform vec3 uCol; varying float vA;
void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(uCol * 2.0, a * a * vA * uO); }`;

export class Library {
  constructor(container, { onOpen, onDelete }) {
    this.container = container;
    this.onOpen = onOpen;
    this.onDelete = onDelete;
    this.keys = new Set();
    this.tweens = [];
    this.books = new Map();
    this.shelves = [];
    this.props = [];
    this.trees = [];
    this.focused = null;
    this.paused = false;
    this.busy = false;
    this.facing = Math.PI;
    this.walkT = 0;
    this.zoom = 0.8;
    this.wade = 0;
    this.time = 0;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -28, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.35;
    this.world.defaultContactMaterial.restitution = 0.25;

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.7, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildEnvironment();
    this.buildPlaza();
    this.buildFireflies();
    this.buildProps();
    this.buildPlayer();
    this.scenery = new Scenery(this);
    for (let i = 0; i < 4; i++) this.ensureShelf(i);
    this.assignMaterials();
    this.char = new Character(this.player, (m) => toon('#ffffff', { map: m.map ?? null, color: m.map ? '#ffffff' : m.color }));
    let saved = null;
    try { saved = localStorage.getItem('character'); } catch {}
    this.setCharacter(CHARACTERS.includes(saved) ? saved : 'Mage');
    this.bindEvents();
    this.resize();
    this.setTheme(document.documentElement.dataset.theme === 'dark');
    this.camera.position.set(0, 14, 18);
    r.setAnimationLoop(() => this.frame());
  }

  // ---------- environment ----------
  buildEnvironment() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    s.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 2));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    s.add(sun, sun.target);

    this.shadowMat = new THREE.ShadowMaterial({ opacity: 0.2, transparent: true });
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.shadowMat);
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.002;
    catcher.receiveShadow = true;
    s.add(catcher);

    const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);
    for (const [x, z, hx, hz] of [[0, -BOUND, BOUND, 1], [0, BOUND, BOUND, 1], [-BOUND, 0, 1, BOUND], [BOUND, 0, 1, BOUND]]) {
      this.staticBox(x, 2, z, hx, 2, hz);
    }
  }

  /** Swap to a KayKit character; the hand-built one stays as a fallback if loading fails. */
  async setCharacter(name) {
    try {
      await this.char.load(name);
      this.body.visible = false;
      this.charName = name;
      try { localStorage.setItem('character', name); } catch {}
    } catch (e) {
      console.warn('character failed to load, using the built-in one', e);
      this.body.visible = true;
    }
  }

  nextCharacter() {
    const i = CHARACTERS.indexOf(this.charName);
    return this.setCharacter(CHARACTERS[(i + 1) % CHARACTERS.length]);
  }

  // cannon only consults ContactMaterials when both bodies have a material
  assignMaterials() {
    for (const b of this.world.bodies) b.material ||= this.world.defaultMaterial;
  }

  staticBox(x, y, z, hx, hy, hz, rotY = 0) {
    const b = new CANNON.Body({ type: CANNON.Body.STATIC, material: this.world.defaultMaterial, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
    b.position.set(x, y, z);
    b.quaternion.setFromEuler(0, rotY, 0);
    b.updateAABB();   // static bodies added after the sim starts keep a stale AABB otherwise
    this.world.addBody(b);
    return b;
  }

  staticCylinder(x, z, r, h) {
    const b = new CANNON.Body({ type: CANNON.Body.STATIC, material: this.world.defaultMaterial, shape: new CANNON.Cylinder(r, r, h, 10) });
    b.position.set(x, h / 2, z);
    b.updateAABB();
    this.world.addBody(b);
  }

  /** A pushable physics prop shaped like a lying cylinder (hay bales). */
  addDynamicCylinderProp(mesh, x, y, z, r, len, mass) {
    const body = new CANNON.Body({ mass, material: this.world.defaultMaterial, shape: new CANNON.Cylinder(r, r, len, 12) });
    body.quaternion.setFromEuler(0, 0, Math.PI / 2);
    body.position.set(x, y, z);
    const holder = new THREE.Group();
    mesh.rotation.z = -Math.PI / 2;
    holder.add(mesh);
    this.addProp(holder, body);
  }

  shadowed(obj) {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return obj;
  }

  buildPlaza() {
    const s = this.scene;
    const wood = toon('#c98a5a'), dark = toon('#7a4b33'), cream = toon('#fff4e2');

    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 32), wood);
    top.position.y = 0.8;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.8, 12), dark);
    leg.position.y = 0.4;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.18, 16), cream);
    cup.position.set(0.45, 0.95, 0.2);
    table.add(top, leg, cup);
    ['#e07a5f', '#81b29a', '#f2cc8f'].forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.45), toon(c));
      b.position.set(-0.3, 0.91 + i * 0.1, -0.1); b.rotation.y = i * 0.3;
      table.add(b);
    });
    table.position.set(0, 0, 2);
    s.add(this.shadowed(table));
    this.staticCylinder(0, 2, 1.1, 1);

    for (const [x, z, ry] of [[-3.6, 2, Math.PI / 2], [3.6, 2, -Math.PI / 2]]) {
      const b = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), wood);
      seat.position.y = 0.5;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), wood);
      back.position.set(0, 0.85, -0.28);
      b.add(seat, back);
      for (const lx of [-0.95, 0.95]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), dark);
        l.position.set(lx, 0.25, 0); b.add(l);
      }
      b.position.set(x, 0, z); b.rotation.y = ry;
      s.add(this.shadowed(b));
      this.staticBox(x, 0.5, z, 0.35, 0.5, 1.1);
    }

    this.lamps = [];
    for (const [x, z] of [[-4.6, -2.2], [4.6, -2.2], [-4.6, 6.2], [4.6, 6.2]]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.8, 10), toon('#3d405b'));
      pole.position.y = 1.4;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16),
        new THREE.MeshStandardMaterial({ color: '#ffe3a8', emissive: '#ffc46b', emissiveIntensity: 1 }));
      bulb.position.y = 2.95;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.25, 16), toon('#3d405b'));
      cap.position.y = 3.25;
      const light = new THREE.PointLight('#ffc27a', 0, 9, 1.6);
      light.position.y = 2.9;
      g.add(pole, bulb, cap, light);
      g.position.set(x, 0, z);
      s.add(this.shadowed(g));
      bulb.castShadow = false;
      this.staticCylinder(x, z, 0.15, 3);
      this.lamps.push({ bulb, light });
    }

    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.17),
      new THREE.MeshBasicMaterial({ map: signTexture(['Drop PDFs anywhere', 'or press I to add books']), transparent: true }));
    this.sign.position.set(0, 2.8, 2);
    s.add(this.sign);

    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), new THREE.MeshBasicMaterial({ color: '#e07a5f' }));
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    s.add(this.marker);
  }

  buildFireflies() {
    const rnd = seeded(42);
    const F = 220;
    const fp = new Float32Array(F * 3), fs = new Float32Array(F);
    for (let i = 0; i < F; i++) {
      fp[i * 3] = (rnd() - 0.5) * 70; fp[i * 3 + 1] = 0.6 + rnd() * 3; fp[i * 3 + 2] = (rnd() - 0.5) * 70;
      fs[i] = rnd();
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
    this.fireMat = new THREE.ShaderMaterial({
      vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: timeUniform, uO: { value: 1 }, uCol: { value: new THREE.Color('#ffe08a') } },
    });
    const pts = new THREE.Points(fg, this.fireMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  buildProps() {
    const rnd = seeded(7);
    for (let i = 0; i < 12; i++) {
      const size = [0.55 + rnd() * 0.2, 0.12 + rnd() * 0.08, 0.75 + rnd() * 0.15];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), toon(PROP_COLORS[i % PROP_COLORS.length]));
      const a = rnd() * Math.PI * 2, d = 6.3 + rnd() * 2.5;
      const body = new CANNON.Body({ mass: 0.6, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)) });
      body.position.set(Math.cos(a) * d, 0.3 + i * 0.05, Math.sin(a) * d + 2);
      body.quaternion.setFromEuler(0, rnd() * 3, 0);
      this.addProp(mesh, body);
    }
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.9), toon(PROP_COLORS[(i + 2) % PROP_COLORS.length]));
      const body = new CANNON.Body({ mass: 0.5, shape: new CANNON.Box(new CANNON.Vec3(0.35, 0.08, 0.45)) });
      body.position.set(-6.5, 0.08 + i * 0.165, 7);
      body.quaternion.setFromEuler(0, (rnd() - 0.5) * 0.4, 0);
      this.addProp(mesh, body);
    }
    for (const [x, z, c] of [[6, 7, '#e56b6f'], [7, 5.5, '#f2cc8f'], [-7, -1, '#4d908e']]) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), toon(c));
      const body = new CANNON.Body({ mass: 0.3, shape: new CANNON.Sphere(0.45), linearDamping: 0.3, angularDamping: 0.3 });
      body.position.set(x, 0.5, z);
      this.addProp(mesh, body);
    }
  }

  addProp(mesh, body) {
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.15;
    this.world.addBody(body);
    this.scene.add(this.shadowed(mesh));
    body.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 3 && performance.now() - (this.lastBump || 0) > 90) { this.lastBump = performance.now(); sound.sfx('bump'); }
    });
    this.props.push({ mesh, body });
  }

  buildPlayer() {
    const p = (this.player = new THREE.Group());
    this.body = new THREE.Group();
    const coat = toon('#e07a5f'), skin = toon('#ffd7b5'), dark = toon('#3d405b');
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.35, 6, 16), coat);
    torso.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), skin);
    head.position.y = 1.32;
    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: '#2b2d42' }));
      eye.position.set(ex, 1.36, 0.25); this.body.add(eye);
    }
    for (const ex of [-0.17, 0.17]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), toon('#f4978e'));
      b.scale.set(1, 0.6, 0.4); b.position.set(ex, 1.27, 0.23); this.body.add(b);
    }
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 20), toon('#f2cc8f'));
    hat.position.y = 1.72; hat.rotation.z = 0.12;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), toon('#fffaf0'));
    pom.position.set(-0.03, 1.98, 0);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 20), toon('#81b29a'));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.07;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.14), toon('#6d597a'));
    pack.position.set(0, 0.8, -0.3);
    this.legs = [];
    for (const lx of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), dark);
      leg.geometry.translate(0, -0.16, 0);
      leg.position.set(lx, 0.36, 0);
      this.legs.push(leg); this.body.add(leg);
    }
    this.body.add(torso, head, hat, pom, scarf, pack);
    p.add(this.shadowed(this.body));
    this.scene.add(p);

    this.pBody = new CANNON.Body({ mass: 5, shape: new CANNON.Sphere(0.42), fixedRotation: true, linearDamping: 0.05 });
    this.pBody.position.set(0, 0.5, 6);
    this.pBody.allowSleep = false;
    this.pBody.material = new CANNON.Material('player');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.pBody.material, this.world.defaultMaterial, { friction: 0, restitution: 0 }));
    this.world.addBody(this.pBody);
  }

  // ---------- shelves & books ----------
  ensureShelf(i) {
    while (this.shelves.length <= i) {
      const idx = this.shelves.length;
      this.shelves.push(this.makeShelf(SHELF_COLS[idx % 4], -6 - Math.floor(idx / 4) * 6));
    }
    return this.shelves[i];
  }

  makeShelf(x, z) {
    const { W, H, D, levels } = SHELF;
    const g = new THREE.Group();
    const m = toon('#b9774a'), trim = toon('#8a5235'), back = toon('#f2dcc2');
    const box = (w, h, d, px, py, pz, mat = m) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(px, py, pz); g.add(b);
    };
    box(0.12, H, D, -W / 2, H / 2, 0);
    box(0.12, H, D, W / 2, H / 2, 0);
    box(W + 0.3, 0.14, D + 0.12, 0, H + 0.07, 0, trim);
    box(W, H, 0.04, 0, H / 2, -D / 2 + 0.02, back);
    for (const y of levels) box(W, 0.06, D, 0, y, 0);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 12), toon('#e07a5f'));
    pot.position.set(W / 2 - 0.4, H + 0.27, 0);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), toon('#81b29a'));
    leaves.position.set(W / 2 - 0.4, H + 0.55, 0);
    g.add(pot, leaves);
    g.position.set(x, 0, z);
    this.scene.add(this.shadowed(g));
    this.staticBox(x, H / 2, z, W / 2 + 0.06, H / 2, D / 2);
    return g;
  }

  setBooks(list) {
    for (const { group } of this.books.values()) {
      group.removeFromParent();
      group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach((mt) => { mt.map?.dispose(); mt.dispose(); }); } });
    }
    this.books.clear();
    this.focused = null;
    list.sort((a, b) => a.added - b.added);

    let shelfIdx = 0, level = 1, cursor = -SHELF.W / 2 + 0.12;
    for (const book of list) {
      const group = this.makeBook(book);
      const { t, h, w } = group.userData;
      if (cursor + t > SHELF.W / 2 - 0.1) {
        cursor = -SHELF.W / 2 + 0.12;
        if (--level < 0) { level = 1; shelfIdx++; }
      }
      const shelf = this.ensureShelf(shelfIdx);
      group.position.set(cursor + t / 2, SHELF.levels[level] + 0.03 + h / 2, SHELF.D / 2 - w / 2 - 0.03);
      group.userData.homeZ = group.position.z;
      cursor += t + 0.01;
      shelf.add(group);
      this.books.set(book.id, { book, group });
    }
    this.sign.visible = list.length === 0;
  }

  makeBook(book) {
    const g = new THREE.Group();
    const t = THREE.MathUtils.clamp(0.12 + (book.pages || 100) / 1800, 0.14, 0.34);
    const h = 0.78 + hash(book.id, 1) * 0.18;
    const w = 0.46;
    const color = SPINE_COLORS[Math.floor(hash(book.id, 7) * SPINE_COLORS.length)];
    const coverM = toon(color);
    const paperM = toon('#fff6e6');
    const spineM = toon('#ffffff', { map: spineTexture(book, color) });

    const pages = new THREE.Mesh(new THREE.BoxGeometry(t * 0.88, h * 0.95, w * 0.96), paperM);
    pages.position.z = -w * 0.015;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w), coverM);
    back.position.x = -t / 2 + 0.01;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(t, h, 0.02), [coverM, coverM, coverM, coverM, spineM, coverM]);
    spine.position.z = w / 2 - 0.01;

    let frontM = coverM;
    if (book.cover) {
      const tex = new THREE.TextureLoader().load(book.cover);
      tex.colorSpace = THREE.SRGBColorSpace;
      frontM = new THREE.MeshBasicMaterial({ map: tex });
    }
    const pivot = new THREE.Group();
    pivot.position.set(t / 2 - 0.01, 0, w / 2);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w), [frontM, paperM, coverM, coverM, coverM, coverM]);
    front.position.z = -w / 2;
    pivot.add(front);

    g.add(pages, back, spine, pivot);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.bookId = book.id; } });
    g.userData = { bookId: book.id, t, h, w, pivot, spineM, pull: 0 };
    return g;
  }

  // ---------- open / close animations ----------
  tween(dur, fn) { return new Promise((res) => this.tweens.push({ dur, el: 0, fn, res })); }

  async playOpen(id) {
    const entry = this.books.get(id);
    if (!entry) return;
    this.busy = true;
    this.marker.visible = false;
    sound.sfx('whoosh');
    this.char?.interact();
    const g = entry.group;
    const { h, w, pivot } = g.userData;
    g.userData.homeParent = g.parent;
    g.userData.homePos = g.getWorldPosition(new THREE.Vector3());
    g.userData.homeQuat = g.getWorldQuaternion(new THREE.Quaternion());
    this.scene.attach(g);

    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    const out = new THREE.Vector3(0, 0.1, 0.6).applyQuaternion(q0).add(p0);
    await this.tween(0.35, (t) => g.position.lerpVectors(p0, out, ease(t)));

    const cam = this.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const target = cam.position.clone().addScaledVector(dir, h / 0.55).addScaledVector(right, w / 2);
    const qT = cam.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
    const spin = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
    await this.tween(0.85, (t) => {
      const e = ease(t);
      g.position.lerpVectors(out, target, e);
      g.position.y += Math.sin(e * Math.PI) * 1.2;
      g.quaternion.slerpQuaternions(q0, qT, e);
      g.quaternion.multiply(spin.setFromAxisAngle(zAxis, Math.sin(e * Math.PI) * 0.4));
    });
    sound.sfx('flip');
    await this.tween(0.7, (t) => { pivot.rotation.y = -Math.PI * 0.98 * ease(t); });
    await this.tween(0.12, () => {});
  }

  async playClose(id) {
    const entry = this.books.get(id);
    if (!entry || !entry.group.userData.homeParent) { this.busy = false; return; }
    const g = entry.group;
    const { pivot, homeParent, homePos, homeQuat } = g.userData;
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    sound.sfx('flip');
    await this.tween(0.45, (t) => { pivot.rotation.y = -Math.PI * 0.98 * (1 - ease(t)); });
    sound.sfx('whoosh');
    await this.tween(0.75, (t) => {
      const e = ease(t);
      g.position.lerpVectors(p0, homePos, e);
      g.position.y += Math.sin(e * Math.PI) * 1.0;
      g.quaternion.slerpQuaternions(q0, homeQuat, e);
    });
    homeParent.attach(g);
    g.position.z = g.userData.homeZ;
    g.userData.homeParent = null;
    this.busy = false;
  }

  // ---------- input ----------
  bindEvents() {
    addEventListener('resize', () => this.resize());
    const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
    addEventListener('keydown', (e) => {
      if (this.paused || e.target.matches?.('input, textarea')) return;
      const k = norm(e.key);
      if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
      this.keys.add(k);
      if (k === ' ' && !e.repeat && !this.busy && Math.abs(this.pBody.velocity.y) < 0.4) {
        this.pBody.velocity.y = 10; sound.sfx('jump');
      }
      if ((k === 'Enter' || k === 'e') && this.focused && !this.busy) this.onOpen(this.focused);
      if (k === 'Delete' && this.focused && !this.busy) this.onDelete(this.focused);
    });
    addEventListener('keyup', (e) => this.keys.delete(norm(e.key)));
    addEventListener('blur', () => this.keys.clear());

    const el = this.renderer.domElement;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.92), 0.55, 1.6);
    }, { passive: false });
    el.addEventListener('click', (e) => {
      if (this.busy || this.paused) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const meshes = [];
      for (const { group } of this.books.values()) group.traverse((o) => o.isMesh && meshes.push(o));
      const hit = this.raycaster.intersectObjects(meshes, false)[0];
      if (hit) this.onOpen(hit.object.userData.bookId);
    });
  }

  resize() {
    const w = this.container.clientWidth || innerWidth, h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setTheme(dark) {
    const P = PALETTE[dark ? 'dark' : 'light'];
    this.dark = dark;
    const fog = this.scenery.setTheme(dark);
    this.scene.background = new THREE.Color(fog);
    this.scene.fog = new THREE.Fog(fog, 34, 72);
    this.shadowMat.color.set(P.shadow);
    this.shadowMat.opacity = P.shadowO;
    this.hemi.color.set(P.hemiSky);
    this.hemi.groundColor.set(P.hemiGround);
    this.hemi.intensity = P.hemi;
    this.sun.color.set(P.sunColor);
    this.sun.intensity = P.sun;
    this.fireMat.uniforms.uO.value = P.fire;
    this.fireMat.uniforms.uCol.value.set(dark ? '#ffe08a' : '#ffffff');
    this.bloom.strength = P.bloom;
    for (const { bulb, light } of this.lamps) {
      light.intensity = P.lamp;
      bulb.material.emissiveIntensity = P.bulb;
    }
  }

  pause() { this.paused = true; this.keys.clear(); }
  resume() { this.paused = false; this.clock.getDelta(); }

  // ---------- per frame ----------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    for (const tw of [...this.tweens]) {
      tw.el += dt;
      const t = Math.min(tw.el / tw.dur, 1);
      tw.fn(t);
      if (t >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.res(); }
    }
    if (this.paused && !this.tweens.length) return;
    this.time += dt;

    if (!this.busy) this.controls(dt);
    else { this.moving = false; this.pBody.velocity.x *= 0.8; this.pBody.velocity.z *= 0.8; }
    this.world.step(1 / 60, dt, 3);
    for (const { mesh, body } of this.props) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
    this.animatePlayer(dt);
    this.updateFocus(dt);
    if (!this.busy) this.updateCamera(dt);

    const pp = this.player.position;
    timeUniform.value = this.time;
    this.scenery.update(dt, this.time, pp, this.wade);
    const zone = zoneAt(pp.x, pp.z);
    if (zone !== this.zone) { this.zone = zone; this.onZone?.(zone); }
    this.ambT = (this.ambT || 0) + dt;
    if (this.ambT > 0.4) {
      this.ambT = 0;
      const fire = Math.max(0, 1 - Math.hypot(pp.x - ZONES.campfire.x, pp.z - ZONES.campfire.z) / 9);
      const water = Math.max(0, 1 - Math.max(0, pondDist(pp.x, pp.z)) * 1.5);
      sound.setAmbience({ dark: this.dark, fire, water });
    }
    this.sign.position.y = 2.8 + Math.sin(this.time * 1.5) * 0.08;
    this.sign.quaternion.copy(this.camera.quaternion);
    this.sun.position.set(pp.x + 8, 16, pp.z + 6);
    this.sun.target.position.set(pp.x, 0, pp.z);

    this.composer.render();
  }

  controls(dt) {
    const k = this.keys;
    let x = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
    let z = (k.has('ArrowDown') || k.has('s') ? 1 : 0) - (k.has('ArrowUp') || k.has('w') ? 1 : 0);
    const len = Math.hypot(x, z) || 1;
    x /= len; z /= len;
    const speed = (k.has('Shift') ? 8.5 : 5) * (1 - 0.45 * this.wade);
    const v = this.pBody.velocity;
    const a = Math.min(1, dt * 12);
    v.x += (x * speed - v.x) * a;
    v.z += (z * speed - v.z) * a;
    this.moving = x !== 0 || z !== 0;
    if (this.moving) this.facing = lerpAngle(this.facing, Math.atan2(x, z), Math.min(1, dt * 12));
  }

  animatePlayer(dt) {
    const b = this.pBody.position;
    const wet = inPond(b.x, b.z) && b.y < 0.6 ? 1 : 0;
    if (wet && this.wade < 0.5 && wet !== this.wasWet) sound.sfx('splash');
    this.wasWet = wet;
    this.wade = THREE.MathUtils.lerp(this.wade, wet, 1 - Math.exp(-8 * dt));
    this.player.position.set(b.x, b.y - 0.42 - this.wade * 0.55, b.z);
    this.player.rotation.y = this.facing;
    const run = this.keys.has('Shift');
    // only count as airborne after a few frames off the ground, so bumping props doesn't trigger a jump pose
    const rawAir = this.pBody.position.y > 0.6 || Math.abs(this.pBody.velocity.y) > 2;
    this.airT = rawAir ? (this.airT || 0) + dt : 0;
    const air = this.airT > 0.08;
    if (this.moving && !air) {
      const prev = this.walkT;
      this.walkT += dt * (run ? 17 : 12);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.walkT / Math.PI)) sound.sfx('step');
    }
    const landed = this.wasAir && !air;
    this.wasAir = air;
    if (this.char?.model) {
      this.char.update(dt, { moving: this.moving, running: run, air, landed });
      return;
    }
    const swing = this.moving && !air ? Math.sin(this.walkT) * 0.7 : 0;
    this.legs[0].rotation.x = THREE.MathUtils.lerp(this.legs[0].rotation.x, swing, 0.3);
    this.legs[1].rotation.x = THREE.MathUtils.lerp(this.legs[1].rotation.x, -swing, 0.3);
    this.body.position.y = this.moving && !air ? Math.abs(Math.sin(this.walkT)) * 0.07 : THREE.MathUtils.lerp(this.body.position.y, 0, 0.2);
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, this.moving ? (run ? 0.18 : 0.09) : 0, 0.15);
    const stretch = air ? 1 + Math.min(0.15, Math.abs(this.pBody.velocity.y) * 0.015) : 1 + Math.sin(this.time * 2.2) * 0.012;
    this.body.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  }

  updateCamera(dt) {
    const p = this.player.position;
    const want = new THREE.Vector3(p.x, 0, p.z).add(new THREE.Vector3(0, 13, 12).multiplyScalar(this.zoom));
    this.camera.position.lerp(want, 1 - Math.exp(-4 * dt));
    this.lookAt ??= p.clone();
    this.lookAt.lerp(new THREE.Vector3(p.x, 0.6, p.z - 0.5), 1 - Math.exp(-6 * dt));
    this.camera.lookAt(this.lookAt);
  }

  updateFocus(dt) {
    let best = null, bestD = 1.9;
    if (!this.busy) {
      const p = this.player.position;
      const wp = new THREE.Vector3();
      for (const [id, { group }] of this.books) {
        group.getWorldPosition(wp);
        const dz = p.z - wp.z;               // player must stand in front of the shelf
        if (dz < 0) continue;
        const d = Math.hypot(wp.x - p.x, dz * 0.6);
        if (d < bestD) { best = id; bestD = d; }
      }
    }
    if (best !== this.focused) {
      this.focused = best;
      if (best) sound.sfx('click');
      this.onFocus?.(best ? this.books.get(best).book : null);
    }
    for (const [id, { group }] of this.books) {
      if (group.userData.homeParent) continue;
      const target = id === this.focused ? 0.22 : 0;
      group.userData.pull = THREE.MathUtils.lerp(group.userData.pull, target, 1 - Math.exp(-10 * dt));
      group.position.z = group.userData.homeZ + group.userData.pull;
      group.userData.spineM.emissive.setScalar(group.userData.pull);
    }
    if (this.focused && !this.busy) {
      const g = this.books.get(this.focused).group;
      g.getWorldPosition(this.marker.position);
      this.marker.position.y += g.userData.h / 2 + 0.35 + Math.sin(this.time * 4) * 0.06;
      this.marker.position.z += 0.1;
      this.marker.rotation.y += dt * 2;
      this.marker.visible = true;
    } else this.marker.visible = false;
  }
}
