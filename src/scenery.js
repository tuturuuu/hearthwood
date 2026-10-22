import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon, addWind, canvasTexture, seeded, timeUniform } from './toon.js';
import { palette, resolvePalette } from './environment.js';

/*  Hearthwood — a cozy forest clearing.
 *
 *            Windmill
 *   Reading Grove (shelves)     Farm
 *   Pond  ——  Plaza  ——————  gate → Barn
 *        Cottage        Campfire
 *              ~ forest all around ~
 */
export const ZONES = {
  plaza: { x: 0, z: 2, r: 5.6 },
  library: { x0: -11, x1: 11, z0: -21, z1: -3 },
  gallery: { x0: -10, x1: 10, z: -22.8 },
  portfolio: { x: 0, z: -36.5, r: 11.5 },
  // experience areas around the garden (see experience.js)
  frontend: { x: -18.5, z: -18, r: 5.4 },
  ai: { x: -20, z: -34, r: 5.6 },
  data: { x: 20, z: -34, r: 5.6 },
  origin: { x: 17, z: -20.6, r: 4.4 },
  pond: { x: -21, z: -2, rx: 6.5, rz: 5 },
  farm: { x0: 14, x1: 28, z0: -12, z1: 6 },
  barn: { x: 21.5, z: 12.5, w: 6, d: 4.6 },
  windmill: { x: 25, z: -17 },
  cottage: { x: -13, z: 15, w: 6, d: 4.6 },
  campfire: { x: 9, z: 12 },
};
export const PATHS = [[0, -20, 0, -25], [0, -36.5, -20, -34], [-20, -34, -18.5, -18], [-18.5, -18, -11, -14], [0, -36.5, 20, -34], [20, -34, 17, -20.6], [17, -20.6, 11, -16], [0, 2, 13.5, -2], [0, 2, -14.5, -2], [0, 2, -6, 11], [-6, 11, -13, 18.8], [0, 2, 9, 10], [13.5, -2, 16, 10.5], [16, 10.5, 18.4, 12.5]];
const PATH_W = 1.05;
export const STATIONS = ['frontend', 'ai', 'data', 'origin'];
const WORLD_R = 56;

export const ZONE_NAMES = {
  plaza: 'The Plaza', library: 'Reading Grove', portfolio: 'Việt’s Garden',
  frontend: 'UI Plaza', ai: 'Agent Lab', data: 'Data Observatory', origin: 'Origins', pond: 'Willow Pond', farm: 'Sunny Farm',
  barn: 'Sunny Farm', windmill: 'Sunny Farm', cottage: 'Hearth Cottage', campfire: 'Campfire', meadow: 'Meadow', forest: 'Whispering Woods',
};

// curated palette applied to Kenney's material names
const NATURE_PAL = {
  grass: '#8fbf62', dirt: '#c99560', dirtDark: '#a77149', stone: '#cfc8b8', stoneDark: '#a39d90', _defaultMat: '#f4ecdc',
  leafsDark: '#4f8a5b', leafsGreen: '#7fb069', leafsFall: '#eaa25b', woodBark: '#7b5238', woodBarkDark: '#5f4030', wood: '#c48a5a',
  woodDark: '#94603f', woodBirch: '#efe6d6', woodInner: '#e8cfa6', water: '#8fd3e8', colorRed: '#e56b6f', colorRedDark: '#b5484e',
  colorTan: '#e8b98a', colorYellow: '#f4c95d', colorWhite: '#fff8ee', colorPurple: '#b39ddb', corn: '#f2cc6b',
};
const WINDY = { leafsGreen: 0.035, leafsDark: 0.03, leafsFall: 0.035, grass: 0.06, corn: 0.05 };

const PALETTES = {
  day: palette({ grass: '#9cc56f', grass2: '#86b55f', path: '#ead2a4', soil: '#a8754b', sand: '#e6d3a3', fog: '#b9d89c',
    deep: '#3f9db5', shallow: '#86d3d6', foam: '#f4fbf6', blade: '#5f8f44', bladeTip: '#c7dd7c', smoke: '#f4f1ea',
    window: 0.15, lantern: 0, fire: 3 }),
  night: palette({ grass: '#22413c', grass2: '#1c3733', path: '#3c4366', soil: '#2c2733', sand: '#39405e', fog: '#0e1a22',
    deep: '#0f2a4a', shallow: '#1f4f6e', foam: '#7fa6c9', blade: '#183530', bladeTip: '#3e7a62', smoke: '#59607a',
    window: 2.6, lantern: 7, fire: 9 }),
  dusk: palette({ grass: '#a9b466', grass2: '#94a65b', path: '#efc796', sand: '#efc79a', fog: '#e7b48e', deep: '#5d7fa6',
    shallow: '#d9b090', foam: '#fff0dc', bladeTip: '#e4c776', smoke: '#f6dcc8', window: 1.4, lantern: 4 }),
  rain: palette({ grass: '#7da35f', grass2: '#6b9455', path: '#c9b693', sand: '#c9bb98', fog: '#9fb1a9', deep: '#3a7c91',
    shallow: '#6ea6aa', bladeTip: '#a6be6c', window: 0.8 }),
  snow: palette({ grass: '#e8edf0', grass2: '#dce4e8', path: '#d9d0c4', soil: '#cfd4d8', sand: '#e3e3df', fog: '#dfe7ea',
    blade: '#9fb5a8', bladeTip: '#f2f6f7', shallow: '#a9d4e0' }),
};

// ---------- zone geometry (shared by JS placement and the ground shader) ----------
const sdSeg = (px, pz, ax, az, bx, bz) => {
  const pax = px - ax, paz = pz - az, bax = bx - ax, baz = bz - az;
  const h = Math.min(1, Math.max(0, (pax * bax + paz * baz) / (bax * bax + baz * baz)));
  return Math.hypot(pax - bax * h, paz - baz * h);
};
const inRect = (x, z, r, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
const inBox = (x, z, b, m = 0) => Math.abs(x - b.x) < b.w / 2 + m && Math.abs(z - b.z) < b.d / 2 + m;
export const pondDist = (x, z) => Math.hypot((x - ZONES.pond.x) / ZONES.pond.rx, (z - ZONES.pond.z) / ZONES.pond.rz) - 1;
export const inPond = (x, z) => pondDist(x, z) < -0.08 && !(z > -2.9 && z < -1.1 && x > -18.9);   // the dock is dry
const pathDist = (x, z) => {
  let d = Math.hypot(x - ZONES.plaza.x, z - ZONES.plaza.z) - ZONES.plaza.r;
  for (const [a, b, c, e] of PATHS) d = Math.min(d, sdSeg(x, z, a, b, c, e) - PATH_W);
  for (const k of STATIONS) d = Math.min(d, Math.hypot(x - ZONES[k].x, z - ZONES[k].z) - ZONES[k].r);
  return Math.min(d, Math.hypot(x - ZONES.portfolio.x, z - ZONES.portfolio.z) - ZONES.portfolio.r);
};

export function zoneAt(x, z) {
  if (Math.hypot(x - ZONES.plaza.x, z - ZONES.plaza.z) < ZONES.plaza.r + 0.5) return 'plaza';
  if (Math.hypot(x - ZONES.portfolio.x, z - ZONES.portfolio.z) < ZONES.portfolio.r + 1) return 'portfolio';
  for (const k of STATIONS) if (Math.hypot(x - ZONES[k].x, z - ZONES[k].z) < ZONES[k].r + 0.8) return k;
  if (inRect(x, z, ZONES.library, 1)) return 'library';
  if (pondDist(x, z) < 0.35) return 'pond';
  if (inRect(x, z, ZONES.farm, 1) || inBox(x, z, ZONES.barn, 3) || Math.hypot(x - ZONES.windmill.x, z - ZONES.windmill.z) < 5) return 'farm';
  if (inBox(x, z, ZONES.cottage, 4)) return 'cottage';
  if (Math.hypot(x - ZONES.campfire.x, z - ZONES.campfire.z) < 5.5) return 'campfire';
  if (Math.hypot(x, z) > 27) return 'forest';
  return 'meadow';
}

/** True where nothing should be planted. */
function occupied(x, z, m = 0) {
  return pathDist(x, z) < m || inRect(x, z, ZONES.library, m + 0.5) || pondDist(x, z) < 0.15 + m / 5 || inRect(x, z, ZONES.farm, m + 1.2) ||
    inBox(x, z, ZONES.barn, m + 2.5) || inBox(x, z, ZONES.cottage, m + 2.5) || Math.hypot(x - ZONES.campfire.x, z - ZONES.campfire.z) < 4.5 + m ||
    Math.hypot(x - ZONES.windmill.x, z - ZONES.windmill.z) < 3.5 + m || (Math.abs(z - ZONES.gallery.z) < 1.5 + m && Math.abs(x) < 11) || Math.hypot(x, z) > WORLD_R;
}

const f = (n) => n.toFixed(2);
const GROUND_FRAG = `
uniform vec3 uGrass, uGrass2, uPath, uSoil, uSand, uFog; uniform float uTime; varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
void main(){
  vec2 p = vW.xz;
  float n = noise(p * 0.12) * 0.6 + noise(p * 0.5) * 0.4;
  vec3 c = mix(uGrass, uGrass2, smoothstep(0.35, 0.75, n));
  // paths (slightly wobbly edges)
  float wob = (noise(p * 1.3) - 0.5) * 0.35;
  float d = length(p - vec2(${f(ZONES.plaza.x)}, ${f(ZONES.plaza.z)})) - ${f(ZONES.plaza.r)};
  ${PATHS.map(([a, b, cc, e]) => `d = min(d, sdSeg(p, vec2(${f(a)}, ${f(b)}), vec2(${f(cc)}, ${f(e)})) - ${f(PATH_W)});`).join('\n  ')}
  float lib = sdBox(p - vec2(${f((ZONES.library.x0 + ZONES.library.x1) / 2)}, ${f((ZONES.library.z0 + ZONES.library.z1) / 2)}), vec2(${f((ZONES.library.x1 - ZONES.library.x0) / 2)}, ${f((ZONES.library.z1 - ZONES.library.z0) / 2)}));
  d = min(d, lib);
  d = min(d, length(p - vec2(${f(ZONES.portfolio.x)}, ${f(ZONES.portfolio.z)})) - ${f(ZONES.portfolio.r)});
  ${STATIONS.map((k) => `d = min(d, length(p - vec2(${f(ZONES[k].x)}, ${f(ZONES[k].z)})) - ${f(ZONES[k].r)});`).join('\n  ')}
  float pathMask = 1. - smoothstep(-0.05, 0.12, d + wob);
  // stepping-stone texture on paths
  vec2 cell = fract(p * 0.9) - 0.5;
  vec3 pc = uPath * (1. - 0.07 * smoothstep(0.38, 0.5, max(abs(cell.x), abs(cell.y))));
  c = mix(c, pc, pathMask);
  // farm: tilled soil rows
  float farm = sdBox(p - vec2(${f((ZONES.farm.x0 + ZONES.farm.x1) / 2)}, ${f((ZONES.farm.z0 + ZONES.farm.z1) / 2)}), vec2(${f((ZONES.farm.x1 - ZONES.farm.x0) / 2 - 0.6)}, ${f((ZONES.farm.z1 - ZONES.farm.z0) / 2 - 0.6)}));
  float rows = smoothstep(0.25, 0.32, abs(fract((p.x - ${f(ZONES.farm.x0 + 1.6)}) / 1.6 + 0.5) - 0.5));
  c = mix(c, mix(uSoil, uSoil * 1.18, rows), (1. - smoothstep(-0.1, 0.1, farm)));
  // sandy pond bank
  float e = length((p - vec2(${f(ZONES.pond.x)}, ${f(ZONES.pond.z)})) / vec2(${f(ZONES.pond.rx)}, ${f(ZONES.pond.rz)})) - 1.;
  c = mix(c, uSand, 1. - smoothstep(0.05, 0.22, e + wob * 0.2));
  // drifting cloud shadows
  float cl = noise(p * 0.045 + vec2(uTime * 0.025, uTime * 0.012)) * 0.7 + noise(p * 0.1 - uTime * 0.02) * 0.3;
  c *= 1. - 0.13 * smoothstep(0.5, 0.72, cl);
  c += (hash(floor(p * 28.)) - 0.5) * 0.018;
  c = mix(c, uFog, smoothstep(0.7, 1.0, length(p) / 82.));
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;
const GROUND_VERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const WATER_VERT = `varying vec2 vL; varying vec3 vW;
void main(){ vL = position.xy; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FRAG = `
uniform float uTime, uWade, uRain; uniform vec3 uDeep, uShallow, uFoam, uPlayer; varying vec2 vL; varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  float r = length(vL);
  vec3 c = mix(uDeep, uShallow, smoothstep(0.25, 0.95, r));
  float w = noise(vW.xz * 0.9 + vec2(uTime * 0.18, uTime * 0.1)) + 0.5 * noise(vW.xz * 2.1 - uTime * 0.25);
  c += smoothstep(0.9, 1.0, sin(w * 10.)) * 0.09;
  float ang = atan(vL.y, vL.x);
  float foam = smoothstep(0.88, 0.97, r + sin(ang * 14. + uTime * 1.3) * 0.012 + sin(ang * 5. - uTime) * 0.01);
  c = mix(c, uFoam, foam * 0.85);
  float pd = length(vW.xz - uPlayer.xz);
  float ring = smoothstep(0.06, 0.0, abs(fract(pd * 1.2 - uTime * 1.4) - 0.5) - 0.42) * smoothstep(2.5, 0.3, pd) * uWade;
  c = mix(c, uFoam, ring * 0.6);
  // raindrop rings
  vec2 g = vW.xz * 1.6; vec2 id = floor(g); vec2 fc = fract(g) - 0.5;
  float hr = hash(id); float rt = fract(uTime * 0.9 + hr);
  float drop = smoothstep(0.06, 0.0, abs(length(fc - (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.4) - rt * 0.42)) * (1. - rt) * step(0.35, hr);
  c = mix(c, uFoam, drop * uRain * 0.7);
  gl_FragColor = vec4(c, 0.93);
  #include <colorspace_fragment>
}`;

const GRASS_VERT = `
uniform float uTime; uniform vec3 uPlayer; varying float vH; varying float vR;
void main(){
  vH = uv.y;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
  vR = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9, 78.2))) * 43758.5);
  float k = vH * vH;
  float wind = sin(uTime * 1.6 + w.x * 0.3 + w.z * 0.2) * 0.16 + sin(uTime * 3.2 + w.x * 1.1) * 0.05;
  w.x += wind * k; w.z += wind * 0.4 * k;
  vec2 away = w.xz - uPlayer.xz; float dist = length(away);
  float push = 1. - smoothstep(0.2, 1.2, dist);
  w.xz += normalize(away + 1e-4) * k * 0.55 * push;
  w.y -= k * 0.3 * push;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GRASS_FRAG = `uniform vec3 uBase; uniform vec3 uTip; varying float vH; varying float vR;
void main(){ vec3 tip = mix(uTip, uTip * vec3(1.08, 1.0, 0.82), step(0.8, vR)); gl_FragColor = vec4(mix(uBase, tip, vH), 1.);
  #include <colorspace_fragment>
}`;

const loader = new GLTFLoader();
const modelCache = new Map();
const loadModel = (path) => {
  if (!modelCache.has(path)) modelCache.set(path, loader.loadAsync(path).then((g) => { g.scene.updateMatrixWorld(true); return g.scene; }));
  return modelCache.get(path);
};
const N = (n) => `assets/nature/${n}.glb`;
const S = (n) => `assets/survival/${n}.glb`;

const matCache = new Map();
function materialFor(src) {
  const key = src.map ? `map:${src.map.uuid}` : src.name;
  if (!matCache.has(key)) {
    let m;
    if (src.map) m = toon('#ffffff', { map: src.map });
    else m = toon(NATURE_PAL[src.name] ?? src.color);
    if (WINDY[src.name]) addWind(m, WINDY[src.name]);
    matCache.set(key, m);
  }
  return matCache.get(key);
}

/** Collects placements per model and builds one InstancedMesh per sub-mesh. */
// small plants you can walk through; everything else gets a collider fitted to its shape
const PASSABLE = /flower|grass|plant_flat|lily|mushroom|crop|campfire_logs|tree_|plant_bushSmall/;

/** Collects placements per model and builds one InstancedMesh per sub-mesh (+ physics colliders). */
class Batch {
  constructor(world) { this.w = world; this.items = new Map(); }
  add(path, x, z, { s = 3, ry = 0, y = 0, shadow = true } = {}) {
    if (!this.items.has(path)) this.items.set(path, { shadow, list: [], spots: [] });
    const item = this.items.get(path);
    item.list.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s)));
    item.spots.push({ x, y, z, s, ry });
  }
  addColliders(path, root, spots) {
    if (PASSABLE.test(path)) return;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    for (const { x, y, z, s, ry } of spots) {
      const sx = size.x * s, sy = Math.max(size.y * s, 0.3), sz = size.z * s;
      const cos = Math.cos(ry), sin = Math.sin(ry);
      const cx = x + (c.x * cos + c.z * sin) * s, cz = z + (-c.x * sin + c.z * cos) * s;
      if (Math.max(sx, sz) / Math.max(0.01, Math.min(sx, sz)) > 2) this.w.staticBox(cx, y + sy / 2, cz, sx / 2, sy / 2, sz / 2, ry);
      else this.w.staticCylinder(cx, cz, (Math.max(sx, sz) / 2) * 0.85, y + sy);
    }
  }
  async build(parent) {
    await Promise.all([...this.items].map(async ([path, { shadow, list, spots }]) => {
      let root;
      try { root = await loadModel(path); } catch (e) { console.warn('missing model', path); return; }
      this.addColliders(path, root, spots);
      root.traverse((m) => {
        if (!m.isMesh) return;
        const im = new THREE.InstancedMesh(m.geometry, materialFor(m.material), list.length);
        list.forEach((mx, i) => im.setMatrixAt(i, mx.clone().multiply(m.matrixWorld)));
        im.castShadow = shadow;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        parent.add(im);
      });
    }));
  }
}

async function single(path, s = 3) {
  const root = (await loadModel(path)).clone(true);
  root.traverse((o) => { if (o.isMesh) { o.material = materialFor(o.material); o.castShadow = o.receiveShadow = true; } });
  root.scale.setScalar(s);
  return root;
}

function softSprite() {
  return canvasTexture(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.6, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  });
}

function signBoard(text, w = 1.6, h = 0.42, color = '#c48a5a') {
  const tex = canvasTexture(512, Math.round((512 * h) / w), (g, cw, ch) => {
    g.fillStyle = color; g.beginPath(); g.roundRect(0, 0, cw, ch, 22); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#fff7e8'; g.font = `800 ${Math.round(ch * 0.52)}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, cw / 2, ch / 2 + 3);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [toon(color), toon(color), toon(color), toon(color), toon('#ffffff', { map: tex }), toon(color)]);
  m.castShadow = true;
  return m;
}

export class Scenery {
  constructor(w) {
    this.w = w;
    this.scene = w.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.anim = [];       // per-frame callbacks
    this.lights = [];     // { light, day, night }
    this.glows = [];      // window materials
    this.rnd = seeded(2024);
    this.buildGround();
    this.buildGrass();
    this.buildWater();
    this.buildCottage();
    this.buildBarn();
    this.buildWindmill();
    this.buildScarecrow();
    this.buildArch();
    this.buildSignpost();
    this.buildCampfire();
    this.buildButterflies();
    this.ready = this.buildModels();
  }

  // ---------- ground ----------
  buildGround() {
    this.groundMat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
      uniforms: Object.fromEntries(['uGrass', 'uGrass2', 'uPath', 'uSoil', 'uSand', 'uFog'].map((k) => [k, { value: new THREE.Color() }]).concat([['uTime', timeUniform]])),
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);
  }

  buildGrass() {
    const rnd = this.rnd;
    const blade = new THREE.PlaneGeometry(0.1, 0.6, 1, 3);
    blade.translate(0, 0.3, 0);
    const pos = blade.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (1 - pos.getY(i) / 0.65));
    this.grassMat = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG, side: THREE.DoubleSide,
      uniforms: { uTime: timeUniform, uPlayer: { value: new THREE.Vector3() }, uBase: { value: new THREE.Color() }, uTip: { value: new THREE.Color() } },
    });
    const N = 24000;
    const grass = new THREE.InstancedMesh(blade, this.grassMat, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0, guard = 0;
    while (n < N && guard++ < 50000) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 54;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      if (occupied(cx, cz, 0.6)) continue;
      const tuft = 14 + Math.floor(rnd() * 20);
      for (let k = 0; k < tuft && n < N; k++) {
        const x = cx + (rnd() - 0.5) * 1.8, z = cz + (rnd() - 0.5) * 1.8;
        if (occupied(x, z, 0.3)) continue;
        v.set(x, 0, z);
        e.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
        sc.set(1, 0.6 + rnd() * 0.9, 1);
        grass.setMatrixAt(n++, m4.compose(v, q.setFromEuler(e), sc));
      }
    }
    grass.count = n;
    grass.frustumCulled = false;
    this.group.add(grass);
  }

  // ---------- pond ----------
  buildWater() {
    const P = ZONES.pond;
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true,
      uniforms: { uTime: timeUniform, uWade: { value: 0 }, uRain: { value: 0 }, uPlayer: { value: new THREE.Vector3() },
        uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() } },
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64), this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.scale.set(P.rx, P.rz, 1);
    water.position.set(P.x, 0.06, P.z);
    water.receiveShadow = true;
    this.group.add(water);

    // wooden dock you can walk out onto
    const plank = toon('#b07d52'), post = toon('#7b5238');
    const dock = new THREE.Group();
    const x0 = P.x + P.rx + 0.6, x1 = -18.8;
    for (let x = x1; x < x0; x += 0.42) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 1.7), plank);
      b.position.set(x, 0.3, -2 + (Math.sin(x * 9) * 0.03));
      dock.add(b);
    }
    for (const x of [x1, (x0 + x1) / 2]) for (const z of [-2.85, -1.15]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), post);
      p.position.set(x, 0.15, z); dock.add(p);
    }
    dock.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    this.group.add(dock);
    this.w.staticBox((x0 + x1) / 2, 0.17, -2, (x0 - x1) / 2, 0.17, 0.85);
  }

  // ---------- buildings (hand-built to match the toon style) ----------
  gableHouse({ w, d, h, roofH, wall, roof, trim }) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(wall));
    walls.position.y = h / 2;
    g.add(walls);
    // gable triangles
    const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, roofH)]);
    const gable = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    gable.rotateY(Math.PI / 2); gable.translate(-w / 2, h, 0);
    g.add(new THREE.Mesh(gable, toon(wall)));
    // roof slabs
    const slope = Math.atan2(roofH, d / 2), len = Math.hypot(roofH, d / 2) + 0.35;
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.16, len), toon(roof));
      slab.rotation.x = s * slope;
      slab.position.set(0, h + roofH / 2 + 0.05, (s * d) / 4 + s * 0.05);
      g.add(slab);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.18, 0.3), toon(trim));
    ridge.position.y = h + roofH + 0.06;
    g.add(ridge);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    return g;
  }

  windowGlow() {
    const m = new THREE.MeshStandardMaterial({ color: '#ffe8b0', emissive: '#ffb347', emissiveIntensity: 0.15 });
    this.glows.push(m);
    return m;
  }

  buildCottage() {
    const C = ZONES.cottage;
    const g = this.gableHouse({ w: C.w, d: C.d, h: 2.7, roofH: 1.9, wall: '#f4e4c8', roof: '#c8694c', trim: '#8e4634' });
    const beam = toon('#6b4a33');
    const addBox = (sx, sy, sz, x, y, z, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
    // timber frame
    for (const x of [-C.w / 2, C.w / 2]) for (const z of [-C.d / 2, C.d / 2]) addBox(0.2, 2.7, 0.2, x, 1.35, z, beam);
    addBox(C.w + 0.05, 0.16, 0.08, 0, 1.4, C.d / 2 + 0.02, beam);
    // door, windows with flower boxes
    addBox(0.95, 1.7, 0.1, 0, 0.85, C.d / 2 + 0.05, toon('#8a5a3c'));
    addBox(0.08, 0.08, 0.06, 0.3, 0.85, C.d / 2 + 0.12, toon('#f4c95d'));
    for (const x of [-1.75, 1.75]) {
      addBox(0.95, 0.85, 0.08, x, 1.65, C.d / 2 + 0.03, this.windowGlow());
      addBox(1.1, 0.1, 0.12, x, 1.2, C.d / 2 + 0.08, beam);
      addBox(0.08, 0.85, 0.1, x, 1.65, C.d / 2 + 0.08, beam);
      addBox(1.05, 0.22, 0.3, x, 1.08, C.d / 2 + 0.2, toon('#9a6440'));
      const flowers = ['#e56b6f', '#f4c95d', '#b39ddb', '#fff8ee'];
      for (let i = 0; i < 5; i++) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toon(flowers[i % 4]));
        fl.position.set(x - 0.4 + i * 0.2, 1.27, C.d / 2 + 0.22); g.add(fl);
      }
    }
    // side window
    addBox(0.08, 0.8, 0.8, C.w / 2 + 0.03, 1.6, 0, this.windowGlow());
    // chimney
    addBox(0.6, 2.2, 0.6, 1.7, 3.6, -0.7, toon('#b9b2a6'));
    addBox(0.75, 0.15, 0.75, 1.7, 4.72, -0.7, toon('#8f897e'));
    // doorstep + lantern
    addBox(1.4, 0.12, 0.7, 0, 0.06, C.d / 2 + 0.4, toon('#cfc8b8'));
    const lantern = addBox(0.18, 0.26, 0.18, 0.75, 2.05, C.d / 2 + 0.18, new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#ffb347', emissiveIntensity: 1 }));
    this.glows.push(lantern.material);
    const light = new THREE.PointLight('#ffb76b', 0, 10, 1.6);
    light.position.set(0.75, 2.0, C.d / 2 + 0.8);
    g.add(light);
    this.lights.push({ light, key: 'lantern' });
    g.position.set(C.x, 0, C.z);
    this.group.add(g);
    this.w.staticBox(C.x, 1.5, C.z, C.w / 2 + 0.1, 1.5, C.d / 2 + 0.1);
    this.smoke(new THREE.Vector3(C.x + 1.7, 4.9, C.z - 0.7), 0.9);

    // mailbox + garden bench
    const mb = new THREE.Group();
    const postM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), beam); postM.position.y = 0.5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), toon('#e56b6f')); box.position.y = 1.1;
    mb.add(postM, box); mb.position.set(C.x + 2.6, 0, C.z + 4.3);
    this.w.staticCylinder(C.x + 2.6, C.z + 4.3, 0.3, 1.3);
    mb.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(mb);
  }

  buildBarn() {
    const B = ZONES.barn;
    const g = this.gableHouse({ w: B.d, d: B.w, h: 3, roofH: 2, wall: '#c8574d', roof: '#5b4b49', trim: '#3f3533' });
    g.rotation.y = Math.PI / 2;
    const white = toon('#fbf3e6');
    const add = (sx, sy, sz, x, y, z, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), white); b.position.set(x, y, z); b.rotation.z = rz; b.castShadow = true; g.add(b); };
    // big doors with the classic white X (on the local +z face, which faces west after rotation)
    const fz = B.w / 2 + 0.04;
    add(2.2, 2.2, 0.06, 0, 1.1, fz - 0.02);
    g.children.at(-1).material = toon('#a8443c');
    add(2.3, 0.14, 0.1, 0, 2.2, fz); add(2.3, 0.14, 0.1, 0, 0.05, fz);
    add(0.14, 2.2, 0.1, -1.1, 1.1, fz); add(0.14, 2.2, 0.1, 1.1, 1.1, fz);
    add(3.0, 0.12, 0.1, 0, 1.1, fz + 0.02, Math.atan2(2.1, 2.1)); add(3.0, 0.12, 0.1, 0, 1.1, fz + 0.02, -Math.atan2(2.1, 2.1));
    add(0.9, 0.7, 0.08, 0, 3.6, fz - 0.6);
    g.position.set(B.x, 0, B.z);
    g.rotation.y = -Math.PI / 2;
    this.group.add(g);
    this.w.staticBox(B.x, 1.5, B.z, B.w / 2 + 0.1, 1.5, B.d / 2 + 0.1);

    // pushable hay bales
    const hay = toon('#e9c46a'), band = toon('#b8913f');
    for (const [x, z, y] of [[B.x - 4.2, B.z + 2.6, 0.45], [B.x - 3.1, B.z + 3.4, 0.45], [B.x - 3.6, B.z + 3.0, 1.35]]) {
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16), hay);
      body.rotation.z = Math.PI / 2;
      mesh.add(body);
      for (const bx of [-0.3, 0.3]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.03, 6, 20), band);
        r.rotation.y = Math.PI / 2; r.position.x = bx; mesh.add(r);
      }
      this.w.addDynamicCylinderProp(mesh, x, y, z, 0.45, 1.1, 1.5);
    }
  }

  buildWindmill() {
    const W = ZONES.windmill;
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 5.5, 8), toon('#f2e6d0'));
    tower.position.y = 2.75;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.6, 8), toon('#c8694c'));
    cap.position.y = 6.3;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.2), toon('#8a5a3c'));
    door.position.set(0, 0.7, 1.42);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.2), this.windowGlow());
    win.position.set(0, 3.6, 1.15);
    g.add(tower, cap, door, win);
    const hub = new THREE.Group();
    hub.position.set(0, 5.3, 1.35);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 10), toon('#6b4a33'));
    axle.rotation.x = Math.PI / 2;
    hub.add(axle);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.6, 0.1), toon('#6b4a33'));
      spar.position.y = 1.8;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.8, 0.04), toon('#fbf3e6'));
      sail.position.set(0.42, 2.0, 0.05);
      arm.add(spar, sail);
      hub.add(arm);
    }
    g.add(hub);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    g.position.set(W.x, 0, W.z);
    g.rotation.y = -0.5;
    this.group.add(g);
    this.w.staticCylinder(W.x, W.z, 1.4, 5);
    this.anim.push((dt) => { hub.rotation.z -= dt * 0.5; });
  }

  buildScarecrow() {
    const g = new THREE.Group();
    const wood = toon('#7b5238');
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), wood); pole.position.y = 1.1;
    const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), wood); arms.rotation.z = Math.PI / 2; arms.position.y = 1.6;
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.35), toon('#5b8fb9')); shirt.position.y = 1.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toon('#e8c88f')); head.position.y = 2.1;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.45, 12), toon('#c99a4b')); hat.position.y = 2.42;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), toon('#c99a4b')); brim.position.y = 2.25;
    g.add(pole, arms, shirt, head, hat, brim);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(21, 0, -3);
    g.rotation.y = -0.3;
    this.group.add(g);
    this.w.staticCylinder(21, -3, 0.25, 2);
    this.anim.push((dt, t) => { g.rotation.z = Math.sin(t * 1.3) * 0.025; });
  }

  buildArch() {
    // entrance arch to the reading grove
    const g = new THREE.Group();
    const wood = toon('#8a5a3c');
    for (const x of [-2.2, 2.2]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3), wood);
      p.position.set(x, 1.6, 0); g.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 0.4), wood);
    beam.position.y = 3.3; g.add(beam);
    const sign = signBoard('Reading Grove', 2.8, 0.6, '#e07a5f');
    sign.position.set(0, 2.75, 0.12); g.add(sign);
    // vines
    const leaf = addWind(toon('#6fa35e'), 0.05);
    for (let i = 0; i < 14; i++) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.1, 0), leaf);
      const side = i % 2 ? -2.2 : 2.2;
      l.position.set(i < 8 ? side + (Math.random() - 0.5) * 0.3 : (Math.random() - 0.5) * 4.6, i < 8 ? 1 + Math.random() * 2.3 : 3.45, 0.18);
      g.add(l);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(0, 0, -2.6);
    this.group.add(g);
    this.w.staticBox(-2.2, 1.5, -2.6, 0.2, 1.5, 0.2);
    this.w.staticBox(2.2, 1.5, -2.6, 0.2, 1.5, 0.2);
  }

  buildSignpost() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), toon('#7b5238'));
    post.position.y = 1.3; g.add(post);
    const boards = [['Reading Grove', -Math.PI / 2 - 0.25, 2.25, '#e07a5f'], ['Sunny Farm', 0.15, 1.85, '#81b29a'],
      ['Willow Pond', Math.PI - 0.1, 1.45, '#5b8fb9'], ['Cottage', Math.PI / 2 + 0.6, 1.05, '#c48a5a']];
    for (const [text, ang, y, col] of boards) {
      const b = signBoard(text, 1.5, 0.34, col);
      const arm = new THREE.Group();
      arm.rotation.y = -ang;
      b.position.set(0.8, y, 0);
      arm.add(b);
      g.add(arm);
    }
    g.position.set(3.4, 0, -1.2);
    this.group.add(g);
    this.w.staticCylinder(3.4, -1.2, 0.15, 2.6);
  }

  buildCampfire() {
    const C = ZONES.campfire;
    const fire = new THREE.Group();
    const flames = [['#ffb347', 0.38, 1.0], ['#ff7b3a', 0.28, 0.8], ['#ffe08a', 0.16, 0.55]].map(([c, r, h]) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.y = h / 2 + 0.15;
      fire.add(m);
      return m;
    });
    fire.position.set(C.x, 0, C.z);
    this.group.add(fire);
    const light = new THREE.PointLight('#ff9a4a', 3, 12, 1.5);
    light.position.set(C.x, 1.2, C.z);
    this.group.add(light);
    this.lights.push({ light, key: 'fire' });
    this.w.staticCylinder(C.x, C.z, 0.9, 0.6);
    this.anim.push((dt, t) => {
      flames.forEach((m, i) => {
        m.scale.y = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 17 + i * 2) * 0.06;
        m.rotation.y += dt * (1 + i);
      });
      light.intensity = (light.userData.base ?? 3) * (1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.08);
    });
    this.smoke(new THREE.Vector3(C.x, 1.3, C.z), 1.2);
  }

  // ---------- particles ----------
  smoke(origin, rate) {
    this.smokeTex ??= softSprite();
    const puffs = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: '#f4f1ea', transparent: true, opacity: 0, depthWrite: false }));
      s.userData.age = i / 14 * 4;
      this.group.add(s);
      puffs.push(s);
    }
    this.smokeMats = (this.smokeMats || []).concat(puffs.map((p) => p.material));
    this.anim.push((dt) => {
      for (const p of puffs) {
        p.userData.age += dt * rate * 0.6;
        if (p.userData.age > 4) p.userData.age = 0;
        const a = p.userData.age;
        p.position.set(origin.x + Math.sin(a * 1.7 + origin.x) * 0.25 + a * 0.35, origin.y + a * 1.1, origin.z + Math.cos(a * 1.3) * 0.2);
        p.scale.setScalar(0.4 + a * 0.45);
        p.material.opacity = Math.min(1, a * 2) * (1 - a / 4) * 0.45;
      }
    });
  }

  buildButterflies() {
    const colors = ['#f4c95d', '#ffffff', '#e8a0bf', '#9ad1d4', '#f29e4c'];
    const wingTex = canvasTexture(64, 64, (g) => {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(32, 24, 26, 20, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(28, 50, 16, 12, 0.3, 0, 7); g.fill();
    });
    this.butterflies = new THREE.Group();
    const rnd = this.rnd;
    const homes = [[-6, 10], [6, 8], [-14, 6], [12, 2], [-8, -6], [16, 16], [-18, 10], [4, 18]];
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: wingTex, color: colors[i % colors.length], transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 });
      const b = new THREE.Group();
      const wings = [-1, 1].map((s) => {
        const pivot = new THREE.Group();
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), mat);
        w.rotation.x = -Math.PI / 2;
        w.position.x = s * 0.11;
        if (s < 0) w.scale.x = -1;
        pivot.add(w);
        b.add(pivot);
        return pivot;
      });
      const [hx, hz] = homes[i % homes.length];
      const ph = rnd() * 10, sp = 0.3 + rnd() * 0.3, R = 1.5 + rnd() * 2.5;
      this.butterflies.add(b);
      this.anim.push((dt, t) => {
        const x = hx + Math.sin(t * sp + ph) * R + Math.sin(t * sp * 2.3 + ph) * 0.8;
        const z = hz + Math.cos(t * sp * 0.8 + ph) * R;
        const nx = hx + Math.sin((t + 0.05) * sp + ph) * R + Math.sin((t + 0.05) * sp * 2.3 + ph) * 0.8;
        const nz = hz + Math.cos((t + 0.05) * sp * 0.8 + ph) * R;
        b.position.set(x, 0.9 + Math.sin(t * 2.1 + ph) * 0.35, z);
        b.rotation.y = Math.atan2(nx - x, nz - z);
        const flap = Math.sin(t * 18 + ph) * 1.1;
        wings[0].rotation.z = flap; wings[1].rotation.z = -flap;
      });
    }
    this.group.add(this.butterflies);
  }

  // ---------- Kenney models ----------
  async buildModels() {
    const rnd = this.rnd;
    const B = new Batch(this.w);
    const tryPlace = (x, z, m) => !occupied(x, z, m);

    // forest: dense ring + scattered groves, with a minimum spacing
    const TREES = ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_pineRoundE',
      'tree_pineTallA_detailed', 'tree_pineTallC_detailed', 'tree_cone', 'tree_tall', 'tree_simple', 'tree_small', 'tree_pineTallB_detailed'];
    const FALL = ['tree_oak_fall', 'tree_default_fall', 'tree_detailed_fall', 'tree_fat_fall'];
    const placed = [];
    const far = (x, z, d) => placed.every(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 > d * d);
    for (let i = 0; i < 9000 && placed.length < 340; i++) {
      const a = rnd() * Math.PI * 2, r = 8 + Math.sqrt(rnd()) * 54;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const dense = r > 27;
      if (!dense && rnd() > 0.18) continue;
      if (!tryPlace(x, z, 1.8) && r < WORLD_R) continue;
      if (r > 62 || !far(x, z, dense ? 2.4 : 3.2) || pathDist(x, z) < 1.8) continue;
      placed.push([x, z]);
      const name = rnd() < 0.12 ? FALL[Math.floor(rnd() * FALL.length)] : TREES[Math.floor(rnd() * TREES.length)];
      const s = 2.6 + rnd() * 1.4;
      B.add(N(name), x, z, { s, ry: rnd() * 6.28 });
      this.w.staticCylinder(x, z, 0.35, 3);
      // undergrowth
      if (rnd() < 0.45) B.add(N(['plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall'][Math.floor(rnd() * 4)]), x + (rnd() - 0.5) * 2.4, z + (rnd() - 0.5) * 2.4, { s: 2.4 + rnd(), ry: rnd() * 6 });
      if (rnd() < 0.2) B.add(N(['mushroom_red', 'mushroom_redGroup', 'mushroom_tanGroup', 'mushroom_tanTall'][Math.floor(rnd() * 4)]), x + (rnd() - 0.5) * 2, z + 1 + rnd(), { s: 2.5, ry: rnd() * 6, shadow: false });
    }

    // meadow decoration: flower patches, bushes, rocks, logs
    const FLOWERS = ['flower_purpleA', 'flower_purpleB', 'flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB', 'flower_yellowC', 'flower_purpleC'];
    for (let p = 0; p < 70; p++) {
      const a = rnd() * Math.PI * 2, r = 6 + rnd() * 24;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      if (!tryPlace(cx, cz, 0.8)) continue;
      const kind = FLOWERS[Math.floor(rnd() * FLOWERS.length)];
      for (let k = 0; k < 6 + rnd() * 8; k++) {
        const x = cx + (rnd() - 0.5) * 2.6, z = cz + (rnd() - 0.5) * 2.6;
        if (tryPlace(x, z, 0.3)) B.add(N(rnd() < 0.75 ? kind : FLOWERS[Math.floor(rnd() * FLOWERS.length)]), x, z, { s: 2.2 + rnd() * 0.8, ry: rnd() * 6, shadow: false });
      }
    }
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2, r = 7 + rnd() * 22;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!tryPlace(x, z, 1)) continue;
      const roll = rnd();
      if (roll < 0.45) B.add(N(['plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'grass_leafsLarge'][Math.floor(rnd() * 4)]), x, z, { s: 2.6 + rnd(), ry: rnd() * 6 });
      else if (roll < 0.7) { B.add(N(['rock_smallA', 'rock_smallC', 'rock_smallFlatA', 'stone_smallB', 'stone_smallE'][Math.floor(rnd() * 5)]), x, z, { s: 3, ry: rnd() * 6 }); }
      else if (roll < 0.85) { B.add(N(['stump_round', 'stump_old', 'log']['012'.charAt(Math.floor(rnd() * 3))]), x, z, { s: 3, ry: rnd() * 6 }); this.w.staticCylinder(x, z, 0.4, 0.6); }
      else B.add(N('grass_large'), x, z, { s: 3, ry: rnd() * 6, shadow: false });
    }

    // pond shore: rocks, reeds, lilies, canoe
    const P = ZONES.pond;
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;  // keep the dock side open
      const rr = 1.02 + rnd() * 0.12;
      const x = P.x + Math.cos(a) * P.rx * rr, z = P.z + Math.sin(a) * P.rz * rr;
      B.add(N(['stone_smallA', 'stone_smallC', 'stone_largeA', 'rock_smallB', 'stone_smallFlatB'][Math.floor(rnd() * 5)]), x, z, { s: 2.6 + rnd(), ry: rnd() * 6 });
    }
    for (let i = 0; i < 30; i++) {
      const a = rnd() * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;
      const rr = 0.86 + rnd() * 0.12;
      B.add(N(rnd() < 0.5 ? 'plant_flatTall' : 'grass_large'), P.x + Math.cos(a) * P.rx * rr, P.z + Math.sin(a) * P.rz * rr, { s: 2.6, ry: rnd() * 6, shadow: false });
    }
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.75;
      const x = P.x + Math.cos(a) * P.rx * rr, z = P.z + Math.sin(a) * P.rz * rr;
      if (Math.abs(z + 2) < 1.2 && x > -19.5) continue;
      B.add(N(rnd() < 0.6 ? 'lily_large' : 'lily_small'), x, z, { s: 3, ry: rnd() * 6, y: 0.04, shadow: false });
    }
    single(N('canoe'), 3).then((c) => {
      c.position.set(P.x - 2, 0.02, P.z + 2.6);
      c.rotation.y = 0.9;
      this.group.add(c);
      this.w.staticBox(c.position.x, 0.3, c.position.z, 0.45, 0.3, 1.7, 0.9);
      this.anim.push((dt, t) => { c.position.y = 0.02 + Math.sin(t * 1.2) * 0.03; c.rotation.z = Math.sin(t * 0.9) * 0.04; });
    }).catch(() => {});

    // farm: fence with a gate gap facing the plaza, rows of crops
    const F = ZONES.farm, seg = 3;
    const fence = (x, z, ry) => B.add(N('fence_simple'), x, z, { s: 3, ry });
    for (let x = F.x0 + seg / 2; x < F.x1; x += seg) { fence(x, F.z0, 0); fence(x, F.z1, 0); }
    for (let z = F.z0 + seg / 2; z < F.z1; z += seg) {
      fence(F.x1, z, Math.PI / 2);
      if (Math.abs(z - -1.5) > 2) fence(F.x0, z, Math.PI / 2);
    }
    for (const p of [[F.x0, F.z0], [F.x1, F.z0], [F.x0, F.z1], [F.x1, F.z1]]) B.add(N('fence_corner'), p[0], p[1], { s: 3 });
    const fw = F.x1 - F.x0, fd = F.z1 - F.z0;
    this.w.staticBox((F.x0 + F.x1) / 2, 0.5, F.z0, fw / 2, 0.5, 0.1);
    this.w.staticBox((F.x0 + F.x1) / 2, 0.5, F.z1, fw / 2, 0.5, 0.1);
    this.w.staticBox(F.x1, 0.5, (F.z0 + F.z1) / 2, 0.1, 0.5, fd / 2);
    this.w.staticBox(F.x0, 0.5, (F.z0 + -3.2) / 2, 0.1, 0.5, (-3.2 - F.z0) / 2);
    this.w.staticBox(F.x0, 0.5, (F.z1 + 0.2) / 2, 0.1, 0.5, (F.z1 - 0.2) / 2);
    const CROPS = ['crops_cornStageD', 'crops_cornStageC', 'crop_pumpkin', 'crops_wheatStageB', 'crop_carrot', 'crops_leafsStageB', 'crop_melon'];
    let row = 0;
    for (let x = F.x0 + 1.6; x < F.x1 - 0.8; x += 1.6, row++) {
      const crop = CROPS[row % CROPS.length];
      for (let z = F.z0 + 1.2; z < F.z1 - 0.8; z += 1.35) {
        if (Math.abs(x - 21) < 1 && Math.abs(z + 3) < 1) continue;   // scarecrow
        B.add(N(crop), x + (rnd() - 0.5) * 0.15, z + (rnd() - 0.5) * 0.2, { s: 2.5 + rnd() * 0.3, ry: rnd() * 6, shadow: crop.includes('corn') });
      }
    }

    // farmyard props (Survival Kit)
    const Bn = ZONES.barn;
    const yard = [['barrel', Bn.x - 3.4, Bn.z - 2.6], ['barrel', Bn.x - 2.9, Bn.z - 3.2], ['bucket', Bn.x - 4, Bn.z - 2.2], ['workbench', Bn.x + 0.5, Bn.z + 3.2],
      ['chest', Bn.x - 1.5, Bn.z + 3.2], ['box-large', Bn.x + 3.6, Bn.z - 2.8], ['tool-hoe', Bn.x + 1.7, Bn.z + 3.2]];
    for (const [n, x, z] of yard) { B.add(S(n), x, z, { s: 2.7, ry: rnd() * 6 }); this.w.staticCylinder(x, z, 0.35, 1); }

    // cottage garden: picket fence, log pile, flower beds
    const C = ZONES.cottage;
    for (let x = C.x - 4.5; x <= C.x + 4.5; x += 3) if (Math.abs(x - C.x) > 1) fence(x, C.z + 5, 0);
    B.add(N('log_stackLarge'), C.x - 4.2, C.z - 0.5, { s: 3, ry: Math.PI / 2 });
    this.w.staticBox(C.x - 4.2, 0.5, C.z - 0.5, 0.6, 0.5, 1.1);
    B.add(N('stump_round'), C.x - 4.4, C.z + 2.3, { s: 3 });
    for (let i = 0; i < 18; i++) {
      const x = C.x - 4 + rnd() * 8, z = C.z + 3 + rnd() * 1.6;
      if (Math.abs(x - C.x) < 1) continue;
      B.add(N(FLOWERS[Math.floor(rnd() * FLOWERS.length)]), x, z, { s: 2.4, ry: rnd() * 6, shadow: false });
    }

    // campfire ring, log seats and a tent
    const CF = ZONES.campfire;
    B.add(N('campfire_stones'), CF.x, CF.z, { s: 3 });
    B.add(N('campfire_logs'), CF.x, CF.z, { s: 2.4 });
    for (let i = 0; i < 3; i++) {
      const a = -0.6 + i * 2.1;
      const x = CF.x + Math.cos(a) * 2.4, z = CF.z + Math.sin(a) * 2.4;
      B.add(N('log'), x, z, { s: 3, ry: -a });
      this.w.staticCylinder(x, z, 0.4, 0.5);
    }
    B.add(N('tent_detailedOpen'), CF.x + 3.6, CF.z + 3.4, { s: 3.2, ry: -2.4 });
    this.w.staticBox(CF.x + 3.6, 1, CF.z + 3.4, 1.4, 1, 1.4);

    // lantern posts + potted plants around the reading grove
    for (const z of [-5, -11, -17]) for (const x of [-11.6, 11.6]) {
      B.add(N('pot_large'), x, z, { s: 2.5 });
      B.add(N('plant_bushSmall'), x, z, { s: 2.2, y: 0.55 });
    }

    await B.build(this.group);
    this.w.assignMaterials?.();
  }

  // ---------- runtime ----------
  /** Apply time of day + weather (see environment.js). Returns the fog/background colour. */
  setEnv(env) {
    const P = resolvePalette(PALETTES, env);
    const u = this.groundMat.uniforms;
    for (const [uk, k] of [['uGrass', 'grass'], ['uGrass2', 'grass2'], ['uPath', 'path'], ['uSoil', 'soil'], ['uSand', 'sand'], ['uFog', 'fog']]) u[uk].value.copy(P[k]);
    this.grassMat.uniforms.uBase.value.copy(P.blade);
    this.grassMat.uniforms.uTip.value.copy(P.bladeTip);
    this.waterMat.uniforms.uDeep.value.copy(P.deep);
    this.waterMat.uniforms.uShallow.value.copy(P.shallow);
    this.waterMat.uniforms.uFoam.value.copy(P.foam);
    this.waterMat.uniforms.uRain.value = env.rain;
    for (const m of this.glows) m.emissiveIntensity = P.window;
    for (const { light, key } of this.lights) light.userData.base = light.intensity = P[key];
    for (const m of this.smokeMats || []) m.color.copy(P.smoke);
    this.butterflies.visible = env.day > 0.5 && env.rain < 0.5 && env.snow < 0.5;
    return P.fog;
  }

  /** Autumn tints the canopy, winter dusts it with snow. */
  setSeason(season) {
    const tints = {
      autumn: { leafsGreen: ['#ee9a3c', 0.62], leafsDark: ['#d7743a', 0.4], grass: ['#cdb95e', 0.2] },
      winter: { leafsGreen: ['#e4ece9', 0.4], leafsDark: ['#cfdcd8', 0.3], grass: ['#e8eef0', 0.5] },
    }[season] || {};
    for (const [name, m] of matCache) {
      if (!(name in NATURE_PAL)) continue;
      m.color.set(NATURE_PAL[name]);
      if (tints[name]) m.color.lerp(new THREE.Color(tints[name][0]), tints[name][1]);
    }
  }

  update(dt, t, player, wade) {
    this.grassMat.uniforms.uPlayer.value.copy(player);
    this.waterMat.uniforms.uPlayer.value.copy(player);
    this.waterMat.uniforms.uWade.value = wade;
    for (const fn of this.anim) fn(dt, t);
  }
}
