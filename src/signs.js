import * as THREE from 'three';
import { toon, canvasTexture } from './toon.js';

// Chunky oak-plank signs (a little Minecraft, a little farmhouse) used across the village.
export const INK = '#2e1f12';

/** Paint an oak-plank board with seams, grain, nails and a darker frame. */
export function paintPlanks(g, w, h, rows = 4) {
  const ph = h / rows;
  for (let i = 0; i < rows; i++) {
    const shade = [0, 10, -6, 6][i % 4];
    g.fillStyle = `hsl(34, 44%, ${68 + shade * 0.25}%)`;
    g.fillRect(0, i * ph, w, ph);
    // wood grain
    g.strokeStyle = 'rgba(110, 70, 30, 0.1)'; g.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      const y = i * ph + 10 + Math.random() * (ph - 20);
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 12, w * 0.7, y + (Math.random() - 0.5) * 12, w, y + (Math.random() - 0.5) * 8);
      g.stroke();
    }
    // a knot here and there
    if (Math.random() < 0.3) {
      g.fillStyle = 'rgba(110, 70, 30, 0.14)';
      g.beginPath(); g.ellipse(80 + Math.random() * (w - 160), i * ph + ph / 2, 16, 8, 0, 0, 7); g.fill();
    }
    // seam
    g.fillStyle = 'rgba(70, 42, 20, 0.3)';
    g.fillRect(0, (i + 1) * ph - 3, w, 3);
    // nails
    g.fillStyle = '#5a4636';
    for (const x of [26, w - 26]) { g.beginPath(); g.arc(x, i * ph + ph / 2, 5, 0, 7); g.fill(); }
  }
  // frame
  g.strokeStyle = '#6b4526'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
}

export function wrapLines(g, text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const word of words) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A sign on a square post. `draw(g, w, h)` paints the text on top of the planks.
 * Returns a Group whose origin sits on the ground under the post.
 */
export function woodSign({ width = 2.6, height = 1.6, post = 1.1, lean = -0.5, px = 1024, draw, twoPosts = false }) {
  const tex = canvasTexture(px, Math.round((px * height) / width), (g, w, h) => { paintPlanks(g, w, h); draw(g, w, h); });
  const edge = toon('#7a5230'), postMat = toon('#6b4526');
  const g = new THREE.Group();
  // a little self-lit so the lettering stays readable however the board is angled to the sun
  const face = new THREE.MeshToonMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.14), [edge, edge, edge, edge, face, edge]);
  board.position.y = post + height / 2 - 0.1;
  board.rotation.x = lean;
  g.add(board);
  for (const x of twoPosts ? [-width / 2 + 0.25, width / 2 - 0.25] : [0]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, post + 0.25, 0.16), postMat);
    p.position.set(x, (post + 0.25) / 2, -0.12);
    g.add(p);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
