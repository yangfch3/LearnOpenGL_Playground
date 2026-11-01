// 第 7 章（平板）：口味坐标与推荐 → 打分 = 点积 → 一次矩阵乘法 → 词向量类比 → 一层 = 矩阵 + 弯折，几层后一刀切开 → GPT-3 与显卡
import { G, COL, hs, rr, txt, line, dot, ring, vrod, ga } from "./draw.js";
import { seg, win, E, lerp } from "./world.js";

const RED = COL.red, PAPER = "#F4EFE4", DIM = "#9AA6B8", INKL = "#C9D3E2";
const PO = [163.7, 8.5], PU = 0.92, PW = (p) => [PO[0] + p[0] * PU, PO[1] - p[1] * PU];
function taste(t, B, A) {
  const a = Math.min(seg(t, B.taste, B.taste + 0.5, E.sine), 1 - seg(t, B.matmul[0] - 0.3, B.matmul[0] + 0.2, E.sine)); if (a <= 0.01) return;
  ga(a); vrod(PW([0, 0]), PW([5.1, 0]), 0.04, DIM); vrod(PW([0, 0]), PW([0, 5.1]), 0.04, DIM); ga(1);
  txt(G.T.act, ...PW([4.9, -0.4]), 0.3, DIM, { align: "right", alpha: a }); txt(G.T.rom, ...PW([0.15, 5.25]), 0.3, DIM, { align: "left", alpha: a });
  A.movies.forEach((m, i) => {
    const u = seg(t, B.movies[0] + i * 0.12, B.movies[0] + i * 0.12 + 0.3, E.o3); if (u <= 0) return;
    const p = PW(m), nr = A.near.includes(i) && t >= B.near;
    ga(a * u); rr(p[0] - 0.2, p[1] - 0.14, 0.4, 0.28, 0.05); G.ctx.fillStyle = nr ? "#F2C14E" : INKL; G.ctx.fill(); ga(1);
    if (nr) { ga(a * seg(t, B.near, B.near + 0.4, E.sine)); ring(p, 0.34, 0.04, "#F2C14E"); ga(1); }
  });
  const yu = PW(A.you); dot(yu, 0.17, RED); txt(G.T.you, yu[0] - 0.15, yu[1] - 0.42, 0.32, RED, { weight: 700, alpha: a });
  const na = a * seg(t, B.near, B.near + 0.6, E.sine);
  if (na > 0.01) { ga(na * 0.6); G.ctx.setLineDash([0.1, 0.08]); ring(yu, 1.05 * PU, 0.03, RED); G.ctx.setLineDash([]); ga(1); }
  const [d0, d1, d2] = B.dot, da = a * seg(t, d0, d0 + 0.4, E.sine);
  if (da > 0.01) {
    const m = A.dotm, f = (v) => v.toFixed(1), s = A.you[0] * m[0] + A.you[1] * m[1];
    ga(da); vrod(PW([0, 0]), yu, 0.05, RED); vrod(PW([0, 0]), PW(m), 0.05, "#F2C14E"); ga(1);
    txt(`${G.T.you} (${f(A.you[0])}, ${f(A.you[1])})`, 169.0, 4.4, 0.32, RED, { font: '"JBM"', weight: 600, align: "left", alpha: da });
    txt(`▭ (${f(m[0])}, ${f(m[1])})`, 169.0, 5.0, 0.32, "#F2C14E", { font: '"JBM"', weight: 600, align: "left", alpha: da });
    txt(`${f(A.you[0])}×${f(m[0])}`, 169.0, 6.0, 0.32, PAPER, { font: '"JBM"', align: "left", alpha: a * seg(t, d1, d1 + 0.4, E.sine) });
    txt(`+ ${f(A.you[1])}×${f(m[1])}`, 169.0, 6.55, 0.32, PAPER, { font: '"JBM"', align: "left", alpha: a * seg(t, d1 + 0.3, d1 + 0.7, E.sine) });
    txt(`= ${s.toFixed(1)}`, 169.0, 7.3, 0.42, RED, { font: '"JBM"', weight: 700, align: "left", alpha: a * seg(t, d2, d2 + 0.4, E.sine) });
  }
}
function matmul(t, B) {
  const a = win(t, B.matmul[0], B.words - 0.1, 0.4, 0.4); if (a <= 0.01) return;
  const c = G.ctx, nu = 12, nm = 16, cw = 0.42, x0 = 164.6, y0 = 5.0, f = seg(t, B.matmul[0] + 0.4, B.matmul[1], E.lin);
  const U = (i) => [1 + 4 * hs(i * 3.1), 1 + 4 * hs(i * 7.7)], V = (j) => [1 + 4 * hs(j * 5.3 + 2), 1 + 4 * hs(j * 1.9 + 5)];
  for (let i = 0; i < nu; i++) for (let k = 0; k < 2; k++) { ga(a); c.fillStyle = `rgba(217,69,46,${0.25 + 0.15 * U(i)[k]})`; c.fillRect(163.2 + k * 0.38, y0 + i * 0.3, 0.34, 0.26); }
  for (let j = 0; j < nm; j++) for (let k = 0; k < 2; k++) { ga(a); c.fillStyle = `rgba(242,193,78,${0.25 + 0.15 * V(j)[k]})`; c.fillRect(x0 + j * cw, 3.75 + k * 0.38, cw - 0.04, 0.34); }
  const cells = nu * nm, n = Math.floor(f * cells);
  for (let q = 0; q < n; q++) {
    const i = Math.floor(q / nm), j = q % nm, v = (U(i)[0] * V(j)[0] + U(i)[1] * V(j)[1]) / 50;
    ga(a); c.fillStyle = `rgba(244,239,228,${0.08 + 0.85 * v})`; c.fillRect(x0 + j * cw, y0 + i * 0.3, cw - 0.04, 0.26);
  }
  ga(1);
  txt("×", 163.95, 4.3, 0.4, DIM, { alpha: a }); txt("=", 164.25, 4.9, 0.01, DIM, { alpha: 0 });
}

function proj(p, yaw) { // 3D → 平板屏幕：绕竖轴转 yaw，俯仰 0.35，弱透视
  const cy = Math.cos(yaw), sy = Math.sin(yaw), x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
  const cp = Math.cos(0.35), sp = Math.sin(0.35), y2 = y * cp - z * sp, z2 = y * sp + z * cp, w = 1 + 0.06 * z2;
  return [167.0 + (x - 1.4) * 0.95 / w, 6.6 - (y2 - 1.2) * 0.95 / w, z2];
}
function words(t, B, A) {
  const a = win(t, B.words, B.rings, 0.5, 0.4); if (a <= 0.01) return;
  const yaw = -0.5 + 0.12 * (t - B.words), T = G.T;
  for (const p of A.cloud) { const q = proj(p, yaw); ga(a * (0.35 + 0.1 * q[2])); dot(q, 0.06, INKL); }
  ga(1);
  const W = A.words, P = (k) => proj(W[k], yaw);
  [["king", "w0"], ["man", "w1"], ["woman", "w2"]].forEach(([k, l]) => { const q = P(k); dot(q, 0.13, PAPER); txt(T[l], q[0], q[1] - 0.38, 0.34, PAPER, { weight: 700, alpha: a }); });
  const a1 = seg(t, B.arrow1, B.arrow1 + 0.8, E.io2);
  if (a1 > 0.01) { const p = P("man"), q = P("woman"); ga(a); vrod(p, [lerp(p[0], q[0], a1), lerp(p[1], q[1], a1)], 0.05, RED); ga(1); }
  const a2 = seg(t, B.arrow2, B.arrow2 + 1.0, E.io2);
  if (a2 > 0.01) {
    const d = W.woman.map((v, i) => v - W.man[i]), k = W.king, e = k.map((v, i) => v + d[i] * a2), p = P("king"), q = proj(e, yaw);
    ga(a * 0.4); G.ctx.setLineDash([0.08, 0.08]); line([P("man"), p], 0.025, RED); G.ctx.setLineDash([]); ga(a); vrod(p, q, 0.05, RED); ga(1);
  }
  const qa = a * seg(t, B.queen, B.queen + 0.5, E.sine);
  if (qa > 0.01) { const q = P("queen"); ga(qa); dot(q, 0.13, "#F2C14E"); ring(q, 0.3, 0.04, "#F2C14E"); ga(1); txt(T.w3, q[0] - 0.75, q[1], 0.34, "#F2C14E", { weight: 700, alpha: qa }); }
  txt(T.sketch, 171.8, 3.8, 0.24, DIM, { align: "right", alpha: a });
}
function rings(t, B, A) {
  const a = win(t, B.rings, B.gpt, 0.5, 0.4); if (a <= 0.01) return;
  const o = [167.3, 6.15], s = 1.0, S = A.st, L = B.layers;
  let k = 0, u = 0; for (let i = 0; i < 4; i++) if (t >= L[i]) { k = i; u = seg(t, L[i], L[i] + 0.9, E.io2); }
  const started = t >= L[0], from = started ? S[k] : S[0], to = started ? S[k + 1] : S[0];
  const pts = from.map((p, i) => [lerp(p[0], to[i][0], u), lerp(p[1], to[i][1], u)]);
  ga(a * 0.3); line([[o[0] - 2.6, o[1]], [o[0] + 2.6, o[1]]], 0.02, DIM); line([[o[0], o[1] - 2.6], [o[0], o[1] + 2.6]], 0.02, DIM); ga(1);
  pts.forEach((p, i) => { ga(a); dot([o[0] + p[0] * s, o[1] - p[1] * s], 0.075, A.cls[i] ? RED : INKL); }); ga(1);
  if (started) txt(G.T.layer.replace("{n}", String(Math.min(2, Math.floor(k / 2) + 1))), 163.0, 3.9, 0.34, DIM, { weight: 700, align: "left", alpha: a });
  const [c0, c1] = B.tryCut, ca = win(t, c0, c1 + 0.2, 0.2, 0.3);
  if (ca > 0.01) { // 试着切一刀：怎么转都切不开
    const th = lerp(0.2, 2.9, seg(t, c0, c1, E.io2)), d = [Math.cos(th) * 2.7, Math.sin(th) * 2.7];
    ga(a * ca); G.ctx.setLineDash([0.12, 0.1]); line([[o[0] - d[0], o[1] + d[1]], [o[0] + d[0], o[1] - d[1]]], 0.04, PAPER); G.ctx.setLineDash([]); ga(1);
    txt("✕", o[0] + 2.4, 3.9, 0.45, RED, { weight: 700, alpha: a * ca });
  }
  const cu = seg(t, B.cut, B.cut + 0.6, E.io2);
  if (cu > 0.01) {
    const n = A.cutN, cc = A.cutC, p0 = [n[0] * cc, n[1] * cc], dir = [-n[1], n[0]], L2 = 2.8 * cu;
    const P1 = [o[0] + (p0[0] - dir[0] * L2) * s, o[1] - (p0[1] - dir[1] * L2) * s], P2 = [o[0] + (p0[0] + dir[0] * L2) * s, o[1] - (p0[1] + dir[1] * L2) * s];
    ga(a); line([P1, P2], 0.06, "#F2C14E"); ga(1); txt(G.T.cut, P2[0] + 0.1, P2[1] - 0.3, 0.32, "#F2C14E", { weight: 700, alpha: a });
  }
}
function gpu(t, B) {
  const a = win(t, B.gpt, G.D.chap.fin + 0.3, 0.5, 0.4); if (a <= 0.01) return;
  const c = G.ctx, nx = 44, ny = 22, x0 = 163.0, y0 = 4.5, cw = 8.6 / nx, ch = 4.1 / ny, gu = seg(t, B.gpu, B.gpu + 0.6, E.sine);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const v = hs(i * 31 + j * 7), wave = 0.5 + 0.5 * Math.sin((i + j) * 0.5 - (t - B.mac) * 9);
    ga(a * (0.15 + 0.5 * v * (1 - gu) + gu * (0.2 + 0.7 * wave))); c.fillStyle = gu > 0.5 ? "#7FB38A" : INKL; c.fillRect(x0 + i * cw, y0 + j * ch, cw * 0.82, ch * 0.82);
  }
  ga(1);
  txt(G.T.gpt, 167.3, 3.95, 0.5, PAPER, { weight: 700, alpha: a * (1 - gu) });
  const ma = a * seg(t, B.mac, B.mac + 0.4, E.sine) * (1 - gu);
  if (ma > 0.01) { const n = Math.round(1750 * seg(t, B.mac, B.mac + 2.2, E.o3)); txt(`× + × + …  ${n} 亿`, 167.3, 8.75, 0.01 + 0.3, RED, { font: '"JBM"', weight: 700, alpha: ma }); }
}
function feed(t, B) {
  const a = win(t, B.feed - 0.3, B.taste + 0.2, 0.4, 0.4); if (a <= 0.01) return;
  const c = G.ctx, sc = (t - B.feed) * 0.5;
  for (let q = 0; q < 12; q++) {
    const x = 162.8 + (q % 4) * 2.4, y = 3.7 + Math.floor(q / 4) * 2.0 - sc;
    ga(a); c.fillStyle = ["#E9B44C", "#5B8DB8", "#C45B4A", "#6FA36A", "#8B6BB5"][(q * 3) % 5]; c.fillRect(x, y, 2.2, 1.4); c.fillStyle = "#444A52"; c.fillRect(x, y + 1.5, 1.6, 0.12);
  }
  ga(1);
}
export function draw(t, r) {
  const B = G.D.b, A = G.D.ai;
  if (t < G.D.chap.ai || t > G.D.chap.fin + 1) return;
  feed(t, B); taste(t, B, A); matmul(t, B); words(t, B, A); rings(t, B, A); gpu(t, B);
}
