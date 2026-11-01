// 第 4 章：笔记本。两本书换个顺序翻转结果不同 → 矩阵先转再推 ≠ 先推再转 → 海森堡的数表 → xp − px = iħ
import { G, COL, txt, line, dot, ring, rod, ga, visible, shadow } from "./draw.js";
import { seg, win, E, lerp, mv } from "./world.js";

const GR = "#3B3F46", RED = COL.red;
const Rx = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Rz = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const ap = (M, p) => M.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);
// 一本书：x 宽 2.4、y 高 3.2、z 厚 0.6；+z 是封面
const BX = [1.2, 1.6, 0.3];
const FACES = [ // [法向, 四角, 颜色, 画细节]
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], "#2F5C8A", "cover"], [[0, 0, -1], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]], "#24476B", ""],
  [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], "#1D3653", "spine"], [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], "#EFE7D2", "pages"],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], "#EFE7D2", "pages"], [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], "#EFE7D2", "pages"],
];
function book(R, cx, cy, a) {
  if (a <= 0.01) return;
  const TL = 0.62, ct = Math.cos(TL), st = Math.sin(TL), tilt = (q) => [q[0], q[1] * ct + q[2] * st, q[2] * ct - q[1] * st]; // 斜俯视，书的立体感读得出
  const c = G.ctx, P = (v) => { const q = tilt(ap(R, [v[0] * BX[0], v[1] * BX[1], v[2] * BX[2]])), w = 1 - 0.05 * q[2]; return [cx + q[0] / w, cy - q[1] / w, q[2]]; };
  const vis = FACES.map((f) => [tilt(ap(R, f[0])), f]).filter(([n]) => n[2] > 1e-3).sort((p, q) => p[0][2] - q[0][2]);
  ga(a * 0.18); c.fillStyle = "#2A1E10"; c.beginPath(); c.ellipse(cx + 0.2, cy + 1.6, 1.5, 0.5, 0, 0, 2 * Math.PI); c.fill(); ga(a);
  for (const [n, [, q, col, kind]] of vis) {
    const pts = q.map(P), sh = 0.75 + 0.25 * n[2];
    c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); c.fill();
    c.fillStyle = `rgba(0,0,0,${(1 - sh).toFixed(3)})`; c.fill();
    const L = (u, v) => [lerp(lerp(pts[0][0], pts[1][0], u), lerp(pts[3][0], pts[2][0], u), v), lerp(lerp(pts[0][1], pts[1][1], u), lerp(pts[3][1], pts[2][1], u), v)];
    if (kind === "cover") { c.fillStyle = "#E8C46A"; c.beginPath(); for (const [u, v] of [[0.15, 0.7], [0.85, 0.7], [0.85, 0.8], [0.15, 0.8]]) c.lineTo(...L(u, v)); c.fill(); dot(L(0.5, 0.42), 0.32 * sh, "#E8C46A"); }
    if (kind === "spine") for (const v of [0.2, 0.8]) line([L(0.15, v), L(0.85, v)], 0.08, "#E8C46A");
    if (kind === "pages") for (let k = 1; k < 6; k++) line([L(0.05, k / 6), L(0.95, k / 6)], 0.015, "rgba(120,100,70,0.45)");
  }
  ga(1);
}
const F = [[[0, 0], [0, 2]], [[0, 2], [1.2, 2]], [[0, 1.1], [0.8, 1.1]]];
function shapeF(M, o, col, a, g = 0.9) {
  if (a <= 0.01) return;
  ga(a); for (const [p, q] of F) { const P = mv(M, p), Q = mv(M, q); rod([o[0] + P[0] * g, o[1] - P[1] * g], [o[0] + Q[0] * g, o[1] - Q[1] * g], 0.13, col, false); } ga(1);
}

const TA = [[0, 1, 0], [1, 0, 2], [0, 2, 0]], TB = [[0, -1, 0], [1, 0, -2], [0, 2, 0]]; // 示意的两张「数表」
function table(M, x, y, a, hi, col = GR) {
  if (a <= 0.01) return;
  ga(a); G.ctx.strokeStyle = col; G.ctx.lineWidth = 0.04;
  for (const sx of [-1, 1]) line([[x + sx * 1.35 - sx * 0.15, y - 1.05], [x + sx * 1.35, y - 1.05], [x + sx * 1.35, y + 1.05], [x + sx * 1.35 - sx * 0.15, y + 1.05]], 0.04, col);
  ga(1);
  M.forEach((r, i) => r.forEach((v, j) => txt(String(v), x + (j - 1) * 0.82, y + (i - 1) * 0.68, 0.42, hi && hi[i][j] ? RED : col, { font: '"JBM"', weight: 600, alpha: a })));
}
export function draw(t) {
  if (!visible([103, 3.4, 121, 15])) return;
  const B = G.D.b, Q = G.D.heis, T = G.T, h = Math.PI / 2;
  const L0 = [107.5, 9.2], R0 = [116.5, 9.2];
  // 两本书
  const bo = seg(t, B.booksOut, B.booksOut + 0.6, E.i2), ba = seg(t, B.booksIn, B.booksIn + 0.5, E.o3) * (1 - bo);
  if (ba > 0.01) {
    const [a0, a1, a2] = B.bookA, [b0, b1, b2] = B.bookB, dy = -6 * bo + 1.5 * (1 - seg(t, B.booksIn, B.booksIn + 0.5, E.o3));
    const ax = h * seg(t, a0, a1, E.io2), az = -h * seg(t, a1, a2, E.io2), bz = -h * seg(t, b0, b1, E.io2), bx = h * seg(t, b1, b2, E.io2);
    book(mm(Rz(az), Rx(ax)), L0[0], L0[1] + dy, ba); book(mm(Rx(bx), Rz(bz)), R0[0], R0[1] + dy, ba);
    txt(T.bookA, L0[0], 4.3, 0.46, GR, { weight: 700, alpha: ba * seg(t, a0, a0 + 0.3, E.sine) });
    txt(T.bookB, R0[0], 4.3, 0.46, GR, { weight: 700, alpha: ba * seg(t, b0, b0 + 0.3, E.sine) });
    txt("≠", 112, 9.2, 1.4, RED, { weight: 700, alpha: ba * seg(t, B.booksCmp, B.booksCmp + 0.3, E.o3) });
  }
  // 两页：先转再推 / 先推再转
  const [p0, p1, p2, p3, p4] = B.pages, pf = 1 - seg(t, B.spectra[0] - 0.4, B.spectra[0], E.sine), pa = seg(t, p0, p0 + 0.4, E.sine) * pf;
  if (pa > 0.01) {
    const I = [[1, 0], [0, 1]], lerpM = (A, Bm, u) => A.map((r, i) => r.map((v, j) => lerp(v, Bm[i][j], u)));
    const mulM = (A, Bm) => [[A[0][0] * Bm[0][0] + A[0][1] * Bm[1][0], A[0][0] * Bm[0][1] + A[0][1] * Bm[1][1]], [A[1][0] * Bm[0][0] + A[1][1] * Bm[1][0], A[1][0] * Bm[0][1] + A[1][1] * Bm[1][1]]];
    const rotA = (u) => { const a = h * u; return [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]]; };
    const ML = mulM(lerpM(I, Q.shr, seg(t, p2, p2 + 0.9, E.io2)), rotA(seg(t, p1, p1 + 0.9, E.io2)));
    const MR = mulM(rotA(seg(t, p4, p4 + 0.9, E.io2)), lerpM(I, Q.shr, seg(t, p3, p3 + 0.9, E.io2)));
    const oL = [L0[0] + 0.3, 10.4], oR = [R0[0] + 0.3, 10.4];
    for (const o of [oL, oR]) { ga(pa * 0.5); line([[o[0] - 3.2, o[1]], [o[0] + 3.2, o[1]]], 0.03, GR); line([[o[0], o[1] + 0.8], [o[0], o[1] - 4.8]], 0.03, GR); ga(1); }
    shapeF([[1, 0], [0, 1]], oL, "rgba(59,63,70,0.25)", pa); shapeF([[1, 0], [0, 1]], oR, "rgba(59,63,70,0.25)", pa);
    shapeF(ML, oL, RED, pa); shapeF(MR, oR, GR, pa);
    txt(T.rotThen, L0[0], 4.3, 0.46, RED, { weight: 700, alpha: pa }); txt(T.pushThen, R0[0], 4.3, 0.46, GR, { weight: 700, alpha: pa });
    txt("≠", 112, 8.6, 1.4, RED, { weight: 700, alpha: pa * seg(t, p4 + 1.0, p4 + 1.3, E.o3) });
  }
  // 海森堡的数表：两张表相乘，顺序一换结果就变
  const sa = win(t, B.spectra[0], B.formula[0], 0.5, 0.5);
  if (sa > 0.01) {
    const c = G.ctx; ga(sa); c.fillStyle = "#23262C"; c.fillRect(104.2, 5.0, 6.8, 1.0); ga(1);
    [0.8, 2.3, 3.4, 4.0, 4.4, 4.6].forEach((x, k) => { ga(sa * seg(t, B.spectra[0] + k * 0.12, B.spectra[0] + k * 0.12 + 0.2, E.sine)); line([[104.2 + x, 5.05], [104.2 + x, 5.95]], 0.07, ["#E8584A", "#59C2E0", "#6C7BE8", "#9B6CE8", "#9B6CE8", "#9B6CE8"][k]); ga(1); });
    table(TA, 107.6, 8.4, sa * seg(t, B.spectra[1], B.spectra[1] + 0.4, E.sine));
    const AB = TA.map((r) => TB[0].map((_, j) => r.reduce((s, v, k) => s + v * TB[k][j], 0))), BA = TB.map((r) => TA[0].map((_, j) => r.reduce((s, v, k) => s + v * TA[k][j], 0)));
    const diff = AB.map((r, i) => r.map((v, j) => v !== BA[i][j]));
    const ta = sa * seg(t, B.tabs[0], B.tabs[0] + 0.4, E.sine);
    table(TB, 107.6, 11.0, ta);
    table(AB, 116.5, 7.2, sa * seg(t, B.tabs[1], B.tabs[1] + 0.4, E.sine), diff, RED); table(BA, 116.5, 10.4, sa * seg(t, B.tabs[1] + 0.5, B.tabs[1] + 0.9, E.sine), diff);
    txt("≠", 116.5, 8.8, 0.7, RED, { weight: 700, alpha: sa * seg(t, B.tabs[1] + 0.9, B.tabs[1] + 1.2, E.o3) });
  }
  // 公式：铅笔从左往右写出
  const fa = seg(t, B.formula[0], B.formula[1], E.lin);
  if (fa > 0.01) {
    const c = G.ctx, [x0] = [107.0], k = G.k; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    const X0 = 960 + (x0 - k.c[0]) * k.s, X1 = 960 + (117.0 - k.c[0]) * k.s; c.beginPath(); c.rect(X0 - 40, 0, (X1 - X0 + 80) * fa, 1080); c.clip();
    txt("xp − px = iħ", 112, 8.4, 1.3, GR, { font: '"KMath"' }); c.restore();
  }
  const ia = seg(t, B.icons, B.icons + 0.6, E.sine) * (1 - seg(t, G.D.chap.tr4 - 0.3, G.D.chap.tr4, E.lin));
  if (ia > 0.01) {
    const c = G.ctx; ga(ia); c.strokeStyle = GR; c.lineWidth = 0.06;
    c.strokeRect(106.4, 10.1, 1.6, 1.6); for (let k = 0; k < 4; k++) { line([[106.6 + k * 0.4, 9.8], [106.6 + k * 0.4, 10.1]], 0.04, GR); line([[106.6 + k * 0.4, 11.7], [106.6 + k * 0.4, 12.0]], 0.04, GR); }
    line([[110.6, 10.9], [111.6, 10.5], [111.6, 11.3], [110.6, 10.9]], 0.06, GR); line([[111.6, 10.9], [114.0, 10.9]], 0.08, RED);
    ring([117.6, 10.9], 0.95, 0.12, GR); ring([117.6, 10.9], 0.45, 0.05, GR); ga(1);
  }
}
