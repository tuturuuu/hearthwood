import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Character } from './character.js';
import { toon } from './toon.js';
import { db } from './db.js';
import { DialogueBox } from './dialogue.js';
import { ZONES, ZONE_NAMES } from './scenery.js';
import { PROFILE, PROJECTS, EXPERIENCE, SKILLS } from './profile.js';

// Villagers of Hearthwood: KayKit adventurers who stroll a little route and chat when you walk up.
// Each one has a few "topics" (short conversations); talking again moves on to the next. Edit freely.

const pick = (list, i) => list[((i % list.length) + list.length) % list.length];

// short public-domain lines, so they can be quoted freely
const QUOTES = [
  ['I declare after all there is no enjoyment like reading!', 'Jane Austen, Pride and Prejudice'],
  ['I am not afraid of storms, for I am learning how to sail my ship.', 'Louisa May Alcott, Little Women'],
  ['Curiouser and curiouser!', 'Lewis Carroll, Alice’s Adventures in Wonderland'],
  ['I went to the woods because I wished to live deliberately.', 'Henry David Thoreau, Walden'],
  ['Beware; for I am fearless, and therefore powerful.', 'Mary Shelley, Frankenstein'],
  ['It was the best of times, it was the worst of times.', 'Charles Dickens, A Tale of Two Cities'],
  ['I would always rather be happy than dignified.', 'Charlotte Brontë, Jane Eyre'],
  ['Whatever our souls are made of, his and mine are the same.', 'Emily Brontë, Wuthering Heights'],
  ['There is nothing like staying at home for real comfort.', 'Jane Austen, Emma'],
  ['Who in the world am I? Ah, that’s the great puzzle!', 'Lewis Carroll, Alice’s Adventures in Wonderland'],
  ['All happy families are alike; each unhappy family is unhappy in its own way.', 'Leo Tolstoy, Anna Karenina'],
  ['Time is but the stream I go a-fishing in.', 'Henry David Thoreau, Walden'],
];

/** "north-west", "east"… from the player to a place (north is up the screen). */
function direction(from, to) {
  const a = Math.atan2(to.x - from.x, -(to.z - from.z));
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

function timeOfDay(h) { return h < 5 || h >= 21 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }

export const VILLAGERS = [
  {
    id: 'mira', name: 'Mira', role: 'Librarian', model: 'Mage', book: true, color: '#8a6fd1', pitch: 1.3,
    halloween: ['Happy Halloween! I’ve been rereading Poe by candlelight.', '“Once upon a midnight dreary, while I pondered, weak and weary…”\n— Edgar Allan Poe, The Raven'],
    // between the shelves of the Reading Grove
    route: [[0, -3.4], [0, -9], [4.9, -9], [0, -9], [-4.9, -9], [0, -9]],
    topics: [
      ({ books, last }) => books.length
        ? [`Welcome back to the Reading Grove! Your shelves hold ${books.length} book${books.length > 1 ? 's' : ''}.`,
          last ? `Last time you were in “${last.title}”, page ${last.lastPage || 1} of ${last.pages}. The nook down the aisle is lovely for picking it back up.` : 'Pick any spine and press Enter to start reading.']
        : ['Oh! A visitor. I’m Mira, I look after these shelves.', 'They’re empty for now… drop a PDF anywhere on the screen and I’ll shelve it for you.'],
      ({ n }) => { const [q, by] = pick(QUOTES, n); return ['Here’s one I keep coming back to:', `“${q}”\n— ${by}`]; },
      () => ['A reading tip: sit on any bench, log or hay bale with E, then press Enter to read from right there.',
        'Your highlights, notes and bookmarks never leave this browser. I’m a very discreet librarian.'],
      ({ n }) => { const [q, by] = pick(QUOTES, n + 5); return [`“${q}”`, `${by}. Shall I find you another next time?`]; },
    ],
  },
  {
    id: 'bram', name: 'Sir Bram', role: 'Garden Keeper', model: 'Knight', color: '#c48a5a', pitch: 0.75,
    halloween: ['Happy Halloween. Knights don’t get scared, you know.', '…The ghost by the pond doesn’t count. It snuck up on me.'],
    // at the gate of Việt's Garden
    route: [[2.4, -24.4], [3.6, -25.2]],
    topics: [
      () => [`Halt! …Just kidding. Welcome to ${ZONE_NAMES.portfolio}.`,
        `${PROFILE.fullName} built everything you see here. ${PROFILE.role}, from ${PROFILE.location}.`, PROFILE.about],
      ({ n }) => { const p = pick(PROJECTS, n); return [`Ask me about “${p.title}”. ${p.kind}.`, p.text, 'Its board is in the garden. Walk up and press Enter to open it on GitHub.']; },
      () => [`These days: ${PROFILE.now.replace(' @ ', ' at ')}.`, 'Fraud hunting, data pipelines, models in production. The Data Observatory out east tells the whole story.'],
      ({ n }) => { const s = pick(SKILLS, n); return [`${s.group}? Let me count: ${s.items.join(' · ')}.`, 'They orbit the fountain in the middle of the garden. Go and have a look.']; },
      () => ['Want to reach Việt? The GitHub and LinkedIn pads are by the fountain.', 'Step on one and press Enter. I’ll keep the hedges tidy meanwhile.'],
    ],
  },
  {
    id: 'rowan', name: 'Rowan', role: 'Scout', model: 'Ranger', color: '#4d908e', pitch: 1.05,
    halloween: ['Bats are out after dark this time of year. They loop over the garden and the windmill.', 'Press T to skip to nightfall if you want to see them.'],
    // walks the trail between the Reading Grove and the work areas on the west side
    route: [[-12.4, -14.4], [-10.4, -15.4], [-10.4, -22.4], [-15.6, -23.9], [-17.8, -24.2], [-15.6, -23.9], [-10.4, -22.4], [-10.4, -15.4]],
    topics: (() => {
      const keys = Object.keys(EXPERIENCE);
      return keys.map((k, i) => ({ me }) => {
        const e = EXPERIENCE[k], z = ZONES[k];
        return [i === 0 ? 'I map every trail around here. Want directions?' : `Next stop on my map: ${e.area}.`,
          `${e.area} is ${direction(me, z)} of us. That’s ${e.title}, ${e.org} (${e.when}).`,
          e.points[0] + '.', 'Read the sign by its fence and press Enter for the full story.'];
      });
    })(),
  },
  {
    id: 'wren', name: 'Wren', role: 'Fisher', model: 'Rogue_Hooded', color: '#5b8fb9', pitch: 0.95,
    halloween: ['There’s a little ghost that drifts around this pond at night.', 'Harmless. Walk up to it and it stops to look at you. I think it just wants company.'],
    // on the shore by the dock
    route: [[-13.0, 0.2], [-12.0, 2.6]],
    topics: [
      ({ fish }) => fish.total
        ? [`${fish.total} fish of ${fish.kinds} kind${fish.kinds > 1 ? 's' : ''} so far. Not bad, not bad.`, 'The rare ones bite when it’s quiet. Try at night.']
        : ['Shh… you’ll scare the fish.', 'Sit at the end of the dock, press F to cast, and press F again when the bobber dips.'],
      () => ['“Time is but the stream I go a-fishing in.” Thoreau wrote that by a pond much like this one.', 'Thoreau read a lot, too. You two would get along.'],
      ({ env }) => env.rain ? ['Rain is the best fishing weather, you know.', 'The ducks disagree.'] : ['The ducks think this is their pond.', 'Honestly? It probably is.'],
    ],
  },
  {
    id: 'tam', name: 'Big Tam', role: 'Farmer', model: 'Barbarian', color: '#e07a5f', pitch: 0.65,
    halloween: ['Grew a whole patch of pumpkins this year and carved faces into the best ones.', 'Now they glow and stare at me all night. I regret nothing.'],
    // along the lane at the edge of Sunny Farm
    route: [[15.4, -1.8], [16.2, 3.2]],
    topics: [
      ({ env, tod }) => [tod === 'night' ? 'Shouldn’t you be asleep? Even the chickens are.' : `Good ${tod}! Fine day for the fields.`,
        env.rain ? 'Rain’s good for the corn. Bad for my hair.' : env.snow ? 'Snow on the fields. Nothing to do but read by the fire.' : 'Corn’s coming up nicely.'],
      () => ['Việt says finding fraud is like finding the one bad apple in a crate of thousands.',
        'There’s a whole tree of them at the Data Observatory. Never been. Too many numbers.'],
      () => ['Work hard, then rest. That’s farming.', 'That focus timer in the corner works the same way. Press P and the hourglass on the plaza starts.'],
      () => ['The campfire’s just south-west of here. Logs to sit on, too.', 'Good spot to read. Or to nap. I won’t tell.'],
    ],
  },
  {
    id: 'pip', name: 'Pip', role: 'Traveller', model: 'Rogue', color: '#f2a65a', pitch: 1.15,
    halloween: ['Happy Halloween! The pumpkins around the village light up after dark.', 'Follow the glow and you’ll find every corner of Hearthwood.'],
    // strolls the plaza's north side and east edge (the welcome sign stands by the spawn)
    route: [[-5.8, -0.2], [5.8, -0.2], [5.8, 3.8], [5.8, -0.2]],
    topics: [
      () => ['First time in Hearthwood? Me too, sort of. I just never left.', 'Hold Shift to run and Space to jump. Scroll or pinch to zoom.'],
      () => ['The sky follows your real clock. Press T to skip ahead in time.', 'And the weather changes in the panel up top. Try snow!'],
      () => ['Press C to look like someone else. Could even look like me.', 'M toggles the music. All of it is made up on the spot, by the way.'],
      () => [`This whole village is one of ${PROFILE.fullName}’s projects: three.js, physics and shaders.`, 'Everything else Việt made is in the garden up north. Ask Sir Bram at the gate.'],
    ],
  },
];

const SPEED = 1.1;          // strolling pace
const NEAR = 3.4;           // stop and face the player inside this distance
const TALK_R = 2.1;
const ACTIVE_R = 34;        // farther than this: off screen, skip animation and hide

function bubbleTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#fffaf0';
  g.beginPath(); g.roundRect(8, 8, 112, 64, 28); g.fill();
  g.beginPath(); g.moveTo(48, 70); g.lineTo(64, 90); g.lineTo(72, 70); g.fill();
  g.fillStyle = '#8a6a55';
  for (const x of [40, 64, 88]) { g.beginPath(); g.arc(x, 40, 7, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Villagers {
  constructor(w) {
    this.w = w;
    this.list = [];
    this.talking = null;
    this.frustum = new THREE.Frustum();
    this.projView = new THREE.Matrix4();
    this.sphere = new THREE.Sphere(new THREE.Vector3(), 2.5);
    this.box = new DialogueBox({ onAdvance: () => this.talking && this.advance() });
    const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTexture(), depthWrite: false });
    for (const def of VILLAGERS) {
      const root = new THREE.Group();
      const [x, z] = def.route[0];
      root.position.set(x, 0, z);
      w.scene.add(root);
      const bubble = new THREE.Sprite(bubbleMat);
      bubble.scale.set(0.62, 0.46, 1);
      bubble.position.y = 2.35;
      bubble.visible = false;
      root.add(bubble);
      // a kinematic collider: you bump into villagers instead of walking through them
      const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, shape: new CANNON.Cylinder(0.38, 0.38, 1.6, 8) });
      body.position.set(x, 0.8, z);
      w.world.addBody(body);
      const v = { ...def, root, bubble, body, char: new Character(root, (m) => toon('#ffffff', { map: m.map ?? null, color: m.map ? '#ffffff' : m.color })),
        leg: 1, wait: 1 + Math.random() * 3, face: 0, topic: 0, n: Math.floor(Math.random() * 50), moving: false };
      v.spot = w.addInteractable({ x, z, r: TALK_R, title: `${def.name} · ${def.role}`, sub: 'Enter to talk', action: () => this.talk(v) });
      this.list.push(v);
    }
    // load the models once the world is up, so villagers never slow down the loading screen
    const load = () => this.list.forEach((v, i) => setTimeout(() => v.char.load(v.model, { book: !!v.book, quiet: true })
      .then(() => this.matchPlayer(this.w.charName)).catch(() => {}), i * 150));
    (window.requestIdleCallback ?? setTimeout)(load, { timeout: 2500 });
  }

  /** Whoever wears the same outfit as the player gets washed in their own colour, so you can tell them apart. */
  matchPlayer(model) {
    for (const v of this.list) {
      const tint = v.model === model ? new THREE.Color(v.color).lerp(new THREE.Color('#ffffff'), 0.35) : null;
      v.char.model?.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.baseColor ??= o.material.color.clone();
        o.material.color.copy(o.userData.baseColor);
        if (tint) o.material.color.multiply(tint);
      });
    }
  }

  async talk(v) {
    if (this.talking === v) return this.advance();
    if (this.starting) return;
    this.starting = true;
    const books = await db.allBooks().catch(() => []);
    const last = [...books].sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0];
    const env = this.w.env || {};
    const ctx = { books, last, env, tod: timeOfDay(env.hours ?? 12), fish: this.w.fishing?.stats ?? { total: 0, kinds: 0 }, me: v.root.position, n: v.n++ };
    this.starting = false;
    if (this.w.halloween?.active && v.halloween && !v.saidSpooky) { v.saidSpooky = true; this.lines = v.halloween; }   // seasonal greeting first
    else this.lines = pick(v.topics, v.topic++)(ctx);
    this.line = 0;
    this.talking = v;
    v.char.interact();
    this.box.show(v, this.lines[0], { index: 0, total: this.lines.length });
  }

  advance() {
    if (this.box.typing) return this.box.finish();
    if (++this.line >= this.lines.length) return this.close();
    this.box.show(this.talking, this.lines[this.line], { index: this.line, total: this.lines.length });
  }

  close() {
    if (!this.talking) return;
    const v = this.talking;
    this.talking = null;
    this.box.hide();
    if (this.w.focusedThing === v.spot) this.w.onThingFocus?.(v.spot);   // bring the "Enter to talk" prompt back
  }

  update(dt, player) {
    // skinned meshes can't be frustum-culled by three, so cull villagers ourselves: off screen means
    // no drawing, no shadow and no animation (a generous sphere keeps shadows falling into view)
    const cam = this.w.camera;
    cam.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.projView.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (const v of this.list) {
      const p = v.root.position;
      const dPlayer = Math.hypot(player.x - p.x, player.z - p.z);
      this.sphere.center.set(p.x, 1, p.z);
      const onScreen = dPlayer < ACTIVE_R && this.frustum.intersectsSphere(this.sphere);
      v.root.visible = onScreen;
      if (!onScreen && this.talking !== v) {
        if (dPlayer < ACTIVE_R) this.walk(v, dt, player, dPlayer);   // keep strolling off screen, just don't animate
        continue;
      }
      if (this.talking === v && dPlayer > TALK_R + 1.2) this.close();      // walked away mid-sentence
      this.walk(v, dt, player, dPlayer);
      v.bubble.visible = !this.talking && dPlayer < 7 && dPlayer > 0.5 && !!v.char.model;
      if (v.bubble.visible) v.bubble.position.y = 2.35 + Math.sin(this.w.time * 3 + v.n) * 0.05;
      v.char.update(dt, { moving: v.moving, running: false, air: false, landed: false });
    }
  }

  /** Stroll the route, pausing at each stop; stand still and face the player when they come close. */
  walk(v, dt, player, dPlayer) {
    const p = v.root.position;
    let face = v.face;
    v.moving = false;
    if (dPlayer < NEAR || this.talking === v) {
      face = Math.atan2(player.x - p.x, player.z - p.z);
    } else if ((v.wait -= dt) <= 0) {
      const [tx, tz] = v.route[v.leg];
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) {
        v.leg = (v.leg + 1) % v.route.length;
        v.wait = 1.5 + Math.random() * 4;                                   // linger a bit at each stop
      } else {
        const step = Math.min(d, SPEED * dt);
        p.x += (dx / d) * step; p.z += (dz / d) * step;
        face = Math.atan2(dx, dz);
        v.moving = true;
      }
    }
    v.face = face;
    v.root.rotation.y += ((((face - v.root.rotation.y) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * Math.min(1, dt * 6);
    v.body.position.set(p.x, 0.8, p.z);
    v.spot.x = p.x; v.spot.z = p.z;
  }
}
