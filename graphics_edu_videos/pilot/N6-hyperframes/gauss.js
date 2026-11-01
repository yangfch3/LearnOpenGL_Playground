// 第 2 章：星图。谷神星跟丢 → 误差 → 硬穿过每点会乱拐 → 橡皮筋拉出最小二乘轨道 → 正规方程消元 → 年底重现
import { G, COL, hs, fillS, txt, line, dot, ring, ga, visible } from "./draw.js";
import { seg, win, E, lerp } from "./world.js";

const GOLD = "#E3CF95";
const poly = (p, uc, u) => p[0] + p[1] * (u - uc) + p[2] * (u - uc) ** 2;
const trueV = (u) => 8.2 - 0.55 * (u - 3) + 0.012 * (u - 3) ** 2;
function horner(cf, x) { let y = 0; for (const a of cf) y = y * x + a; return y; }
function curve(f, u0, u1, w, col, dash) {
  const c = G.ctx, pts = [];
  for (let u = u0; u <= u1 + 1e-9; u += 0.08) pts.push([u, f(u)]);
  c.save(); c.beginPath(); c.rect(0, 0, 20, 11.6); c.clip();
  if (dash) c.setLineDash(dash); line(pts, w, col); c.restore();
}
function spring(a, b, col, w) { // 橡皮筋：竖直的锯齿线
  const n = 8, pts = [a];
  for (let i = 1; i < n; i++) { const u = i / n; pts.push([a[0] + (i % 2 ? 0.09 : -0.09), lerp(a[1], b[1], u)]); }
  pts.push(b); line(pts, w, col);
}
export function draw(t) {
  if (!visible([35, 3.2, 55, 14.8])) return;
  const B = G.D.b, Q = G.D.gauss, c = G.ctx, T = G.T;
  const p = new Path2D(); p.rect(35, 3.2, 20, 11.6); fillS(p, COL.navy);
  c.save(); c.translate(35, 3.2);
  c.strokeStyle = "#B9A36A"; c.lineWidth = 0.06; c.strokeRect(0.25, 0.25, 19.5, 11.1); c.lineWidth = 0.025; c.strokeRect(0.4, 0.4, 19.2, 10.8);
  for (const [x, y, r] of Q.stars) dot([x, y], r * 1.2, `rgba(241,228,184,${0.35 + r * 8})`);
  c.setLineDash([0.2, 0.2]); line([[0.4, trueV(-0.5)], [19.6, trueV(19.6)]].map(([u]) => [u, trueV(u) + 1.2]), 0.025, "rgba(201,185,138,0.35)"); c.setLineDash([]);
  txt(T.sketch, 54.2, 14.25, 0.32, "rgba(227,207,149,0.6)", { weight: 500, align: "right" });
  const pos = (u, v) => [u, v];
  // 谷神星走一段，留下观测记号；太阳从右往左扫过，它被淹没
  const [w0, w1] = B.walk, uC = lerp(Q.path[0], Q.path[1], seg(t, w0, w1, E.lin));
  const cerA = (t < w0 ? 0 : 1) * (1 - seg(t, B.hide[0], B.hide[1], E.sine));
  if (cerA > 0.01) { ga(cerA); dot(pos(uC, trueV(uC)), 0.16, "#F6F0DA"); ga(1); }
  Q.obsU.forEach((u, i) => {
    const a = seg(t, Q.obsT[i], Q.obsT[i] + 0.25, E.o3); if (a <= 0.01) return;
    const v = Q.obsV[i]; ga(a); line([[u - 0.16, v], [u + 0.16, v]], 0.05, GOLD); line([[u, v - 0.16], [u, v + 0.16]], 0.05, GOLD); ga(1);
    const ea = win(t, B.err, B.fitIn + 0.6, 0.4, 0.6);
    if (ea > 0.01) { ga(ea * 0.8); c.setLineDash([0.08, 0.08]); ring([u, v], 0.42, 0.03, GOLD); c.setLineDash([]); ga(1); }
  });
  const su = lerp(Q.sunU[0], Q.sunU[1], seg(t, B.sun[0], B.sun[1], E.lin));
  if (t > B.sun[0] && t < B.sun[1]) {
    const sv = trueV(su); c.save(); c.beginPath(); c.rect(0, 0, 20, 11.6); c.clip();
    const rg = c.createRadialGradient(su, sv, 0.5, su, sv, 3.0); rg.addColorStop(0, "rgba(246,200,110,0.5)"); rg.addColorStop(1, "rgba(246,200,110,0)");
    c.fillStyle = rg; c.beginPath(); c.arc(su, sv, 3.0, 0, 2 * Math.PI); c.fill();
    dot([su, sv], 0.62, "#F6D27A"); ring([su, sv], 0.62, 0.05, "#B7862E"); dot([su, sv], 0.1, "#B7862E"); c.restore();
  }
  // 硬穿过每个点的曲线：乱拐
  const wa = seg(t, B.wiggle[0], B.wiggle[1], E.io2), wf = 1 - seg(t, B.wiggle[2] - 0.5, B.wiggle[2], E.sine);
  if (wa > 0.01 && wf > 0.01) { ga(wf); curve((u) => horner(Q.interp, u - Q.uc), 2.4, lerp(2.4, 16.5, wa), 0.06, "#E58A6E"); ga(1); }
  fitPart(t, B, Q, c, T);
  c.restore();
}

function fitPart(t, B, Q, c, T) {
  if (t < B.fitIn) return;
  const W = (u, v) => [35 + u, 3.2 + v]; // 文字用世界坐标
  const e = seg(t, B.fit[0], B.fit[1], E.io2), pp = Q.p0.map((a, i) => lerp(a, Q.p1[i], e)), f = (u) => poly(pp, Q.uc, u);
  const ca = seg(t, B.fitIn, B.fitIn + 0.5, E.sine);
  ga(ca); curve(f, 2.0, 9.2, 0.07, GOLD); ga(1);
  let sse = 0;
  Q.obsU.forEach((u, i) => {
    const v = Q.obsV[i], fv = f(u), r = v - fv; sse += r * r;
    const ba = seg(t, B.bands[0] + i * 0.18, B.bands[0] + i * 0.18 + 0.3, E.o3) * (1 - seg(t, B.ne, B.ne + 0.6, E.sine));
    if (ba <= 0.01) return;
    ga(ba); spring([u, v], [u, fv], COL.red, 0.035);
    const sq = seg(t, B.fit[0] - 0.4, B.fit[0], E.o3); // 伸长量画成小方块
    if (sq > 0.01) { ga(ba * sq * 0.45); c.fillStyle = COL.red; c.fillRect(u + 0.06, Math.min(v, fv), Math.abs(r), Math.abs(r)); ga(ba * sq); c.strokeStyle = COL.red; c.lineWidth = 0.025; c.strokeRect(u + 0.06, Math.min(v, fv), Math.abs(r), Math.abs(r)); }
    ga(1);
  });
  // 总面积的条
  const ta = win(t, B.fit[0] - 0.4, B.ne + 0.4, 0.4, 0.5);
  if (ta > 0.01) {
    ga(ta); c.fillStyle = "rgba(244,239,228,0.15)"; c.fillRect(1.2, 1.1, 6.0, 0.36); c.fillStyle = COL.red; c.fillRect(1.2, 1.1, 6.0 * Math.min(1, sse / Q.sse0), 0.36); ga(1);
    txt(T.total, ...W(1.2, 0.72), 0.36, GOLD, { align: "left", alpha: ta });
  }
  txt(T.lsq, ...W(9.6, 3.6), 0.62, GOLD, { weight: 700, alpha: win(t, B.lsq, B.pred[0], 0.3, 0.5) });
  // 正规方程 3×4，逐步消元
  const na = win(t, B.ne, B.pred[0] + 0.2, 0.5, 0.5);
  if (na > 0.01) {
    let k = 0; for (const tt of B.neT) if (t >= tt) k++;
    const M = Q.ne[Math.min(k, 2)];
    M.forEach((row, i) => row.forEach((v, j) => {
      const zero = Math.abs(v) < 0.05 && j < i;
      txt(zero ? "0" : v.toFixed(1), ...W(11.6 + j * 2.0 + (j === 3 ? 0.5 : 0), 5.2 + i * 0.75), 0.42, zero ? COL.red : GOLD, { font: '"JBM"', align: "right", alpha: na });
    }));
    ga(na); line([[16.8, 4.8], [16.8, 6.9]], 0.03, GOLD); ga(1);
    txt(T.gelim, ...W(15.0, 7.9), 0.42, GOLD, { weight: 700, alpha: na * seg(t, B.neT[0], B.neT[0] + 0.4, E.sine) });
  }
  // 预言：轨道外推，谷神星在圈里重现
  const pa = seg(t, B.pred[0], B.pred[0] + 1.0, E.io2);
  if (pa > 0.01) {
    c.setLineDash([0.18, 0.14]); curve((u) => poly(Q.p1, Q.uc, u), 9.2, lerp(9.2, Q.uPred, pa), 0.05, GOLD); c.setLineDash([]);
    ga(seg(t, B.pred[0] + 0.8, B.pred[0] + 1.2, E.sine)); ring([Q.uPred, Q.vPred], 0.45, 0.05, COL.red); ga(1);
    const ca2 = seg(t, B.pred[1], B.pred[1] + 0.3, E.o3);
    if (ca2 > 0.01) { ga(ca2); dot([Q.uPred, Q.vPred], 0.16, "#F6F0DA"); ga((1 - seg(t, B.pred[1], B.pred[1] + 1.2, E.lin)) * 0.8); ring([Q.uPred, Q.vPred], 0.45 + 1.4 * seg(t, B.pred[1], B.pred[1] + 1.2, E.o2), 0.04, "#F6F0DA"); ga(1); }
  }
}
