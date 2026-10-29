// 管线：场景 → 2048×1152 MSAA 目标（mip 链即逐级 2×2 盒式平均，第 7 级恰为 16×9）→ 分辨率 / 调色板 / 角色优先着色 → 画布
import * as THREE from "three";

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tCol, tMask;
uniform vec4 uTr;        // lo, hi, dir, 进度（单一状态时 lo = 当前 N，进度 = -1）
uniform float uDur, uQ, uBlink, uPalN, uTileP, uTileDur, uOverlay;
uniform vec2 uO;
uniform vec3 uPal[64], uChar[3];
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 gridOf(float N) { return vec2(N, N * 0.5625); }
vec3 cellColor(float N, vec2 uv) {
  if (N < 1.0) return toSRGB(textureLod(tCol, uv, 0.0).rgb);
  vec2 g = gridOf(N), cell = floor(uv * g), c = (cell + 0.5) / g;
  float L = log2(2048.0 / N);
  vec3 col = toSRGB(textureLod(tCol, c, L).rgb);
  if (uQ <= 0.0) return col;
  vec3 best = col; float bd = 1e9;
  for (int i = 0; i < 64; i++) { if (float(i) >= uPalN) break; vec3 d = uPal[i] - col; float e = dot(d, d); if (e < bd) { bd = e; best = uPal[i]; } }
  vec3 q = best;
  vec3 m = textureLod(tMask, c, L).rgb; float th = 0.05;
  float mx = max(m.r, max(m.g, m.b));
  if (mx > th) {
    int k = m.r >= mx ? 0 : (m.g >= mx ? 1 : 2);
    q = uChar[k];
    if (k == 0 && uBlink > 0.0) {             // 眨眼：主角最上面一格的「眼皮」自上而下合上
      float up = textureLod(tMask, c + vec2(0.0, 1.0 / g.y), L).r;
      float fy = fract(uv.y * g.y);
      if (up < th && 1.0 - fy < uBlink) q *= 0.32;
    }
  }
  return mix(col, q, uQ);
}
float maxR(vec2 o) { vec2 a = vec2(16.0 / 9.0, 1.0); return max(max(length((vec2(0) - o) * a), length((vec2(1, 0) - o) * a)), max(length((vec2(0, 1) - o) * a), length((vec2(1) - o) * a))); }
float lineAt(vec2 uv, vec2 g, float px) { vec2 e = fract(uv * g), s = vec2(1920.0, 1080.0) / g; vec2 d = min(e, 1.0 - e) * s; return step(min(d.x, d.y), px); }
void main() {
  vec2 uv = vUv; vec3 col;
  float lo = uTr.x, hi = uTr.y, dir = uTr.z, p = uTr.w;
  if (p < 0.0) col = cellColor(lo, uv);
  else {
    vec2 gl = gridOf(lo), cLo = (floor(uv * gl) + 0.5) / gl;
    float R = maxR(uO), d = length((cLo - uO) * vec2(16.0 / 9.0, 1.0)) / R;
    float ts = dir > 0.0 ? d : 1.0 - d, age = (p - ts) * uDur;
    bool useHi = dir > 0.0 ? p >= ts : p < ts;
    col = cellColor(useHi ? hi : lo, uv);
    float px = 1920.0 / (dir > 0.0 ? (hi < 1.0 ? 1920.0 : hi) : lo);
    if (age >= 0.0 && age < 0.3 && px >= 6.0) {
      float k = 1.0 - age / 0.3;
      float ln = dir > 0.0 ? (hi < 1.0 ? lineAt(uv, gl, 1.2) : lineAt(uv, gridOf(hi), 1.2)) : lineAt(uv, gl, 1.5);
      col = mix(col * (1.0 + 0.07 * k), col * 0.72, ln * k);
    }
  }
  if (uTileP >= 0.0) {                         // 结尾：16×9 逐格揭开，色块留作半透明叠层
    vec2 g = gridOf(16.0), cell = floor(uv * g), c = (cell + 0.5) / g;
    float o = 0.75 * length((c - uO) * vec2(16.0 / 9.0, 1.0)) / maxR(uO) + 0.25 * hash(cell);
    float a = clamp((uTileP - o) * uTileDur / 0.3, 0.0, 1.0);
    vec3 full = cellColor(0.0, uv), rev = mix(full, col, uOverlay);
    rev = mix(rev, vec3(1.0), 0.45 * uOverlay * lineAt(uv, g, 1.5));
    col = mix(col, rev, a);
  }
  outColor = vec4(col, 1.0);
}`;
const VERT = /* glsl */ `in vec3 position; in vec2 uv; out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function makePipeline(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const rtOpts = { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter };
  const rtCol = new THREE.WebGLRenderTarget(2048, 1152, { ...rtOpts, samples: 4 });
  const rtMask = new THREE.WebGLRenderTarget(2048, 1152, { ...rtOpts, type: THREE.UnsignedByteType });
  const cam = new THREE.Camera(); cam.matrixAutoUpdate = false;
  const U = {
    tCol: { value: rtCol.texture }, tMask: { value: rtMask.texture }, uTr: { value: new THREE.Vector4(16, 16, 1, -1) }, uDur: { value: 1 },
    uQ: { value: 1 }, uBlink: { value: 0 }, uPalN: { value: 0 }, uTileP: { value: -1 }, uTileDur: { value: 1 }, uOverlay: { value: 0 },
    uO: { value: new THREE.Vector2(0.2, 0.3) }, uPal: { value: Array.from({ length: 64 }, () => new THREE.Vector3()) },
    uChar: { value: [0, 1, 2].map(() => new THREE.Vector3()) },
  };
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms: U, depthTest: false }));
  const postScene = new THREE.Scene(); postScene.add(post); post.frustumCulled = false;
  const maskMats = ["#000000", "#ff0000", "#00ff00", "#0000ff"].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const black = new THREE.Color(0, 0, 0);
  const srgb = (c) => { const o = c.clone().convertLinearToSRGB(); return new THREE.Vector3(o.r, o.g, o.b); };
  function setCamera(m) {
    cam.projectionMatrix.fromArray(m.proj); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.matrix.fromArray(m.view).invert(); cam.matrixWorld.copy(cam.matrix); cam.matrixWorldInverse.fromArray(m.view);
  }
  // st：{ view, proj, tr: [lo, hi, dir, p], dur, quant, blink, palette: [Color], chars: [Color×3], origin: [u, v], tileP, tileDur, overlay }
  function render(scene, st) {
    setCamera(st);
    renderer.shadowMap.autoUpdate = true;
    renderer.setRenderTarget(rtCol); renderer.render(scene, cam);
    if (st.quant > 0) {
      const saved = [], bg = scene.background, fog = scene.fog;
      scene.traverse((o) => { if (o.isMesh) { saved.push([o, o.material]); o.material = maskMats[o.userData.mask || 0]; } });
      scene.background = black; scene.fog = null; renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rtMask); renderer.render(scene, cam);
      for (const [o, m] of saved) o.material = m;
      scene.background = bg; scene.fog = fog;
    }
    U.uTr.value.set(...st.tr); U.uDur.value = st.dur; U.uQ.value = st.quant; U.uBlink.value = st.blink;
    st.palette.slice(0, 64).forEach((c, i) => U.uPal.value[i].copy(srgb(c))); U.uPalN.value = Math.min(64, st.palette.length);
    st.chars.forEach((c, i) => U.uChar.value[i].copy(srgb(c)));
    U.uO.value.set(...st.origin); U.uTileP.value = st.tileP; U.uTileDur.value = st.tileDur; U.uOverlay.value = st.overlay;
    renderer.setRenderTarget(null); renderer.render(postScene, cam);
  }
  return { renderer, render };
}
