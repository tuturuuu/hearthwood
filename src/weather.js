import * as THREE from 'three';
import { timeUniform, seeded } from './toon.js';

// All three effects are fixed in world space and wrap around the player in the vertex shader,
// so nothing is updated on the CPU except a couple of uniforms.
const R = 17;
const WRAP = `
uniform vec3 uCenter; uniform float uTime, uAmt;
vec3 wrapAround(vec3 p, float h){
  p.xz = uCenter.xz + mod(p.xz - uCenter.xz + ${R.toFixed(1)}, ${(2 * R).toFixed(1)}) - ${R.toFixed(1)};
  p.y = mod(p.y, h);
  return p;
}`;

const RAIN_VERT = `${WRAP}
attribute vec3 aOff; attribute float aEnd; varying float vA;
void main(){
  vec3 p = aOff;
  p.y -= uTime * 17.0;
  p = wrapAround(p, 13.0);
  p += vec3(0.08, 0.6, 0.03) * aEnd;
  vA = step(fract(aOff.x * 13.17 + aOff.z * 7.31), uAmt);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = `uniform vec3 uColor; varying float vA; void main(){ if (vA < 0.5) discard; gl_FragColor = vec4(uColor, 0.42); }`;

const FLAKE_VERT = `${WRAP}
attribute float aSeed; varying float vA; varying float vSeed;
uniform float uFall, uSize, uSway;
void main(){
  vec3 p = position;
  p.y -= uTime * uFall * (0.7 + aSeed * 0.6);
  p.x += sin(uTime * 0.9 + aSeed * 40.0) * uSway;
  p.z += cos(uTime * 0.7 + aSeed * 23.0) * uSway * 0.6;
  p = wrapAround(p, 12.0);
  vA = step(aSeed, uAmt);
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.7 + aSeed * 0.6) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SNOW_FRAG = `varying float vA; void main(){ if (vA < 0.5) discard;
  float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.15, d) * 0.9); }`;
const LEAF_FRAG = `uniform float uTime; varying float vA; varying float vSeed;
void main(){ if (vA < 0.5) discard;
  float a = uTime * (1.0 + vSeed * 2.0) + vSeed * 30.0;
  vec2 q = gl_PointCoord - 0.5;
  q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
  q.y *= 0.55 + 0.45 * abs(sin(a * 0.7));          // tumbling
  if (length(q * vec2(1.0, 2.2)) > 0.42) discard;
  vec3 c = mix(vec3(0.93, 0.55, 0.22), vec3(0.85, 0.32, 0.22), step(0.55, vSeed));
  c = mix(c, vec3(0.95, 0.78, 0.3), step(0.85, vSeed));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export class Weather {
  constructor(scene) {
    const rnd = seeded(99);
    this.center = { value: new THREE.Vector3() };
    const common = () => ({ uTime: timeUniform, uCenter: this.center, uAmt: { value: 0 } });

    // rain: short line segments
    const N = 2600;
    const off = new Float32Array(N * 6), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = rnd() * 2 * R, y = rnd() * 13, z = rnd() * 2 * R;
      off.set([x, y, z, x, y, z], i * 6);
      end.set([0, 1], i * 2);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    rg.setAttribute('aOff', new THREE.BufferAttribute(off, 3));
    rg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.rainMat = new THREE.ShaderMaterial({ vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false,
      uniforms: { ...common(), uColor: { value: new THREE.Color('#dfeaf2') } } });
    this.rain = new THREE.LineSegments(rg, this.rainMat);

    const flakes = (count, frag, uniforms) => {
      const pos = new Float32Array(count * 3), seed = new Float32Array(count);
      for (let i = 0; i < count; i++) { pos.set([rnd() * 2 * R, rnd() * 12, rnd() * 2 * R], i * 3); seed[i] = rnd(); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const m = new THREE.ShaderMaterial({ vertexShader: FLAKE_VERT, fragmentShader: frag, transparent: true, depthWrite: false,
        uniforms: { ...common(), ...uniforms } });
      return new THREE.Points(g, m);
    };
    this.snow = flakes(1800, SNOW_FRAG, { uFall: { value: 1.3 }, uSize: { value: 70 }, uSway: { value: 0.5 } });
    this.leaves = flakes(260, LEAF_FRAG, { uFall: { value: 0.9 }, uSize: { value: 190 }, uSway: { value: 1.4 } });

    for (const o of [this.rain, this.snow, this.leaves]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
  }

  /** amounts are 0..1 and already eased by the caller */
  update(center, { rain, snow, leaves }) {
    this.center.value.copy(center);
    for (const [obj, amt] of [[this.rain, rain], [this.snow, snow], [this.leaves, leaves]]) {
      obj.material.uniforms.uAmt.value = amt;
      obj.visible = amt > 0.01;
    }
  }
}
