import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// KayKit Adventurers (CC0, Kay Lousberg). All characters share the Rig_Medium skeleton,
// so one set of animation clips drives every model.
const BASE = 'assets/kaykit/';
export const CHARACTERS = ['Mage', 'Knight', 'Ranger', 'Rogue', 'Rogue_Hooded', 'Barbarian'];
const RIGS = ['Rig_Medium_MovementBasic.glb', 'Rig_Medium_General.glb'];
const CLIP = { idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', jumpStart: 'Jump_Start', air: 'Jump_Idle', land: 'Jump_Land', interact: 'Interact', spawn: 'Spawn_Ground' };
const ONCE = new Set(['jumpStart', 'land', 'interact', 'spawn']);
const HEIGHT = 1.85;

const loader = new GLTFLoader();
let clipsPromise, bookPromise;

const loadClips = () => (clipsPromise ??= Promise.all(RIGS.map((f) => loader.loadAsync(BASE + f))).then((gs) => {
  const map = new Map();
  for (const g of gs) for (const c of g.animations) map.set(c.name, c);
  return map;
}));
const loadBook = () => (bookPromise ??= loader.loadAsync(BASE + 'spellbook_closed.gltf').then((g) => g.scene));

export class Character {
  /** toonify(material) -> material lets the world keep one consistent shading style */
  constructor(parent, toonify) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.toonify = toonify;
    this.state = null;
    this.locked = 0;     // seconds left on a one-shot clip
  }

  async load(name) {
    const [gltf, clips, book] = await Promise.all([loader.loadAsync(`${BASE}${name}.glb`), loadClips(), loadBook().catch(() => null)]);
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      o.material = this.toonify(o.material);
    });
    // normalise height and stand on y = 0
    const box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(HEIGHT / (box.max.y - box.min.y));
    model.position.y = -box.min.y * model.scale.y;

    // a little book in the right hand — we're in a library after all
    const hand = model.getObjectByName('handslot.r');
    if (hand && book) {
      const b = book.clone();
      b.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = this.toonify(o.material); } });
      hand.add(b);
    }

    this.dispose();
    this.model = model;
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const [key, clipName] of Object.entries(CLIP)) {
      const clip = clips.get(clipName);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      if (ONCE.has(key)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
      this.actions[key] = a;
    }
    this.state = null;
    this.play('spawn', 0);
    return this;
  }

  play(key, fade = 0.2) {
    const next = this.actions?.[key];
    if (!next || this.state === key) return;
    const prev = this.actions[this.state];
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev) prev.fadeOut(fade);
    this.state = key;
    this.locked = ONCE.has(key) ? next.getClip().duration * 0.85 : 0;
  }

  /** Called every frame with the player's movement state. */
  update(dt, { moving, running, air, landed }) {
    if (!this.mixer) return;
    this.locked = Math.max(0, this.locked - dt);
    if (air) {
      if (this.state !== 'jumpStart' && this.state !== 'air') this.play('jumpStart', 0.1);
      else if (this.state === 'jumpStart' && this.locked === 0) this.play('air', 0.15);
    } else if (landed && (this.state === 'air' || this.state === 'jumpStart')) {
      this.play('land', 0.08);
    } else if (this.locked === 0 || (moving && this.state !== 'interact')) {
      this.play(moving ? (running ? 'run' : 'walk') : 'idle', 0.2);
    }
    this.mixer.update(dt);
  }

  interact() { this.play('interact', 0.15); }

  dispose() {
    if (!this.model) return;
    this.mixer?.stopAllAction();
    this.root.remove(this.model);
    this.model = null;
  }
}
