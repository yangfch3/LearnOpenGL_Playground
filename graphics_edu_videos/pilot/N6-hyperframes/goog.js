// 第 5 章：打印纸。地球仪只有地轴不动 → 变形里不拐弯的方向 → 反复变形被拉向它 → 网页人流收敛 = 特征向量
import { G, COL, hs, txt, line, dot, ring, rod, vrod, ga, visible, rr } from "./draw.js";
import { seg, win, E, lerp, mv, matAt } from "./world.js";

const INK = COL.ink, RED = COL.red;
function globe(t, B) {
  const [g0, g1] = B.globe, inn = seg(t, g0, g0 + 0.8, E.o3), out = seg(t, g1, g1 + 0.7, E.i2);
  if (inn <= 0.01 || out >= 1) return;
  const c = G.ctx, cx = 143 + 12 * out, cy = 9.0 - 9 * (1 - inn), R = 3.4, rot = (t - g0) * 0.9;
  ga(0.25); dot([cx + 0.3, cy + 0.45], R, "#1A1A1A"); ga(1);
  dot([cx, cy], R, "#4C86B8");
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 2 * Math.PI); c.clip();
  for (let k = 0; k < 7; k++) { // 陆地：极坐标下的几块（俯看北极）
    const a0 = k * 0.9 + hs(k) * 0.5 + rot, r0 = 0.9 + hs(k + 3) * 2.0, rs = 0.5 + hs(k + 7) * 0.6;
    c.fillStyle = k % 2 ? "#7FA35E" : "#A3B36A"; c.beginPath(); c.ellipse(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0, rs * 1.4, rs, a0, 0, 2 * Math.PI); c.fill();
  }
  for (const r of [1.2, 2.3]) ring([cx, cy], r, 0.03, "rgba(255,255,255,0.35)");
  for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4; line([[cx, cy], [cx + Math.cos(a) * R, cy + Math.sin(a) * R]], 0.025, "rgba(255,255,255,0.3)"); }
  c.restore();
  ring([cx, cy], R, 0.12, "#B89A55");
  const ea = rot, ep = [cx + Math.cos(ea) * 2.8, cy + Math.sin(ea) * 2.8];
  dot(ep, 0.16, "#F4EFE4"); dot([cx, cy], 0.2, RED); ring([cx, cy], 0.38, 0.05, RED);
}
function eigen(t, B, Q) {
  const a = win(t, B.eigM[0] - 0.4, B.iter[0], 0.4, 0.4); if (a <= 0.01) return;
  const M = matAt([[B.eigM[0], B.eigM[1], Q.eig]], t), o = Q.o, g = Q.g, W = (p) => [o[0] + p[0] * g, o[1] - p[1] * g], c = G.ctx;
  const hi = seg(t, B.eigHi, B.eigHi + 0.5, E.sine);
  c.save(); c.beginPath(); c.rect(134.7, 3.0, 16.6, 12.0); c.clip();
  ga(a * 0.35); c.strokeStyle = INK; c.lineWidth = 0.025; c.beginPath();
  for (let i = -7; i <= 7; i++) { const p = W(mv(M, [i, -7])), q = W(mv(M, [i, 7])), r = W(mv(M, [-7, i])), s = W(mv(M, [7, i])); c.moveTo(...p); c.lineTo(...q); c.moveTo(...r); c.lineTo(...s); }
  c.stroke(); ga(1); c.restore();
  for (let k = 0; k < 16; k++) {
    const th = k * Math.PI / 8, v = [Math.cos(th) * 2, Math.sin(th) * 2], isE = k % 4 === 2;
    ga(a * 0.4); c.setLineDash([0.1, 0.1]); line([W([0, 0]), W([v[0] * 1.8, v[1] * 1.8])], 0.02, isE ? RED : INK); c.setLineDash([]);
    ga(a * (isE ? 1 : 1 - 0.6 * hi)); vrod(W([0, 0]), W(mv(M, v)), 0.08, isE && hi > 0 ? RED : INK); ga(1);
  }
  txt(G.T.eig, ...W([2.7, 3.3]), 0.5, RED, { weight: 700, alpha: a * seg(t, B.e4, B.e4 + 0.4, E.sine) });
}
function iterate(t, B, Q) {
  const a = win(t, B.iter[0], B.e6_e, 0.4, 0.4); if (a <= 0.01) return;
  const o = Q.o, g = Q.g, W = (p) => [o[0] + p[0] * g, o[1] - p[1] * g], n = Q.iter.length - 1, c = G.ctx;
  const u = seg(t, B.iter[0], B.iter[1], E.lin) * n, k = Math.min(n - 1, Math.floor(u)), f = E.io2(Math.min(1, (u - k) * 1.6));
  ga(a * 0.5); c.setLineDash([0.18, 0.14]); line([W([-3.2, -3.2]), W([3.2, 3.2])], 0.04, RED); c.setLineDash([]); ga(1);
  for (let j = 0; j <= k; j++) { ga(a * 0.18 * (j + 1) / (k + 1)); vrod(W([0, 0]), W(Q.iter[j].map((v) => v * 3)), 0.07, INK); }
  const v = Q.iter[k].map((x, i) => lerp(x, Q.iter[k + 1][i], f) * 3);
  ga(a); vrod(W([0, 0]), W(v), 0.12, u >= n - 0.05 ? RED : INK); ga(1);
  txt(`×${Math.min(n, Math.floor(u) + (f > 0.5 ? 1 : 0))}`, ...W([-3.6, 2.6]), 0.5, INK, { font: '"JBM"', weight: 700, alpha: a });
}

const GO = [141.8, 8.6], NAMES = "ABCDEFGH";
const NW = (p) => [GO[0] + p[0], GO[1] - p[1]];
function shares(t, B, Q) { // 当前各页人流比例；flowA / flowF 两段各走 40 步
  const pick = (seq, a, b) => { const u = seg(t, a, b, E.o2) * (seq.length - 1), k = Math.min(seq.length - 2, Math.floor(u)), f = u - k; return seq[k].map((v, i) => lerp(v, seq[k + 1][i], f)); };
  if (t < B.flowA[0]) return null;
  if (t < B.flowF[0]) return pick(Q.flow.A, ...B.flowA);
  return pick(Q.flow.F, ...B.flowF);
}
function graph(t, B, Q) {
  const a = seg(t, B.graphIn, B.graphIn + 0.6, E.sine) * (1 - seg(t, G.D.chap.tr5 - 0.3, G.D.chap.tr5, E.lin));
  if (a <= 0.01) return;
  const c = G.ctx, sh = shares(t, B, Q), N = Q.nodes.length;
  for (const [i, j] of Q.links) { // 链接：箭头 + 人流小点
    const p = NW(Q.nodes[i]), q = NW(Q.nodes[j]), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    const A0 = [p[0] + ux * 0.75, p[1] + uy * 0.75], A1 = [q[0] - ux * 0.85, q[1] - uy * 0.85];
    ga(a * 0.55); line([A0, A1], 0.04, INK);
    c.fillStyle = INK; c.beginPath(); c.moveTo(A1[0] + ux * 0.2, A1[1] + uy * 0.2); c.lineTo(A1[0] - uy * 0.14 - ux * 0.1, A1[1] + ux * 0.14 - uy * 0.1); c.lineTo(A1[0] + uy * 0.14 - ux * 0.1, A1[1] - ux * 0.14 - uy * 0.1); c.fill(); ga(1);
    if (sh) {
      const outs = Q.links.filter(([k]) => k === i).length, dens = sh[i] / outs, n = 4;
      for (let k = 0; k < n; k++) { const u = ((t * 0.7 + k / n + hs(i * 9 + j)) % 1); ga(a * Math.min(1, dens * 9)); dot([lerp(A0[0], A1[0], u), lerp(A0[1], A1[1], u)], 0.07, RED); }
      ga(1);
    }
  }
  Q.nodes.forEach((pn, i) => {
    const p = NW(pn), z = sh ? 0.55 + 1.6 * Math.sqrt(sh[i]) : 1, w = 1.1 * Math.min(z, 1.45), h = 0.82 * Math.min(z, 1.45);
    ga(a); rr(p[0] - w / 2, p[1] - h / 2, w, h, 0.1); c.fillStyle = "#FFFFFF"; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.04; c.stroke();
    c.fillStyle = "#9FB6D8"; c.fillRect(p[0] - w / 2 + 0.04, p[1] - h / 2 + 0.04, w - 0.08, h * 0.2);
    for (let k = 0; k < 2; k++) line([[p[0] - w * 0.35, p[1] + h * (0.05 + k * 0.2)], [p[0] + w * 0.3, p[1] + h * (0.05 + k * 0.2)]], 0.03, "rgba(30,38,56,0.35)");
    ga(1);
    txt(NAMES[i], p[0] - w / 2 - 0.25, p[1] - h / 2 - 0.1, 0.36, INK, { weight: 700, font: '"JBM"', alpha: a });
    if (sh) txt(`${Math.round(sh[i] * 100)}%`, p[0], p[1] + h / 2 + 0.3, 0.34, RED, { weight: 700, font: '"JBM"', alpha: a });
  });
  // 一个人随手点：跳到哪页，哪页一闪
  const hk = B.hops, ha = win(t, hk[0], B.flowA[0] + 0.3, 0.2, 0.3);
  if (ha > 0.01) {
    let k = 0; for (let i = 0; i < hk.length; i++) if (t >= hk[i]) k = i;
    const nxt = Math.min(k + 1, hk.length - 1), u = t >= hk[hk.length - 1] ? 0 : seg(t, hk[k] + 0.12, hk[nxt], E.io2);
    const p = NW(Q.nodes[Q.walk[k]]), q = NW(Q.nodes[Q.walk[nxt]]);
    ga(ha); dot([lerp(p[0], q[0], u), lerp(p[1], q[1], u) - 0.6 * Math.sin(Math.PI * u)], 0.2, RED); ga(1);
  }
  // 比例列：从 A 出发 / 从 F 出发
  const col = (vals, x, label, al, red) => {
    if (al <= 0.01) return;
    txt(label, x, 4.3, 0.34, INK, { weight: 700, alpha: al });
    vals.forEach((v, i) => txt(`${(v * 100).toFixed(1)}`, x, 5.1 + i * 0.85, 0.36, red ? RED : INK, { font: '"JBM"', weight: 600, alpha: al }));
  };
  const finA = Q.flow.A[Q.flow.A.length - 1];
  col(t < B.flowF[0] ? (sh || finA) : finA, 148.6, G.T.startA, a * seg(t, B.flowA[0], B.flowA[0] + 0.5, E.sine), t >= B.prHi);
  col(sh || finA, 150.6, G.T.startF, a * seg(t, B.flowF[0], B.flowF[0] + 0.5, E.sine), t >= B.prHi);
  txt(G.T.eig, 149.6, 12.2, 0.42, RED, { weight: 700, alpha: a * seg(t, B.prHi, B.prHi + 0.5, E.sine) });
}
export function draw(t) {
  if (!visible([134, 2.8, 152, 15.2])) return;
  const B = G.D.b, Q = G.D.goog;
  globe(t, B); eigen(t, B, Q); iterate(t, B, Q); graph(t, B, Q);
}
