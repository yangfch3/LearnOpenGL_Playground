// 场景：一台相机（world.js 同一投影公式）、书桌、数学本的每张纸（正反两面各一张动态贴图）、手机、溢出数字层
import * as THREE from "three";
import { G } from "./paper.js";
import { lerp, pagesAt } from "./world.js";
import { drawPage } from "./pages.js";
import { drawPhone, drawFx, phoneAt } from "./pagesA.js";

THREE.ColorManagement.enabled = false; // 颜色原样输出：贴图与材质色都按 sRGB 值直通
export const scene = new THREE.Scene();
export const cam = new THREE.Camera(); cam.matrixAutoUpdate = false;
export function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(1920, 1080, false); r.outputColorSpace = THREE.LinearSRGBColorSpace; r.setClearColor(G.C.desk);
  return r;
}
// 相机：俯仰 0 时正视桌面；w = 1 + k·u（u 为画面中心平面后方的深度），与 world.js project 同式
export function setCamera(c) {
  const a = (c.yaw * Math.PI) / 180, q = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cq = Math.cos(q), sq = Math.sin(q);
  const R = [[ca, sa, 0], [-sa * cq, ca * cq, sq], [sa * sq, -ca * sq, cq]], C = [c.c[0], c.c[1], 0];
  const tv = R.map((r) => -(r[0] * C[0] + r[1] * C[1] + r[2] * C[2]));
  const view = [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, tv[0], tv[1], tv[2], 1];
  const un = Math.max(-90, c.k > 1e-6 ? -0.85 / c.k : -90), uf = 120, hw = (c.hh * 16) / 9;
  const A = (2 + c.k * (uf + un)) / (uf - un), Bc = -(1 + c.k * un) - A * un;
  cam.projectionMatrix.fromArray([1 / hw, 0, 0, 0, 0, 1 / c.hh, 0, 0, 0, 0, -A, -c.k, 0, 0, Bc, 1]);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.matrixWorldInverse.fromArray(view); cam.matrixWorld.copy(cam.matrixWorldInverse).invert();
}

// ---- 书桌：木纹贴图（静态），2-post 时淡成方格大地 ----
function woodTex() {
  const cv = document.createElement("canvas"); cv.width = 2048; cv.height = 1536;
  const c = cv.getContext("2d"); c.fillStyle = G.C.desk; c.fillRect(0, 0, 2048, 1536);
  c.globalAlpha = 0.07; c.strokeStyle = "#2B1D12"; c.lineWidth = 3;
  for (let i = 0; i < 60; i++) { const y = i * 26; c.beginPath(); for (let x = 0; x <= 2048; x += 16) c.lineTo(x, y + 5 * Math.sin(x * 0.01 + i * 1.7) + 2 * Math.sin(x * 0.027 + i)); c.stroke(); }
  // 本子在桌上的影子（光从左上来，影子落向右下）
  c.globalAlpha = 1; c.filter = "blur(10px)"; c.fillStyle = "rgba(25,15,8,0.42)";
  const S = 2048 / 300, X = (x) => (x + 150) * S, Y = (y) => (112.5 - y) * S;
  c.fillRect(X(0.5), Y(30.2), 48 * S, 62 * S);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return { tex: t, left: () => { } };
}
let desk, deskMat, leftShadow, ground, groundMat;
function buildDesk() {
  deskMat = new THREE.MeshBasicMaterial({ map: woodTex().tex, transparent: true });
  desk = new THREE.Mesh(new THREE.PlaneGeometry(300, 225), deskMat); desk.position.z = -0.06; scene.add(desk);
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 640;
  const c = cv.getContext("2d"); c.filter = "blur(12px)"; c.fillStyle = "rgba(25,15,8,0.42)"; c.fillRect(40, 40, 432, 560);
  leftShadow = new THREE.Mesh(new THREE.PlaneGeometry(48 * 512 / 432, 62 * 640 / 560), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  leftShadow.position.set(-24 + 0.5, -0.8, -0.05); scene.add(leftShadow);
  groundMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { a: { value: 0 }, paper: { value: new THREE.Color(G.C.paper) }, grid: { value: new THREE.Color(G.C.grid) } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float a; uniform vec3 paper; uniform vec3 grid; varying vec3 vP;
      float ln(float v, float w){ float d = abs(fract(v + 0.5) - 0.5); return 1.0 - smoothstep(0.0, w * fwidth(v) + 1e-4, d); }
      void main(){ float f = max(0.22 * ln(vP.x, 1.2) , 0.22 * ln(vP.y, 1.2)); float b = max(ln(vP.x / 5.0, 1.0), ln(vP.y / 5.0, 1.0)) * 0.38;
        float m = max(f, b); float fade = 1.0 - smoothstep(90.0, 200.0, length(vP.xy));
        gl_FragColor = vec4(mix(paper, grid, m), a * fade); }`,
  });
  ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat); ground.position.z = -0.055; scene.add(ground);
}

// ---- 纸：每张纸一个组（绕书脊转），正面、背面各一块平面；贴图只画当前看得见的那一块 ----
const VS = "varying vec2 vL; void main(){ vL = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const FS = `uniform sampler2D map; uniform vec4 rect; uniform float side; uniform float shade; uniform vec3 paper; varying vec2 vL;
  void main(){ vec2 P = vec2(side * vL.x, vL.y); vec2 uv = (P - rect.xy) / (rect.zw - rect.xy);
    vec3 c = (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? paper : texture2D(map, uv).rgb; gl_FragColor = vec4(c * shade, 1.0); }`;
const tex = {}; // 页面 id → { cv, ctx, t: CanvasTexture }
function texOf(pid) {
  if (!tex[pid]) { const cv = document.createElement("canvas"); cv.width = 4; cv.height = 4; tex[pid] = { cv, ctx: cv.getContext("2d"), t: new THREE.CanvasTexture(cv) }; }
  return tex[pid];
}
const leaves = [];
function buildLeaves() {
  const geo = new THREE.PlaneGeometry(G.D.pw, G.D.ph); geo.translate(G.D.pw / 2, 0, 0);
  const back = geo.clone(); back.rotateX(Math.PI);
  G.D.leaves.forEach(([f, b], i) => {
    const grp = new THREE.Group(), mk = (g, side) => new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS,
      uniforms: { map: { value: null }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, side: { value: side }, shade: { value: 1 }, paper: { value: new THREE.Color(G.C.paper) } } }));
    const F = mk(geo, 1), Bk = mk(back, -1);
    F.userData.pid = f; Bk.userData.pid = b; grp.add(F, Bk); scene.add(grp); leaves.push({ grp, F, Bk });
  });
}
let phone, phoneTex, fx, fxTex;
function buildPhone() {
  const d = G.D.d0.phone, cv = document.createElement("canvas"), f = 24;
  cv.width = Math.round((d.w + 4) * f); cv.height = Math.round((d.h + 4) * f);
  phoneTex = { cv, ctx: cv.getContext("2d"), t: new THREE.CanvasTexture(cv), map: { f, x0: -(d.w / 2 + 2), y1: d.h / 2 + 2 } };
  phone = new THREE.Mesh(new THREE.PlaneGeometry(d.w + 4, d.h + 4), new THREE.MeshBasicMaterial({ map: phoneTex.t, transparent: true, depthWrite: false }));
  phone.rotation.z = (d.rot * Math.PI) / 180; phone.position.z = 0.6; scene.add(phone);
  const fc = document.createElement("canvas"); fc.width = 1300; fc.height = 1640;
  fxTex = { cv: fc, ctx: fc.getContext("2d"), t: new THREE.CanvasTexture(fc), map: { f: 25, x0: -2, y1: 33 } };
  fx = new THREE.Mesh(new THREE.PlaneGeometry(52, 65.6), new THREE.MeshBasicMaterial({ map: fxTex.t, transparent: true, depthWrite: false }));
  fx.position.set(24, 0.2, 0.7); scene.add(fx);
}
export function build() { buildDesk(); buildLeaves(); buildPhone(); }

// 一张纸面贴图：平视时只画屏幕内那一块、与屏幕像素一一对齐；斜看或翻动时画整页
function paint(pid, t, k, flat, shadows) {
  const T = texOf(pid), R = G.D.prect[pid];
  let f, x0, y1, W, H;
  if (flat) {
    f = 540 / k.hh;
    const vx0 = k.c[0] - 960 / f, vx1 = k.c[0] + 960 / f, vy0 = k.c[1] - 540 / f, vy1 = k.c[1] + 540 / f;
    const a = Math.max(R[0], vx0), b = Math.min(R[2], vx1), lo = Math.max(R[1], vy0), hi = Math.min(R[3], vy1);
    if (a >= b || lo >= hi) return false;
    const X0 = Math.floor(960 + (a - k.c[0]) * f), Y1 = Math.floor(540 - (hi - k.c[1]) * f);
    x0 = k.c[0] + (X0 - 960) / f; y1 = k.c[1] + (540 - Y1) / f;
    W = Math.ceil((b - x0) * f) + 1; H = Math.ceil((y1 - lo) * f) + 1;
  } else {
    f = Math.min(34, (540 / k.hh) * 1.5); x0 = R[0]; y1 = R[3];
    W = Math.ceil((R[2] - R[0]) * f); H = Math.ceil((R[3] - R[1]) * f);
  }
  W = Math.min(W, 4096); H = Math.min(H, 4096);
  if (T.cv.width !== W || T.cv.height !== H) { T.cv.width = W; T.cv.height = H; T.t.dispose(); T.t = new THREE.CanvasTexture(T.cv); }
  T.t.generateMipmaps = !flat; T.t.minFilter = flat ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter; T.t.anisotropy = flat ? 1 : 8;
  G.ctx = T.ctx; G.map = { f, x0, y1 };
  drawPage(pid, t, shadows);
  T.t.needsUpdate = true;
  T.rect = [x0, y1 - H / f, x0 + W / f, y1];
  return true;
}
const zStack = (i, th) => { const n = G.D.leaves.length; return lerp(0.02 * (n - i), 0.02 * (i + 1), th / Math.PI); };
export const pageZ = (pid) => { // 平躺着的这一页的高度（立体内容贴在它上面）
  const i = G.D.leaves.findIndex(([f, b]) => f === pid || b === pid);
  return zStack(i, G.D.leaves[i][0] === pid ? 0 : Math.PI) + 0.002;
};
export function update(t, k, flat) {
  setCamera(k);
  const P = pagesAt(G.D, t);
  const shadows = P.moving.map(([i, th]) => { // 翻动的纸投在两边平躺的纸上
    const z = 48 * Math.sin(th), x = 48 * Math.cos(th), h = zStack(i, th);
    return [[[0, -31], [0, 31], [x + 0.35 * (z + h), 31 - 0.55 * (z + h)], [x + 0.35 * (z + h), -31 - 0.55 * (z + h)]], 0.32 * Math.sin(th)];
  });
  leaves.forEach((L, i) => {
    const th = P.th[i], mv = th > 1e-6 && th < Math.PI - 1e-6;
    L.grp.rotation.y = -th; L.grp.position.z = zStack(i, th); L.grp.updateMatrixWorld(true);
    const fOn = mv || (th <= 1e-6 && L.F.userData.pid === P.right), bOn = mv || (th >= Math.PI - 1e-6 && L.Bk.userData.pid === P.left);
    for (const [m, on] of [[L.F, fOn], [L.Bk, bOn]]) {
      m.visible = on && paint(m.userData.pid, t, k, flat && !mv, mv ? [] : shadows);
      if (!m.visible) continue;
      const T = tex[m.userData.pid];
      m.material.uniforms.map.value = T.t; m.material.uniforms.rect.value.set(...T.rect); m.material.uniforms.shade.value = mv ? 1 - 0.15 * Math.sin(th) : 1;
    }
  });
  leftShadow.material.opacity = Math.min(1, P.th[0] / Math.PI);
  // 手机与溢出的数字
  const d0 = G.D.b.phoneOut;
  phone.visible = t < d0[1] + 0.05;
  if (phone.visible) {
    const p = phoneAt(t); phone.position.x = p[0]; phone.position.y = p[1];
    G.ctx = phoneTex.ctx; G.map = phoneTex.map; G.ctx.reset(); drawPhone(t); phoneTex.t.needsUpdate = true;
  }
  G.ctx = fxTex.ctx; G.map = fxTex.map; G.ctx.reset();
  fx.visible = drawFx(t); if (fx.visible) fxTex.t.needsUpdate = true;
}
export function setGround(a) { deskMat.opacity = 1 - a; groundMat.uniforms.a.value = a; desk.visible = a < 0.999; ground.visible = a > 0.001; }
