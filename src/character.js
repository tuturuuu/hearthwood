import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// KayKit Adventurers (CC0, Kay Lousberg). All characters share the Rig_Medium skeleton,
// so one set of animation clips drives every model.
const BASE = 'assets/kaykit/';
export const CHARACTERS = ['Mage', 'Knight', 'Ranger', 'Rogue', 'Rogue_Hooded', 'Barbarian'];
// trimmed copies of KayKit's Rig_Medium files (skeleton + the clips below only) — see tools/strip_rig.py
const RIGS = ['rig-movement.glb', 'rig-general.glb'];
const CLIP = { idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', jumpStart: 'Jump_Start', air: 'Jump_Idle', land: 'Jump_Land', interact: 'Interact', spawn: 'Spawn_Ground' };
const ONCE = new Set(['jumpStart', 'land', 'interact', 'spawn']);
const HEIGHT = 1.85;

const loader = new GLTFLoader();
// GLTFLoader strips characters like '.' from node names ('handslot.r' → 'handslotr')
const findNode = (root, name) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
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
    this.sit = 0;        // 0 standing … 1 fully seated (blended)
    this.sitTarget = 0;
    this.hipsHeight = 0.9;
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
    const hand = findNode(model, 'handslot.r');
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
    this.bones = Object.fromEntries(['hips', 'spine', 'upperleg.l', 'upperleg.r', 'lowerleg.l', 'lowerleg.r', 'upperarm.l', 'upperarm.r', 'lowerarm.l', 'lowerarm.r']
      .map((n) => [n, findNode(model, n)]));
    this.root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    if (this.bones.hips) this.hipsHeight = this.bones.hips.getWorldPosition(v).y - this.root.getWorldPosition(new THREE.Vector3()).y;
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
    this.sit += (this.sitTarget - this.sit) * Math.min(1, dt * 7);
    if (this.sit > 0.01) this.applySitPose(this.sit);
  }

  setSitting(on) {
    this.sitTarget = on ? 1 : 0;
    if (on) this.play('idle', 0.2);
  }

  /** No sit clip in the free pack, so pose the skeleton on top of the idle animation. */
  applySitPose(k) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    const pose = [['upperleg.l', -1.2], ['upperleg.r', -1.2], ['lowerleg.l', 1.25], ['lowerleg.r', 1.25],
      ['spine', 0.12], ['upperarm.l', -0.55], ['upperarm.r', -0.7], ['lowerarm.l', -0.9], ['lowerarm.r', -0.8]];
    for (const [name, angle] of pose) {
      const bone = this.bones?.[name];
      if (!bone) continue;
      const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      const q = new THREE.Quaternion().setFromAxisAngle(right, angle * k);
      bone.quaternion.premultiply(pq.clone().invert().multiply(q).multiply(pq));
    }
  }

  interact() { this.play('interact', 0.15); }

  dispose() {
    if (!this.model) return;
    this.mixer?.stopAllAction();
    this.root.remove(this.model);
    this.model = null;
  }
}
