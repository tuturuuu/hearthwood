import * as THREE from 'three';

// 4-step toon ramp shared by every material in the world
export const RAMP = new THREE.DataTexture(new Uint8Array([105, 170, 222, 255]), 4, 1, THREE.RedFormat);
RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
RAMP.needsUpdate = true;

export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...extra });

// shared clock uniform for anything that sways
export const timeUniform = { value: 0 };

/** Make a material sway in the wind (vertex shader patch). Works with InstancedMesh too. */
export function addWind(mat, strength = 0.05) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeUniform;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        mat4 wm = modelMatrix * instanceMatrix;
      #else
        mat4 wm = modelMatrix;
      #endif
      float h = max(position.y, 0.0);
      float sway = (sin(uTime * 1.4 + wm[3].x * 0.35 + wm[3].z * 0.25) + 0.4 * sin(uTime * 3.1 + wm[3].x)) * ${strength.toFixed(3)} * h;
      transformed.x += sway; transformed.z += sway * 0.6;`);
  };
  mat.customProgramCacheKey = () => `wind${strength}`;
  return mat;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function seeded(seed) {
  return () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296;
}
