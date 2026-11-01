import * as THREE from 'three';
import { toon, canvasTexture } from './toon.js';
import { ZONES } from './scenery.js';

// Halloween in Hearthwood: carved pumpkins that glow after dark, bats over the rooftops at dusk,
// and a shy little ghost drifting around Willow Pond. On by itself from October to early November;
// the world panel can force it on or off.

/** October, plus the first week of November for the stragglers. */
export function inSeason(d = new Date()) { return d.getMonth() === 9 || (d.getMonth() === 10 && d.getDate() <= 7); }

// by the welcome sign, the plaza lamps, the garden gate, every work area's sign and the farm buildings
const PUMPKINS = [
  [-3.4, 5.1, 1.0], [-0.8, 5.1, 0.75], [-5.3, -2.7, 0.9], [5.3, -2.7, 0.9], [-5.3, 6.7, 1.1], [6.2, 5.4, 0.8], [-3.2, -1.7, 0.7],
  [-1.7, -24.2, 1.15], [-2.3, -25.0, 0.7], [-20.4, -11.5, 0.9], [-16.6, -11.5, 0.8], [-21.9, -27.4, 0.9], [-18.1, -27.4, 0.75],
  [21.9, -27.4, 1.0], [22.4, -26.4, 0.7], [15.3, -15.3, 0.85], [18.7, -15.3, 0.9], [12.4, 12.8, 1.2], [-14.3, 18.0, 1.0],
  [18.0, 8.4, 1.3], [-13.4, -4.4, 0.8], [13.2, -3.1, 1.1], [23.4, -15.4, 0.95],
];
const R = 0.34, SQUASH = 0.78;

/** A ribbed, slightly squashed sphere. */
function pumpkinGeometry() {
  const g = new THREE.SphereGeometry(R, 32, 18);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const lobe = Math.sqrt(Math.abs(Math.sin(Math.atan2(v.z, v.x) * 4)));     // 8 lobes with soft grooves between
    const f = 0.9 + 0.1 * lobe;
    p.setXYZ(i, v.x * f, v.y * SQUASH, v.z * f);
  }
  g.computeVertexNormals();
  return g;
}

/** The carved face, drawn where the sphere's UVs face +z (u = 0.25). `glow` paints the light inside. */
function faceTexture(glow) {
  return canvasTexture(1024, 512, (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#fff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#ffd27a' : '#3a1606';
    const cx = w * 0.25, cy = h * 0.5;
    for (const s of [-1, 1]) {                                   // triangle eyes
      g.beginPath(); g.moveTo(cx + s * 30, cy - 70); g.lineTo(cx + s * 70, cy - 18); g.lineTo(cx + s * 12, cy - 22); g.closePath(); g.fill();
    }
    g.beginPath(); g.moveTo(cx - 8, cy - 4); g.lineTo(cx + 8, cy - 4); g.lineTo(cx, cy + 14); g.closePath(); g.fill();   // nose
    // jagged grin
    g.beginPath(); g.moveTo(cx - 84, cy + 22);
    const teeth = [[-62, 40], [-48, 30], [-30, 52], [-12, 38], [8, 56], [26, 38], [44, 52], [62, 30], [84, 22]];
    for (const [x, y] of teeth) g.lineTo(cx + x, cy + y);
    g.quadraticCurveTo(cx, cy + 130, cx - 84, cy + 22); g.fill();
  });
}

function batWing() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.04);
  s.quadraticCurveTo(0.2, 0.2, 0.44, 0.1);
  s.quadraticCurveTo(0.39, 0.03, 0.36, -0.02);
  s.quadraticCurveTo(0.31, 0.05, 0.26, -0.04);
  s.quadraticCurveTo(0.19, 0.03, 0.13, -0.06);
  s.quadraticCurveTo(0.07, 0.0, 0, -0.04);
  const g = new THREE.ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);                    // lie flat, spreading along +x
  return g;
}

function ghostMesh() {
  const g = new THREE.Group();
  // a rounded hood that flares into a wavy hem
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI / 2;
    pts.push(new THREE.Vector2(Math.sin(a) * 0.36, 0.55 + Math.cos(a) * 0.36));
  }
  pts.push(new THREE.Vector2(0.4, 0.25), new THREE.Vector2(0.46, 0.0));
  const body = new THREE.LatheGeometry(pts, 32);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0.05) p.setY(i, y + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 6) * 0.06);   // scalloped hem
  }
  body.computeVertexNormals();
  const sheet = new THREE.MeshToonMaterial({ color: '#f4f8ff', emissive: '#bcd8ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(body, sheet));
  const ink = new THREE.MeshBasicMaterial({ color: '#2b2440' });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), ink);
    eye.scale.set(1, 1.35, 0.6); eye.position.set(s * 0.12, 0.6, 0.33); g.add(eye);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), sheet);
    arm.scale.set(1.4, 0.7, 0.8); arm.position.set(s * 0.4, 0.38, 0.05); g.add(arm);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.014, 6, 12), ink);
  mouth.position.set(0, 0.47, 0.35); g.add(mouth);
  g.userData.sheet = sheet;
  return g;
}

export class Halloween {
  constructor(w) {
    this.w = w;
    this.root = new THREE.Group();
    w.scene.add(this.root);

    // pumpkins: one instanced body + one instanced stem, so all of them cost two draw calls
    this.glow = new THREE.MeshToonMaterial({ color: '#e8772e', map: faceTexture(false), emissive: '#ffb347', emissiveMap: faceTexture(true), emissiveIntensity: 0.1 });
    const bodies = new THREE.InstancedMesh(pumpkinGeometry(), this.glow, PUMPKINS.length);
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.055, 0.16, 6), toon('#5b6e2c'), PUMPKINS.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.colliders = PUMPKINS.map(([x, z, s], i) => {
      const yaw = Math.sin(i * 12.9898) * 0.5;                 // faces roughly toward the camera, each a bit askew
      q.setFromEuler(e.set(0, yaw, 0));
      m.compose(new THREE.Vector3(x, R * SQUASH * s, z), q, new THREE.Vector3(s, s, s));
      bodies.setMatrixAt(i, m);
      q.setFromEuler(e.set(0.15, yaw, 0.1));
      m.compose(new THREE.Vector3(x, (2 * R * SQUASH + 0.05) * s, z), q, new THREE.Vector3(s, s, s));
      stems.setMatrixAt(i, m);
      return w.staticCylinder(x, z, R * 0.9 * s, R * 2 * SQUASH * s);
    });
    for (const im of [bodies, stems]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.root.add(im); }

    // bats: body + two wings as instanced meshes, flapping and looping over a few landmarks
    const BATS = 15;
    const batMat = new THREE.MeshBasicMaterial({ color: '#251b30', side: THREE.DoubleSide });
    const wingR = batWing(), wingL = batWing().scale(-1, 1, 1);
    this.batParts = [new THREE.SphereGeometry(0.06, 8, 6).scale(0.85, 0.75, 1.4), wingL, wingR]
      .map((geo) => { const im = new THREE.InstancedMesh(geo, batMat, BATS); im.frustumCulled = false; this.root.add(im); return im; });
    // low enough to pass over your head: the camera sits close above, so high bats would fly off screen
    const homes = [[ZONES.plaza.x, ZONES.plaza.z, 4], [ZONES.portfolio.x, ZONES.portfolio.z, 5], [ZONES.windmill.x, ZONES.windmill.z, 3.5],
      [ZONES.pond.x, ZONES.pond.z, 4.5], [0, -10, 5]];
    this.bats = Array.from({ length: BATS }, (_, i) => {
      const [hx, hz, r] = homes[i % homes.length];
      return { hx, hz, r: r * (0.7 + ((i * 37) % 10) / 20), h: 2.6 + ((i * 53) % 10) / 6.5, speed: (0.55 + ((i * 17) % 10) / 20) * (i % 2 ? 1 : -1), phase: i * 2.4 };
    });

    // the ghost, drifting around the pond
    this.ghost = ghostMesh();
    this.root.add(this.ghost);
    this.ghostA = 0;

    this.mat4 = new THREE.Matrix4(); this.flap = new THREE.Matrix4(); this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.one = new THREE.Vector3(1.5, 1.5, 1.5);   // bat size
    this.setMode('auto');
  }

  /** 'auto' (by the calendar) | 'on' | 'off' */
  setMode(mode) {
    this.mode = mode;
    this.active = mode === 'on' || (mode === 'auto' && inSeason());
    this.root.visible = this.active;
    for (const b of this.colliders) b.userData.off = !this.active;
    this.w.streamStatics?.();
  }

  update(dt, t, player, env) {
    if (!this.active) return;
    const night = THREE.MathUtils.clamp((0.62 - (env?.day ?? 1)) / 0.45, 0, 1);   // 0 by day … 1 deep night
    // candle-light flicker inside the pumpkins
    this.glow.emissiveIntensity = 0.1 + night * (1.7 + Math.sin(t * 13) * 0.18 + Math.sin(t * 7.3) * 0.12);

    // bats only come out at dusk and after dark
    const batsOut = night > 0.15;
    for (const im of this.batParts) im.visible = batsOut;
    if (batsOut) {
      this.bats.forEach((b, i) => {
        const a = t * b.speed + b.phase;
        const r = b.r + Math.sin(t * 2.3 + b.phase) * 0.6;
        this.pos.set(b.hx + Math.cos(a) * r, b.h + Math.sin(a * 2 + b.phase) * 0.45, b.hz + Math.sin(a) * r * 0.75);
        const heading = Math.atan2(-Math.sin(a) * Math.sign(b.speed), Math.cos(a) * 0.75 * Math.sign(b.speed));
        this.quat.setFromEuler(new THREE.Euler(0, heading, Math.sin(t * 3 + i) * 0.2));
        this.mat4.compose(this.pos, this.quat, this.one);
        this.batParts[0].setMatrixAt(i, this.mat4);
        const flap = Math.sin(t * 17 + b.phase) * 0.85;
        this.batParts[1].setMatrixAt(i, this.flap.makeRotationZ(-flap).premultiply(this.mat4));
        this.batParts[2].setMatrixAt(i, this.flap.makeRotationZ(flap).premultiply(this.mat4));
      });
      for (const im of this.batParts) im.instanceMatrix.needsUpdate = true;
    }

    // the ghost fades in after dark, circles the pond, and stops to look at you if you come close
    const gh = this.ghost, P = ZONES.pond;
    gh.visible = night > 0.05;
    if (!gh.visible) return;
    gh.userData.sheet.opacity = 0.88 * Math.min(1, night * 1.6);
    const near = Math.hypot(player.x - gh.position.x, player.z - gh.position.z) < 4;
    if (!near) this.ghostA += dt * 0.12;
    const gx = P.x + Math.cos(this.ghostA) * (P.rx + 1.6), gz = P.z + Math.sin(this.ghostA) * (P.rz + 1.4);
    gh.position.set(gx, 0.9 + Math.sin(t * (near ? 3.2 : 1.6)) * 0.15, gz);
    const face = near ? Math.atan2(player.x - gx, player.z - gz) : this.ghostA + Math.PI;     // along its path, or at you
    gh.rotation.y += ((((face - gh.rotation.y) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * Math.min(1, dt * 4);
    gh.rotation.z = Math.sin(t * 1.3) * 0.08;
  }
}
