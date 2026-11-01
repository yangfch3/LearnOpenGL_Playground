// 第 3 章：方格纸。两根算筹 = 两列数；网格与猫跟着走；修图按钮；乘法 = 接着做；面积 = 行列式；方程组 = 谁落在 b
import { G, COL, fillS, txt, line, dot, ring, vrod, ga, visible } from "./draw.js";
import { seg, win, E, lerp, matAt, mv, det } from "./world.js";

const INK = COL.ink, RED = COL.red;
const ell = (cx, cy, rx, ry, n = 28) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)]);
const CAT = [ell(2.0, 1.25, 0.95, 0.75), [[1.2, 1.7], [1.3, 2.4], [1.7, 1.98]], [[2.3, 1.98], [2.7, 2.4], [2.8, 1.7]], ell(1.65, 1.42, 0.09, 0.11, 10), ell(2.35, 1.42, 0.09, 0.11, 10),
  [[1.8, 0.82], [2.0, 0.95], [2.2, 0.82]], [[1.55, 1.02], [0.85, 1.12]], [[1.55, 0.92], [0.85, 0.82]], [[2.45, 1.02], [3.15, 1.12]], [[2.45, 0.92], [3.15, 0.82]]];
let O, g;
const W = (p) => [O[0] + p[0] * g, O[1] - p[1] * g];
const WM = (M, p) => W(mv(M, p));
function chain(M, steps, a, w = 0.11) { // 头尾相接的一串算筹：steps = [[基向量序号, 个数], ...]
  let p = [0, 0];
  for (const [b, n] of steps) for (let k = 0; k < Math.abs(n); k++) {
    const e = b === 0 ? [M[0][0], M[1][0]] : [M[0][1], M[1][1]], sg = Math.sign(n), q = [p[0] + sg * e[0], p[1] + sg * e[1]];
    ga(a); vrod(W(p), W(q), w, b === 0 ? RED : INK); ga(1); p = q;
  }
  return p;
}
function grid(M, a) {
  const c = G.ctx; c.save(); c.beginPath(); c.rect(70.7, 3.2, 18.6, 11.6); c.clip();
  ga(a * Math.min(1, 0.12 + Math.abs(det(M)))); c.strokeStyle = "rgba(30,38,56,0.42)"; c.lineWidth = 0.035; c.beginPath();
  for (let i = -9; i <= 9; i++) { const p = WM(M, [i, -9]), q = WM(M, [i, 9]), r = WM(M, [-9, i]), s = WM(M, [9, i]); c.moveTo(...p); c.lineTo(...q); c.moveTo(...r); c.lineTo(...s); }
  c.stroke(); ga(1); c.restore();
}
function matrix(M, x, y, a, sz = 0.5) { // 矩阵：第一列朱红、第二列墨色
  if (a <= 0.01) return;
  const c = G.ctx, f = (v) => (Math.abs(v) < 0.005 ? "0" : (Math.round(v * 10) / 10).toString());
  ga(a); c.strokeStyle = INK; c.lineWidth = 0.05;
  for (const sx of [-1, 1]) { const bx = x + sx * 1.35 * sz * 2; c.beginPath(); c.moveTo(bx - sx * 0.18, y - 1.1 * sz * 2); c.lineTo(bx, y - 1.1 * sz * 2); c.lineTo(bx, y + 1.1 * sz * 2); c.lineTo(bx - sx * 0.18, y + 1.1 * sz * 2); c.stroke(); }
  ga(1);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) txt(f(M[i][j]), x + (j - 0.5) * 1.3 * sz * 2, y + (i - 0.5) * 1.05 * sz * 2, sz, j === 0 ? RED : INK, { font: '"JBM"', weight: 700, alpha: a });
}

export function draw(t) {
  if (!visible([70.5, 3.0, 89.5, 15.0])) return;
  const B = G.D.b, Q = G.D.cay, c = G.ctx, T = G.T;
  O = Q.o; g = Q.g;
  const pp = new Path2D(); pp.rect(70.5, 3.0, 19.0, 12.0); fillS(pp, "#F1EDE2");
  c.strokeStyle = "rgba(150,170,190,0.35)"; c.lineWidth = 0.018; c.beginPath();
  for (let x = 70.75; x < 89.5; x += 0.375) { c.moveTo(x, 3.1); c.lineTo(x, 14.9); } for (let y = 3.0 + 0.375; y < 15; y += 0.375) { c.moveTo(70.6, y); c.lineTo(89.4, y); } c.stroke();
  if (t < B.rods - 0.5) return;
  const M = matAt(Q.mk, t), end = G.D.chap.tr3;
  const ra = seg(t, B.rods, B.rods + 0.6, E.o3);
  grid(M, seg(t, B.rods, B.rods + 0.8, E.sine));
  // 面积：单位方块（猫之前就在那里，c10 起涂色）
  const aa = seg(t, B.areaShow, B.areaShow + 0.5, E.sine) * (1 - seg(t, B.c13 - 0.6, B.c13, E.sine));
  if (aa > 0.01) {
    const q = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => WM(M, p)), d = det(M);
    ga(aa * 0.3); c.fillStyle = d >= 0 ? RED : INK; c.beginPath(); c.moveTo(...q[0]); for (const p of q.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); ga(1);
    const lbl = `${T.area} ×${Math.abs(d) < 0.03 ? "0" : d.toFixed(2)}`;
    txt(lbl, 87.2, 9.4, 0.48, Math.abs(d) < 0.03 ? RED : INK, { weight: 700, alpha: aa });
  }
  // 猫
  const ca = seg(t, B.cat, B.cat + 0.6, E.sine) * (1 - seg(t, B.c13 - 0.6, B.c13, E.sine));
  if (ca > 0.01) {
    ga(ca); for (const s of CAT) line(s.map((p) => WM(M, p)), 0.07, INK); ga(1);
    dot(WM(M, Q.nose), 0.13, RED);
  }
  // 一点在平面上走：几根红 + 几根黑
  const [w0, w1] = B.wander;
  if (t > w0 && t < w1 + 0.6) {
    const a = win(t, w0, w1 + 0.6, 0.3, 0.5), u = seg(t, w0, w1, E.lin);
    const steps = u < 0.5 ? [[0, 3], [1, 1]] : [[0, -2], [1, 2]], k = (u % 0.5) / 0.5;
    const tot = steps.reduce((s, [, n]) => s + Math.abs(n), 0), shown = Math.min(tot, Math.floor(k * (tot + 1.5)));
    let left = shown; const part = steps.map(([b, n]) => { const m = Math.min(Math.abs(n), left); left -= m; return [b, Math.sign(n) * m]; });
    const p = chain(M, part, a); dot(W(p), 0.12, INK);
  }
  const na = win(t, B.nose[0], B.nose[1] + 1.2, 0.3, 0.4);
  if (na > 0.01) { chain(I2, [[0, 2], [1, 1]], na * seg(t, B.nose[0], B.nose[0] + 0.6, E.sine)); txt("2 + 1", ...W([1.0, -0.45]), 0.42, RED, { font: '"JBM"', weight: 700, alpha: na }); }
  const n2 = win(t, B.nose2[0], B.c6_e, 0.3, 0.4);
  if (n2 > 0.01) chain(M, [[0, 2], [1, 1]], n2);
  if (ra > 0.01) { ga(ra); vrod(W([0, 0]), WM(M, [1, 0]), 0.14, RED); vrod(W([0, 0]), WM(M, [0, 1]), 0.14, INK); ga(1); dot(W([0, 0]), 0.1, INK); }
  // 矩阵：两列 = 两根算筹的落点
  matrix(M, 87.3, 4.9, seg(t, B.matShow, B.matShow + 0.5, E.sine) * (1 - seg(t, end - 0.3, end, E.lin)));
  B.ops.forEach((t0, k) => txt(T["op" + k], 87.3, 7.4, 0.5, INK, { weight: 700, alpha: win(t, t0, t0 + 1.3, 0.2, 0.25) }));
  const [h0, h1, h2] = B.chain;
  txt(T.op1, 87.3, 7.4, 0.5, INK, { weight: 700, alpha: win(t, h0, h1 + 0.9, 0.2, 0.3) });
  txt("+ " + T.op2, 87.3, 8.2, 0.5, INK, { weight: 700, alpha: win(t, h1, h1 + 1.6, 0.2, 0.3) });
  txt("= " + T.mat, 87.3, 7.4, 0.5, RED, { weight: 700, alpha: win(t, h2, h2 + 1.6, 0.2, 0.3) });
  solve(t, B, Q, M, c);
}
const I2 = [[1, 0], [0, 1]];
function solve(t, B, Q, M, c) { // 方程组：哪个点变形后落在 b？
  const a = win(t, B.solve[0], G.D.chap.tr3, 0.4, 0.4);
  if (a <= 0.01) return;
  const b = W(Q.b);
  ga(a); line([[b[0] - 0.2, b[1] - 0.2], [b[0] + 0.2, b[1] + 0.2]], 0.07, RED); line([[b[0] - 0.2, b[1] + 0.2], [b[0] + 0.2, b[1] - 0.2]], 0.07, RED); ga(1);
  txt("b", b[0] + 0.45, b[1] - 0.35, 0.5, RED, { font: '"KMath"', alpha: a });
  const u = seg(t, B.solve[1], B.solve[2], E.io2), x = [lerp(-1.5, Q.x[0], u), lerp(-0.5, Q.x[1], u) + 0.6 * Math.sin(Math.PI * u)];
  const miss = t >= B.c14;
  let im = WM(M, x);
  if (miss) { // 压扁后：像只能在一条线上滑，滑到离 b 最近处也够不着
    const d = [1, 0.5], k = (Q.b[0] * d[0] + Q.b[1] * d[1]) / (d[0] * d[0] + d[1] * d[1]), u2 = seg(t, B.c14 + 1.6, B.miss, E.io2);
    const s0 = mv(M, Q.x); im = W([lerp(s0[0], k * d[0], u2), lerp(s0[1], k * d[1], u2)]);
  }
  ga(a); dot(im, 0.14, INK); ring(im, 0.24, 0.04, INK); ga(1);
  if (miss) { const m = seg(t, B.miss, B.miss + 0.5, E.sine); ga(a * m); c.setLineDash([0.15, 0.12]); line([im, b], 0.04, RED); c.setLineDash([]); ga(1); }
}
