import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Performance helpers: quality presets and merging static decoration into a few draw calls.

export const QUALITY = {
  high: { label: 'High', pixelRatio: 1.75, fps: 60, shadowEvery: 1, shadowMap: 2048, grass: 1, bloom: true },
  balanced: { label: 'Balanced', pixelRatio: 1.25, fps: 60, shadowEvery: 2, shadowMap: 1024, grass: 0.7, bloom: true },
  battery: { label: 'Battery saver', pixelRatio: 1, fps: 30, shadowEvery: 3, shadowMap: 1024, grass: 0.4, bloom: false },
};
export const QUALITY_MODES = { auto: 'Auto', high: 'High', balanced: 'Balanced', battery: 'Battery saver' };

/**
 * Bake every static mesh under `group` into one mesh per material.
 * Hundreds of little fence posts and petals become a handful of draw calls.
 */
export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const merged = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = `${o.material.uuid}|${o.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    buckets.get(key).geos.push(g);
    merged.push(o);
  });
  for (const o of merged) o.removeFromParent();
  for (const { mat, cast, geos } of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    geos.forEach((g) => g.dispose());
  }
  return merged.length;
}
