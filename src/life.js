import * as THREE from 'three';
import { toon } from './toon.js';
import { ZONES, pondDist } from './scenery.js';
import { sound } from './audio.js';

// Little critters: ducks paddling on the pond, chickens pecking by the barn, and a cat that follows you.
const rand = (a, b) => a + Math.random() * (b - a);
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const turn = (a, b, t) => a + ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * t;

function shadowed(g) { g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; }
function part(geo, mat, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }

function makeDuck(drake) {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.3, 14, 10), toon(drake ? '#b9a58c' : '#9a7b5c'), 0, 0.12, 0, g);
  body.scale.set(0.9, 0.62, 1.3);
  const tail = part(new THREE.ConeGeometry(0.12, 0.25, 8), toon(drake ? '#f4ecdc' : '#7d6248'), 0, 0.22, -0.38, g);
  tail.rotation.x = -2.2;
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.28); g.add(head);
  part(new THREE.SphereGeometry(0.15, 12, 10), toon(drake ? '#2f7a4f' : '#8a6a4a'), 0, 0, 0, head);
  const beak = part(new THREE.ConeGeometry(0.06, 0.18, 8), toon('#f2a33a'), 0, -0.03, 0.17, head);
  beak.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.025, 6, 6), toon('#1d1d1d'), s * 0.09, 0.04, 0.09, head);
  if (drake) { const ring = part(new THREE.TorusGeometry(0.11, 0.025, 6, 16), toon('#ffffff'), 0, 0.3, 0.22, g); ring.rotation.x = Math.PI / 2; }
  g.userData.head = head;
  return shadowed(g);
}

function makeChicken() {
  const g = new THREE.Group();
  const white = toon('#fbf6ec');
  const body = part(new THREE.SphereGeometry(0.24, 12, 10), white, 0, 0.36, 0, g);
  body.scale.set(0.85, 0.9, 1.1);
  part(new THREE.ConeGeometry(0.12, 0.22, 8), white, 0, 0.5, -0.24, g).rotation.x = -2.4;
  const head = new THREE.Group(); head.position.set(0, 0.6, 0.18); g.add(head);
  part(new THREE.SphereGeometry(0.11, 10, 8), white, 0, 0, 0, head);
  part(new THREE.BoxGeometry(0.04, 0.09, 0.1), toon('#e04a3f'), 0, 0.11, 0, head);
  const beak = part(new THREE.ConeGeometry(0.035, 0.09, 6), toon('#f2b33a'), 0, -0.01, 0.12, head);
  beak.rotation.x = Math.PI / 2;
  part(new THREE.BoxGeometry(0.035, 0.07, 0.03), toon('#e04a3f'), 0, -0.07, 0.1, head);
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.018, 6, 6), toon('#1d1d1d'), s * 0.07, 0.03, 0.07, head);
    part(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 5), toon('#f2b33a'), s * 0.08, 0.1, 0, g);
  }
  g.userData.head = head;
  return shadowed(g);
}

function makeCat() {
  const g = new THREE.Group();
  const fur = toon('#e8964f'), stripe = toon('#c46f2e'), cream = toon('#fbe9d2'), pink = toon('#f4a6a0');
  const body = new THREE.Group(); g.add(body);

  // body: a soft capsule with a cream chest and tabby stripes along the back
  const torso = part(new THREE.CapsuleGeometry(0.17, 0.42, 10, 24), fur, 0, 0.31, 0, body);
  torso.rotation.x = Math.PI / 2;
  part(new THREE.SphereGeometry(0.15, 20, 16), cream, 0, 0.27, 0.2, body).scale.set(0.9, 0.85, 0.7);
  for (const z of [-0.18, -0.04, 0.1]) {
    part(new THREE.TorusGeometry(0.168, 0.028, 8, 24, Math.PI), stripe, 0, 0.31, z, body);   // arcs over the back
  }

  // head: round with cheek fluff, a muzzle, big eyes, pink nose, whiskers and ears with pink insides
  const head = new THREE.Group(); head.position.set(0, 0.5, 0.36); body.add(head);
  part(new THREE.SphereGeometry(0.18, 28, 22), fur, 0, 0, 0, head).scale.set(1.08, 0.95, 1);
  for (const sx of [-1, 1]) part(new THREE.SphereGeometry(0.09, 16, 12), fur, sx * 0.13, -0.06, 0.06, head);
  part(new THREE.SphereGeometry(0.085, 18, 14), cream, 0, -0.06, 0.13, head).scale.set(1.25, 0.8, 0.8);
  part(new THREE.BoxGeometry(0.03, 0.07, 0.02), stripe, 0, 0.12, 0.14, head);
  for (const sx of [-1, 1]) {
    part(new THREE.SphereGeometry(0.048, 18, 14), toon('#7cc36a'), sx * 0.075, 0.03, 0.15, head);
    const pupil = part(new THREE.CapsuleGeometry(0.014, 0.04, 4, 10), toon('#1d1d1d'), sx * 0.075, 0.03, 0.193, head);
    pupil.scale.z = 0.4;
    part(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), sx * 0.075 + 0.015, 0.05, 0.198, head);
    const ear = part(new THREE.ConeGeometry(0.065, 0.14, 4), fur, sx * 0.1, 0.16, -0.02, head);
    ear.rotation.set(-0.15, Math.PI / 4, -sx * 0.25);
    const inner = part(new THREE.ConeGeometry(0.035, 0.09, 4), pink, sx * 0.1, 0.155, 0.005, head);
    inner.rotation.copy(ear.rotation);
  }
  part(new THREE.SphereGeometry(0.02, 10, 8), pink, 0, -0.03, 0.2, head).scale.set(1.3, 0.8, 0.8);
  const whiskers = [];
  for (const sx of [-1, 1]) for (const dy of [-0.012, 0.012]) {
    whiskers.push(new THREE.Vector3(sx * 0.07, -0.05 + dy, 0.18), new THREE.Vector3(sx * 0.22, -0.04 + dy * 3, 0.16));
  }
  head.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(whiskers), new THREE.LineBasicMaterial({ color: '#fff8ee' })));

  // legs with white socks
  const legs = [];
  for (const [x, z] of [[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.2], [0.09, -0.2]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.24, z); body.add(leg);
    part(new THREE.CapsuleGeometry(0.042, 0.14, 6, 12), fur, 0, -0.1, 0, leg);
    part(new THREE.SphereGeometry(0.05, 14, 10), cream, 0, -0.2, 0.01, leg).scale.set(1, 0.7, 1.2);
    legs.push(leg);
  }

  // a curvy striped tail
  const tail = new THREE.Group(); tail.position.set(0, 0.34, -0.3); body.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.12, -0.12), new THREE.Vector3(0.02, 0.32, -0.16), new THREE.Vector3(0.06, 0.44, -0.08)]);
  part(new THREE.TubeGeometry(curve, 24, 0.032, 10), fur, 0, 0, 0, tail);
  const tip = part(new THREE.SphereGeometry(0.036, 12, 10), stripe, 0.06, 0.44, -0.08, tail);
  tip.scale.set(1, 1.3, 1);

  Object.assign(g.userData, { body, head, legs, tail });
  return shadowed(g);
}

export class Life {
  constructor(w) {
    this.w = w;
    this.group = new THREE.Group();
    w.scene.add(this.group);

    const P = ZONES.pond;
    this.ducks = [0, 1, 2, 3].map((i) => {
      const mesh = makeDuck(i % 2 === 0);
      if (i === 3) mesh.scale.setScalar(0.6);       // a duckling
      mesh.position.set(P.x + rand(-3, 3), 0.04, P.z + rand(-2, 2));
      this.group.add(mesh);
      return { mesh, target: this.pondPoint(), speed: rand(0.5, 0.8), heading: rand(0, 6), t: rand(0, 9) };
    });

    const B = ZONES.barn;
    this.yard = { x0: B.x - 6.5, x1: B.x - 3.6, z0: B.z - 2.5, z1: B.z + 4.5 };
    this.chickens = [0, 1, 2, 3, 4].map(() => {
      const mesh = makeChicken();
      mesh.position.set(rand(this.yard.x0, this.yard.x1), 0, rand(this.yard.z0, this.yard.z1));
      this.group.add(mesh);
      return { mesh, target: this.yardPoint(), heading: rand(0, 6), wait: rand(0, 3), peck: 0 };
    });

    this.cat = { mesh: makeCat(), heading: 0, walk: 0, sit: 0, meowT: 0 };
    this.cat.mesh.position.set(1.5, 0, 7.5);
    this.group.add(this.cat.mesh);
  }

  pondPoint() {
    const P = ZONES.pond, a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 0.72;
    return new THREE.Vector3(P.x + Math.cos(a) * P.rx * r, 0, P.z + Math.sin(a) * P.rz * r);
  }
  yardPoint() { const y = this.yard; return new THREE.Vector3(rand(y.x0, y.x1), 0, rand(y.z0, y.z1)); }

  update(dt, t, player, seated) {
    // ducks: drift between random spots, paddle away from the player
    for (const d of this.ducks) {
      const m = d.mesh;
      const away = m.position.clone().sub(player).setY(0);
      if (away.length() < 2.6) {
        const flee = m.position.clone().add(away.setLength(2.5));
        if (pondDist(flee.x, flee.z) < -0.2) d.target = flee;
        if (Math.random() < dt * 0.6) sound.sfx('quack');
      }
      const to = d.target.clone().sub(m.position).setY(0);
      if (to.length() < 0.3 || Math.random() < dt * 0.08) d.target = this.pondPoint();
      d.heading = turn(d.heading, angleTo(m.position, d.target), Math.min(1, dt * 2));
      const sp = d.speed * Math.min(1, to.length());
      m.position.x += Math.sin(d.heading) * sp * dt;
      m.position.z += Math.cos(d.heading) * sp * dt;
      m.position.y = 0.04 + Math.sin(t * 2 + d.t) * 0.02;
      m.rotation.set(Math.sin(t * 1.7 + d.t) * 0.05, d.heading, Math.sin(t * 2.3 + d.t) * 0.05);
      m.userData.head.rotation.x = Math.max(0, Math.sin(t * 0.7 + d.t * 3)) * 0.6;   // dip for food now and then
    }

    // chickens: wander, stop, peck; scatter when you run at them
    for (const c of this.chickens) {
      const m = c.mesh;
      const away = m.position.clone().sub(player).setY(0);
      if (away.length() < 1.8) { c.target = m.position.clone().add(away.setLength(2)); c.wait = 0; }
      c.target.x = THREE.MathUtils.clamp(c.target.x, this.yard.x0, this.yard.x1);
      c.target.z = THREE.MathUtils.clamp(c.target.z, this.yard.z0, this.yard.z1);
      const to = c.target.clone().sub(m.position).setY(0);
      if (c.wait > 0) {
        c.wait -= dt;
        c.peck += dt * 9;
        m.userData.head.rotation.x = Math.max(0, Math.sin(c.peck)) * 0.9;
        if (c.wait <= 0) c.target = this.yardPoint();
      } else if (to.length() < 0.2) {
        c.wait = rand(1.5, 4);
      } else {
        c.heading = turn(c.heading, angleTo(m.position, c.target), Math.min(1, dt * 6));
        const sp = Math.min(2.2, to.length() * 2);
        m.position.x += Math.sin(c.heading) * sp * dt;
        m.position.z += Math.cos(c.heading) * sp * dt;
        m.position.y = Math.abs(Math.sin(t * 16 + c.heading)) * 0.04;
        m.userData.head.rotation.x = Math.sin(t * 16) * 0.15;
      }
      m.rotation.y = c.heading;
    }

    // cat: trails a little behind you, sits when you stop, curls up next to your seat
    const cat = this.cat, m = cat.mesh, u = m.userData;
    const goal = seated
      ? new THREE.Vector3(seated.x + Math.cos(seated.face) * 0.9, 0, seated.z - Math.sin(seated.face) * 0.9)
      : player.clone().setY(0);
    const to = goal.clone().sub(m.position).setY(0);
    const dist = to.length();
    const want = seated ? 0.05 : 1.6;
    if (dist > want) {
      const sp = Math.min(dist > 6 ? 7 : 4, (dist - want) * 2.5);
      cat.heading = turn(cat.heading, Math.atan2(to.x, to.z), Math.min(1, dt * 6));
      m.position.x += Math.sin(cat.heading) * sp * dt;
      m.position.z += Math.cos(cat.heading) * sp * dt;
      cat.walk += dt * sp * 6;
      cat.sit = Math.max(0, cat.sit - dt * 4);
      if (dist > 30) m.position.copy(goal).add(new THREE.Vector3(1.5, 0, 1.5));   // teleport if left far behind
    } else {
      cat.sit = Math.min(1, cat.sit + dt * 2);
      if (!seated) cat.heading = turn(cat.heading, angleTo(m.position, player), Math.min(1, dt * 3));
    }
    m.rotation.y = cat.heading;
    const swing = cat.sit < 0.5 ? Math.sin(cat.walk) * 0.6 : 0;
    u.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? swing : -swing); });
    u.body.rotation.x = -cat.sit * 0.45;                  // sit back on the hind legs
    u.body.position.y = -cat.sit * 0.06;
    u.tail.rotation.z = Math.sin(t * 2.4) * 0.5;
    u.head.rotation.y = Math.sin(t * 0.5) * 0.3 * cat.sit;
    cat.meowT -= dt;
    if (dist < 2.5 && cat.meowT < 0 && Math.random() < dt * 0.05) { sound.sfx('meow'); cat.meowT = 20; }
  }
}
