import * as THREE from 'three';

// Page shader: in dark mode invert lightness but keep hue (same idea as invert + hue-rotate(180deg)).
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
uniform sampler2D map; uniform float dark; uniform float shade; varying vec2 vUv;
void main(){
  vec3 c = texture2D(map, vUv).rgb;
  if (dark > 0.5) { float L = dot(c, vec3(.299, .587, .114)); c = clamp(c + (1.0 - 2.0 * L), 0.0, 1.0) * 0.84 + 0.07; }
  gl_FragColor = vec4(c * shade, 1.0);
}`;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** An open book on a desk; flipping pages animates a sheet turning over the spine. */
export class Book3DView {
  constructor(container, { numPages, aspect, renderPage }) {
    this.container = container;
    this.num = numPages;
    this.renderPage = renderPage;   // (n) => Promise<canvas>
    this.cache = new Map();
    this.dark = false;
    this.animating = false;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x443322, 1.4));
    const sun = new THREE.DirectionalLight(0xfff0dd, 1.5);
    sun.position.set(-2, 6, 3); sun.castShadow = true;
    this.scene.add(sun);

    const H = (this.H = 1.4), W = (this.W = H * aspect);
    this.desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.7 }));
    this.desk.rotation.x = -Math.PI / 2; this.desk.receiveShadow = true;
    this.scene.add(this.desk);

    const coverM = new THREE.MeshStandardMaterial({ color: 0x7a2e2e, roughness: 0.6 });
    const paperM = new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9 });
    this.paperM = paperM;
    this.covers = [-1, 1].map((s) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.02, H + 0.08), coverM);
      c.position.set((s * (W + 0.05)) / 2, 0.01, 0); c.castShadow = c.receiveShadow = true;
      this.scene.add(c); return c;
    });
    this.stacks = [-1, 1].map((s) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(W, 1, H), paperM);
      b.position.x = (s * W) / 2; b.castShadow = b.receiveShadow = true;
      this.scene.add(b); return b;
    });

    const pageMat = () => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { map: { value: null }, dark: { value: 0 }, shade: { value: 1 } },
    });
    const flatPage = (side) => {
      const g = new THREE.PlaneGeometry(W, H);
      g.rotateX(-Math.PI / 2);
      g.translate((side * W) / 2, 0, 0);
      const m = new THREE.Mesh(g, pageMat());
      this.scene.add(m); return m;
    };
    this.left = flatPage(-1);
    this.right = flatPage(1);

    // the turning sheet: pivot on the spine, front faces up on the right, back faces up once flipped left
    this.sheet = new THREE.Group();
    const fg = new THREE.PlaneGeometry(W, H); fg.rotateX(-Math.PI / 2); fg.translate(W / 2, 0, 0);
    const bg = new THREE.PlaneGeometry(W, H); bg.rotateX(-Math.PI / 2); bg.rotateZ(Math.PI); bg.translate(W / 2, -0.001, 0);
    this.sheetFront = new THREE.Mesh(fg, pageMat());
    this.sheetBack = new THREE.Mesh(bg, pageMat());
    this.sheet.add(this.sheetFront, this.sheetBack);
    this.sheet.visible = false;
    this.scene.add(this.sheet);
    this.pageMeshes = [this.left, this.right, this.sheetFront, this.sheetBack];

    const blank = document.createElement('canvas');
    blank.width = 8; blank.height = 8;
    blank.getContext('2d').fillStyle = '#fbf8f1';
    blank.getContext('2d').fillRect(0, 0, 8, 8);
    this.blank = new THREE.CanvasTexture(blank);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    r.setAnimationLoop(() => this.frame());
  }

  async tex(n) {
    if (n < 1 || n > this.num) return this.blank;
    if (!this.cache.has(n)) {
      this.cache.set(n, this.renderPage(n).then((c) => {
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return t;
      }));
      if (this.cache.size > 14) {           // evict the oldest entry
        const [k, v] = this.cache.entries().next().value;
        this.cache.delete(k); v.then((t) => t.dispose());
      }
    }
    return this.cache.get(n);
  }

  setTex(mesh, t) { mesh.material.uniforms.map.value = t; }

  setStacks(leftPage) {
    const read = THREE.MathUtils.clamp((leftPage - 1) / Math.max(1, this.num - 1), 0, 1);
    const tL = 0.006 + 0.12 * read, tR = 0.006 + 0.12 * (1 - read);
    [[this.stacks[0], this.left, tL], [this.stacks[1], this.right, tR]].forEach(([s, p, t]) => {
      s.scale.y = t; s.position.y = 0.02 + t / 2; p.position.y = 0.021 + t;
    });
    this.sheet.position.y = 0.023 + Math.max(tL, tR);
  }

  /** Show `n` on the left and `n+1` on the right. */
  async show(n) {
    this.page = n;
    const [a, b] = await Promise.all([this.tex(n), this.tex(n + 1)]);
    if (this.page !== n) return;
    this.setTex(this.left, a); this.setTex(this.right, b);
    this.setStacks(n);
    this.tex(n + 2); this.tex(n + 3); this.tex(n - 2); this.tex(n - 1); // prefetch
  }

  async flip(dir, onStart) {
    if (this.animating) return this.page;
    const p = this.page;
    if (dir > 0 && p + 2 > this.num) return p;
    if (dir < 0 && p <= 1) return p;
    if (dir < 0 && p - 2 < 1) { await this.show(1); return 1; }
    this.animating = true;
    const np = p + 2 * dir;
    if (dir > 0) {
      const [f, b, under] = await Promise.all([this.tex(p + 1), this.tex(p + 2), this.tex(p + 3)]);
      this.setTex(this.sheetFront, f); this.setTex(this.sheetBack, b); this.setTex(this.right, under);
    } else {
      const [f, b, under] = await Promise.all([this.tex(p - 1), this.tex(p), this.tex(p - 2)]);
      this.setTex(this.sheetFront, f); this.setTex(this.sheetBack, b); this.setTex(this.left, under);
    }
    this.sheet.visible = true;
    onStart?.();
    const from = dir > 0 ? 0 : Math.PI, to = dir > 0 ? Math.PI : 0;
    await new Promise((res) => { this.anim = { el: 0, dur: 0.75, from, to, res }; });
    this.sheet.visible = false;
    await this.show(np);
    this.animating = false;
    return np;
  }

  setDark(d) {
    this.dark = d;
    for (const m of this.pageMeshes) m.material.uniforms.dark.value = d ? 1 : 0;
    this.scene.background = new THREE.Color(d ? 0x0b0d18 : 0xe9dfcf);
    this.desk.material.color.set(d ? 0x2a1c12 : 0x5b3a22);
    this.paperM.color.set(d ? 0x3a3a40 : 0xefe6d2);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    const cam = this.camera;
    cam.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = Math.max((this.H * 1.6) / (2 * tan), (this.W * 2.4) / (2 * tan * cam.aspect));
    cam.position.set(0, dist * 0.9, dist * 0.45);
    cam.lookAt(0, 0, 0.06);
    cam.updateProjectionMatrix();
  }

  frame() {
    const a = this.anim;
    if (a) {
      a.el += 1 / 60;
      const t = Math.min(a.el / a.dur, 1), e = ease(t);
      this.sheet.rotation.z = a.from + (a.to - a.from) * e;
      const lift = Math.sin(e * Math.PI);
      this.sheetFront.material.uniforms.shade.value = 1 - 0.25 * lift * (this.sheet.rotation.z > Math.PI / 2 ? 0 : 1);
      this.sheetBack.material.uniforms.shade.value = 1 - 0.25 * lift * (this.sheet.rotation.z > Math.PI / 2 ? 1 : 0);
      if (t >= 1) { this.anim = null; a.res(); }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    for (const p of this.cache.values()) p.then((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
