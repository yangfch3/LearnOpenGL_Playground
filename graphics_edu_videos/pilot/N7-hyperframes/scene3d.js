// 立体内容：1d 三个平面交于一点（立在 p2 上）、2g 被 3×3 矩阵扭动的立方格（p10）、2-post 方格大地上的楼
import * as THREE from "three";
import { LineSegments2 } from "./assets/shared/vendor/three/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "./assets/shared/vendor/three/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "./assets/shared/vendor/three/lines/LineMaterial.js";
import { G } from "./paper.js";
import { seg, E, lerp, tr, pagesAt } from "./world.js";
import { scene, pageZ } from "./scene.js";
import { HL } from "./annot.js";

function lines(color, px, opacity = 1) {
  const m = new LineMaterial({ color, linewidth: px, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  m.resolution.set(1920, 1080);
  const o = new LineSegments2(new LineSegmentsGeometry(), m); o.frustumCulled = false; scene.add(o);
  return { o, m, set(arr) { o.visible = arr.length > 0; if (arr.length) { o.geometry.dispose(); o.geometry = new LineSegmentsGeometry(); o.geometry.setPositions(arr); } } };
}
function sprite(text, size, color, font = '"WenKai"') {
  const cv = document.createElement("canvas"), c = cv.getContext("2d"), px = 96;
  c.font = `${px}px ${font}`; const w = Math.ceil(c.measureText(text).width) + 16;
  cv.width = w; cv.height = px * 1.4; c.font = `${px}px ${font}`; c.fillStyle = color; c.textBaseline = "middle"; c.fillText(text, 8, cv.height / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  s.scale.set((size * w) / px, size * 1.4, 1); s.center.set(0, 0.5); scene.add(s); return s;
}
const fan = (n) => { const idx = []; for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1); return idx; };
function polyMesh(n, color, opacity) {
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setIndex(fan(n));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.frustumCulled = false; scene.add(m); return m;
}
const setPoly = (m, pts) => { const a = m.geometry.attributes.position; pts.forEach((p, i) => a.setXYZ(i, ...p)); a.needsUpdate = true; };
// 这一页看得见：平躺在最上面，或它所在的那张纸正在翻
const onPage = (D, t, pid) => {
  const P = pagesAt(D, t);
  return P.left === pid || P.right === pid || P.moving.some(([i]) => D.leaves[i].includes(pid));
};

// ---- 1d ----
let Q;
function build1d() {
  const d = G.D.d1d, C = G.C;
  Q = { axes: [lines(C.chick, 3), lines(C.rabbit, 3), lines(C.fly, 3)], planes: d.planes.map((p) => polyMesh(p.pts.length, C[p.col], 0.3)),
    edges: d.planes.map((p) => lines(C[p.col], 2.5)), drop: lines(C.red, 2, 0.7), pt: new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), new THREE.MeshBasicMaterial({ color: C.red })),
    zl: sprite(G.T["p.zf"], 2.0, C.flyT), pl: sprite("(5, 3, 4)", 1.9, C.redT, '"KMain"') };
  scene.add(Q.pt);
}
function axesSet(o, s, z0, n, pop, u, A) { // 三根轴（各带一个小箭头）：x、y 在纸上按 u 画出，z 随 pop 立起
  const W = (x, y, z) => [o[0] + x * s, o[1] + y * s, z0 + z * s * pop], L = n + 1.2;
  const tips = [[L * u, 0, 0], [0, L * u, 0], [0, 0, L]];
  tips.forEach((tp, i) => {
    const a = W(0, 0, 0), b = W(...tp), dir = [0, 1, 2].map((k) => (k === i ? 1 : 0)), side = i === 2 ? [1, 0, 0] : [0, 0, 1];
    const h = 0.8, q1 = W(...tp.map((v, k) => v - dir[k] * h + side[k] * h * 0.5)), q2 = W(...tp.map((v, k) => v - dir[k] * h - side[k] * h * 0.5));
    A[i].set((i === 2 && pop < 0.02) || (i < 2 && u <= 0) ? [] : [...a, ...b, ...q1, ...b, ...q2, ...b]);
  });
  return W;
}
function update1d(t) {
  const D = G.D, d = D.d1d, b = D.b, pop = tr(D, "pop1d", t), u = seg(t, b.axes1d[0], b.axes1d[1], E.lin), vis = t >= b.axes1d[0] && onPage(D, t, "p2");
  const all = [...Q.axes.map((a) => a.o), ...Q.planes, ...Q.edges.map((a) => a.o), Q.drop.o, Q.pt, Q.zl, Q.pl];
  if (!vis) { all.forEach((o) => (o.visible = false)); return; }
  const glow = tr(D, "dim", t), W = axesSet(d.o, d.s, pageZ("p2") + 0.01, d.n, Math.max(pop, 0.001), u, Q.axes);
  d.planes.forEach((p, i) => {
    const g = tr(D, `pl${i}`, t), pts = p.pts.map((v) => W(...v.map((x, k) => d.sol[k] + (x - d.sol[k]) * g)));
    Q.planes[i].visible = g > 0.001; Q.planes[i].material.opacity = 0.28 + 0.2 * glow;
    if (g > 0.001) setPoly(Q.planes[i], pts);
    Q.edges[i].set(g > 0.001 ? pts.flatMap((q, k) => [...q, ...pts[(k + 1) % pts.length]]) : []); Q.edges[i].m.linewidth = 2.5 + 3 * glow;
  });
  const pa = tr(D, "pt1d", t), S = d.sol, P = W(...S);
  Q.pt.visible = pa > 0.01; Q.pt.position.set(...P); Q.pt.scale.setScalar(Math.max(0.01, pa));
  Q.drop.set(pa > 0.01 ? [...P, ...W(S[0], S[1], 0), ...W(S[0], S[1], 0), ...W(S[0], 0, 0), ...W(S[0], S[1], 0), ...W(0, S[1], 0)] : []);
  Q.zl.visible = pop > 0.05; Q.zl.material.opacity = pop; Q.zl.position.set(...W(0.4, 0, d.n + 1.6));
  Q.pl.visible = pa > 0.01; Q.pl.material.opacity = pa; Q.pl.position.set(P[0] + 0.8, P[1], P[2] + 0.9);
}

// ---- 2g：立方格被 M(u) = I + u(A − I) 扭成斜的平行六面体格 ----
let K3;
function build2g() {
  const C = G.C;
  K3 = { axes: [lines(C.chick, 3), lines(C.rabbit, 3), lines(C.fly, 3)], lat: [lines(C.chick, 2.4, 0.85), lines(C.rabbit, 2.4, 0.85), lines(C.fly, 2.4, 0.85)],
    faces: polyMesh(36, C.ink, 0.07), xl: sprite(G.T["p.xc"], 2.0, C.chickT), yl: sprite(G.T["p.yr"], 2.0, C.rabbitT), zl: sprite(G.T["p.zf"], 2.0, C.flyT) };
  K3.faces.geometry.setIndex(null);
}
function update2g(t) {
  const D = G.D, d = D.d2g, b = D.b, pop = tr(D, "pop2g", t), la = tr(D, "lat3", t), on = d && t >= b.axes2g[0] && onPage(D, t, "p10") && (pop > 0.001 || la > 0.001);
  const all = [...K3.axes.map((a) => a.o), ...K3.lat.map((a) => a.o), K3.faces, K3.xl, K3.yl, K3.zl];
  if (!on) { all.forEach((o) => (o.visible = false)); return; }
  const u = seg(t, b.axes2g[0], b.axes2g[1], E.lin), W = axesSet(d.o, d.s, pageZ("p10") + 0.01, 13, Math.max(pop, 0.001), u, K3.axes);
  const w3 = tr(D, "u3", t), M = d.A.map((r, i) => r.map((v, j) => lerp(i === j ? 1 : 0, v, w3)));
  const T = (p) => W(...M.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2])), n = d.n, st = n / d.cells, cs = [];
  for (let i = 0; i <= d.cells; i++) cs.push(i * st);
  for (let ax = 0; ax < 3; ax++) {
    const arr = [];
    for (const p of cs) for (const q of cs) { const a = [0, 0, 0], e = [0, 0, 0]; const o1 = (ax + 1) % 3, o2 = (ax + 2) % 3; a[o1] = e[o1] = p; a[o2] = e[o2] = q; e[ax] = n; arr.push(...T(a), ...T(e)); }
    K3.lat[ax].set(la > 0.01 ? arr : []); K3.lat[ax].m.opacity = 0.85 * la;
  }
  const V = (x, y, z) => T([x * n, y * n, z * n]), F = [[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]];
  const tri = []; for (const f of F) { const q = f.map((p) => V(...p)); tri.push(q[0], q[1], q[2], q[0], q[2], q[3]); }
  K3.faces.visible = la > 0.01; K3.faces.material.opacity = 0.08 * la; setPoly(K3.faces, tri);
  K3.xl.visible = u > 0.9; K3.xl.position.set(...W(14.6, 0, 0));
  K3.yl.visible = u > 0.9; K3.yl.position.set(...W(0.6, 14.6, 0));
  K3.zl.visible = pop > 0.05; K3.zl.material.opacity = pop; K3.zl.position.set(...W(0.4, 0, 14.6));
}

// ---- 2-post：白色纸楼从方格里长出来，三栋亮起 ----
let BL;
// 楼牌：手写体加粗（同色描边加粗笔画）
function labelTex(text) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 240;
  const c = cv.getContext("2d"); let px = 168; c.font = `${px}px "WenKai"`;
  const w = c.measureText(text).width; if (w > 470) { px = Math.floor(px * 470 / w); c.font = `${px}px "WenKai"`; }
  c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = c.strokeStyle = G.C.hand; c.lineWidth = px * 0.07; c.lineJoin = "round";
  c.strokeText(text, 256, 124); c.fillText(text, 256, 124);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return t;
}
// 地基大字「矩阵」：红字 + 荧光笔底，u = 0..1 自左向右写出
let WORD;
function drawWord(u) {
  const { cv, c } = WORD, W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H); if (u <= 0) return;
  c.save(); c.beginPath(); c.rect(0, 0, W * u, H); c.clip();
  c.globalAlpha = 0.55; c.fillStyle = HL; c.fillRect(W * 0.04, H * 0.42, W * 0.92, H * 0.42); c.globalAlpha = 1;
  c.font = `${Math.round(H * 0.78)}px "WenKai"`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = c.strokeStyle = G.C.red;
  c.lineWidth = H * 0.05; c.lineJoin = "round"; c.letterSpacing = `${Math.round(H * 0.25)}px`;
  c.strokeText(G.T["p.matw"], W / 2 + H * 0.125, H * 0.54); c.fillText(G.T["p.matw"], W / 2 + H * 0.125, H * 0.54); c.restore();
}
function build2p() {
  BL = (G.D.d2p?.blds || []).map((bd) => {
    const grp = new THREE.Group(), cols = ["#E4DED2", "#EFEAE0", "#E9E3D7", "#F3EFE6", "#FFFFFF", "#DDD6C9"];
    const mats = cols.map((c) => new THREE.MeshBasicMaterial({ color: c }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(bd.w, bd.d, bd.h).translate(0, 0, bd.h / 2), mats);
    const lw_ = bd.w * 0.96, lh = Math.min(lw_ * 240 / 512, bd.h * 0.5);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(lh * 512 / 240, lh), new THREE.MeshBasicMaterial({ map: labelTex(G.T[bd.key]), transparent: true }));
    lab.rotation.x = Math.PI / 2; lab.position.set(0, -bd.d / 2 - 0.03, Math.min(bd.h * 0.68, bd.h - lh * 0.6));
    grp.add(box, lab); grp.position.set(bd.x, bd.y, 0.15); scene.add(grp);
    const eg = new THREE.EdgesGeometry(box.geometry), ed = lines(G.C.pencil, 2.2), sh = polyMesh(8, "#2B1D12", 0.16);
    return { bd, grp, mats, cols, ed, eg: eg.attributes.position.array, sh };
  });
  const wd = G.D.d2p?.word; if (!wd) return;
  const cv = document.createElement("canvas"); cv.width = 1600; cv.height = Math.round(1600 * wd.d / wd.w);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wd.w, wd.d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.position.set(wd.c[0], wd.c[1], 0.17); mesh.visible = false; scene.add(mesh);
  WORD = { cv, c: cv.getContext("2d"), tex, mesh, u: -1 };
}
function hull(P) { // 单调链凸包
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function update2p(t) {
  const D = G.D, lit = tr(D, "lit", t);
  if (WORD) {
    const [w0, w1] = D.d2p.word.t, u = seg(t, w0, w1, E.lin);
    WORD.mesh.visible = u > 0;
    if (u !== WORD.u) { drawWord(u); WORD.tex.needsUpdate = true; WORD.u = u; }
  }
  for (const B of BL) {
    const { bd } = B, g = seg(t, bd.t[0], bd.t[1], E.o3);
    B.grp.visible = g > 0.001; B.grp.scale.z = Math.max(g, 0.001);
    if (!B.grp.visible) { B.ed.set([]); B.sh.visible = false; continue; }
    if (bd.lit) for (const k of [3, 4]) B.mats[k].color.set(B.cols[k]).lerp(new THREE.Color(k === 3 ? "#F6D98E" : "#FBE7B0"), lit);
    const arr = []; for (let i = 0; i < B.eg.length; i += 3) arr.push(bd.x + B.eg[i], bd.y + B.eg[i + 1], 0.15 + B.eg[i + 2] * g);
    B.ed.set(arr);
    const H = bd.h * g, foot = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [bd.x + sx * bd.w / 2, bd.y + sy * bd.d / 2]);
    const hl = hull(foot.concat(foot.map((p) => [p[0] + 0.35 * H, p[1] - 0.55 * H])));
    B.sh.visible = true; const pts = hl.map((p) => [p[0], p[1], 0.155]); while (pts.length < 8) pts.push(pts[pts.length - 1]); setPoly(B.sh, pts.slice(0, 8));
  }
}
export function build3d() { build1d(); build2g(); build2p(); }
export function update3d(t) { update1d(t); update2g(t); update2p(t); }
