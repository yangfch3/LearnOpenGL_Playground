// 开场（封面、手机、溢出的数字）与 1a–1d 的纸面（p1 横线本、p2 / p3 方格本）
import { G, lw, world, line, dot, txt, partial, ga, clipRect, pmatrix, glowLine, mixHex } from "./paper.js";
import { seg, win, E, lerp, clamp01, animals, feet, tr, slideX } from "./world.js";
import { drawAnimal } from "./animals.js";

// ---- 手机屏幕（手机局部坐标，原点在中心）----
export function drawPhone(t) {
  const D = G.D, d = D.d0, b = D.b, c = G.ctx, w = d.phone.w, h = d.phone.h, C = G.C;
  world();
  c.save(); c.shadowColor = "rgba(25,15,8,0.5)"; c.shadowBlur = 1.2 * G.map.f; c.shadowOffsetX = 0.5 * G.map.f; c.shadowOffsetY = 0.8 * G.map.f;
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 2.2); c.fillStyle = "#23272E"; c.fill(); c.restore();
  const sx0 = -w / 2 + 0.8, sy0 = -h / 2 + 2.0, sw = w - 1.6, sh = h - 4.0, [s0, s1, s2, s3] = b.screens;
  c.save(); c.beginPath(); c.rect(sx0, sy0, sw, sh); c.clip();
  c.fillStyle = "#F4F6F9"; c.fillRect(sx0, sy0, sw, sh);
  const top = sy0 + sh, row = (y, wd, col) => { c.fillStyle = col; c.beginPath(); c.roundRect(sx0 + 1.0, y, wd, 0.9, 0.45); c.fill(); };
  if (t < s1) { // 对话窗：标题 GPT → Claude → DeepSeek（只写文字名）
    const name = ["GPT", "Claude", "DeepSeek"][Math.min(2, Math.floor((t - s0) / ((s1 - s0) / 3)))];
    c.fillStyle = "#E3E8EF"; c.fillRect(sx0, top - 3.2, sw, 3.2);
    txt(name, [0, top - 1.6], 1.6, "#1E2638", { font: "sans", weight: 700 });
    c.fillStyle = "#DCE6F5"; c.beginPath(); c.roundRect(sx0 + 3.0, top - 7.6, sw - 4.0, 2.6, 1.0); c.fill();
    txt(G.T["s.q"], [sx0 + sw - 1.6, top - 6.3], 1.2, "#1E2638", { font: "sans", align: "right" });
    for (let i = 0; i < 5; i++) row(top - 10.5 - 1.6 * i, sw - 3 - (i % 3) * 2.2, "#C9D0DA");
  } else if (t < s2) { // 搜索结果
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.roundRect(sx0 + 0.8, top - 3.6, sw - 1.6, 2.4, 1.2); c.fill(); c.strokeStyle = "#B8C2CF"; c.lineWidth = lw(2); c.stroke();
    txt(G.T["s.search"], [sx0 + 2.0, top - 2.4], 1.2, "#5A6577", { font: "sans", align: "left" });
    for (let i = 0; i < 6; i++) { row(top - 6.5 - 3.0 * i, sw - 4, "#7FA0D6"); row(top - 7.6 - 3.0 * i, sw - 2.5 - (i % 2) * 2, "#D3D8E0"); }
  } else { // 修图：照片 + 滤镜滑杆
    const g = c.createLinearGradient(0, top - 2, 0, sy0 + 7);
    g.addColorStop(0, "#F2B77E"); g.addColorStop(0.55, "#D98C6A"); g.addColorStop(1, "#4B6A8A"); c.fillStyle = g; c.fillRect(sx0, sy0 + 6, sw, sh - 7);
    const u = seg(t, s2, s3, E.sine), y = sy0 + 3.2;
    line([[sx0 + 1.2, y], [sx0 + sw - 1.2, y]], lw(4), "#B8C2CF"); dot([sx0 + 1.2 + (sw - 2.4) * (0.2 + 0.6 * u), y], 0.6, "#3E7BD6");
    txt(G.T["s.filter"], [sx0 + 1.2, y + 1.5], 1.1, "#5A6577", { font: "sans", align: "left" });
  }
  if (t >= b.crack[0]) { // 像素裂成一格格数字；数字飞走后屏幕只剩黑
    const n = d.cols * d.rows, cw = sw / d.cols, ch = sh / d.rows;
    c.fillStyle = `rgba(20,22,26,${seg(t, b.crack[1] - 0.2, b.spill[0] + 0.3, E.lin)})`; c.fillRect(sx0, sy0, sw, sh);
    for (let i = 0; i < n; i++) {
      const dg = d.digs[i], u = seg(t, b.crack[0] + (i * 37 % n) / n * 0.6, b.crack[0] + (i * 37 % n) / n * 0.6 + 0.2, E.lin);
      if (u <= 0 || t >= dg.t1) continue;
      const x = sx0 + (i % d.cols + 0.5) * cw, y2 = sy0 + (Math.floor(i / d.cols) + 0.5) * ch;
      c.fillStyle = `rgba(30,38,56,${0.9 * u})`; c.fillRect(x - cw / 2 + 0.05, y2 - ch / 2 + 0.05, cw - 0.1, ch - 0.1);
      txt(dg.v, [x, y2], 1.0, "#EDF1F7", { font: "print", alpha: u });
    }
  }
  c.restore();
}
export const phoneAt = (t) => { // 手机中心与离场（向右上方被拿走）
  const d = G.D.d0, [a, b] = G.D.b.phoneOut, u = seg(t, a, b, E.i2);
  return [lerp(d.phone.c[0], d.exit[0], u), lerp(d.phone.c[1], d.exit[1], u)];
};
// ---- 溢出与收拢中的数字（封面上方的透明层）----
export function drawFx(t) {
  const d = G.D.d0, b = G.D.b;
  if (t < b.spill[0] || t > b.gather[1] + 0.1) return false;
  world();
  for (const g of d.digs) {
    if (t < g.t1) continue;
    const u = seg(t, g.t1, g.t1 + 0.7, E.o2), v = seg(t, g.t2, g.t2 + 0.8, E.io2), T = [d.mc[0] + d.tgt[g.g][0], d.mc[1] + d.tgt[g.g][1]];
    let p = [lerp(g.p0[0], g.p1[0], u), lerp(g.p0[1], g.p1[1], u) + 3 * Math.sin(Math.PI * u)];
    p = [lerp(p[0], T[0], v), lerp(p[1], T[1], v)];
    txt(g.v, p, lerp(1.6, 3.0, v), G.C.ink, { font: "print", alpha: 1 - v });
  }
  return true;
}
function cover(t) {
  const d = G.D.d0, b = G.D.b, a = seg(t, b.gather[1] - 0.6, b.gather[1], E.sine);
  if (a <= 0) return;
  const top = d.mc[1] + 7.2; // 数字底下那张小纸片的上沿
  if (t > b.peek[0]) { // 兔子从数字后面探出头：只露出方块上沿以上的部分
    G.ctx.save(); clipRect([d.mc[0] - 10, top - 0.2, d.mc[0] + 14, top + 12]);
    const u = seg(t, b.peek[0], b.peek[1], E.o3);
    drawAnimal({ kind: "rabbit", x: d.mc[0] + 4.6, y: top - 7.6 + 4.6 * u, sc: 2.2, face: -1, lift: 0, shown: true });
    G.ctx.restore();
  }
  world();
  G.ctx.fillStyle = G.C.paper; G.ctx.beginPath(); G.ctx.roundRect(d.mc[0] - 9, d.mc[1] - 7.2, 18, 14.4, 1.2); ga(a); G.ctx.fill(); ga(1);
  pmatrix(d.mc, [[1, 1], [2, 4]], 5.0, [G.C.chickT, G.C.rabbitT], 6.4, 6.4, a);
}

// ---- 1a：笼子（铅笔），每层一条地面；左墙先画，动物进完再画右墙 ----
function cage1a(t, liftK = null) {
  const D = G.D, K = D.cage1a, b = D.b.cage, P = G.C.pencil, top = K.y0 + K.tier * K.n;
  const u = seg(t, b[0], b[1], E.lin), v = seg(t, b[2], b[3], E.lin);
  for (let i = 0; i <= K.n; i++) line(partial([[K.x0, K.y0 + K.tier * i], [K.x1, K.y0 + K.tier * i]], u), lw(i === 0 || i === K.n ? 3.4 : 2.6), P);
  line(partial([[K.x0, K.y0], [K.x0, top]], u), lw(3.4), P);
  if (v > 0) line(partial([[K.x1, top], [K.x1, K.y0]], v), lw(3.4), P);
  for (const a of animals(D, t)) if (a.page === "p1") drawAnimal(a, t, liftK);
  const dk = 1 - 0.6 * G.dim; void dk;
}
function feetDots(t) {
  const D = G.D, [t0, dt] = D.b.dots;
  if (t < t0) return 0;
  const fs = [];
  for (const a of animals(D, t)) if (a.page === "p1") for (const f of feet(a)) fs.push(f);
  fs.sort((p, q) => (Math.abs(p[1] - q[1]) > 0.5 ? p[1] - q[1] : p[0] - q[0]));
  const n = Math.min(fs.length, Math.floor((t - t0) / dt) + 1);
  for (let i = 0; i < n; i++) dot([fs[i][0], fs[i][1] + 0.15], 0.42, G.C.red);
  return n;
}
function p1(t) {
  ga(1 - 0.6 * G.dim); cage1a(t); ga(1);
  const n = feetDots(t), a = G.D.ann.find((x) => x.id === "cnt");
  if (n > 0) txt(String(n), a.p, a.size, G.C.redT, { align: a.align, alpha: 1 - 0.6 * G.dim });
}
// ---- p2：左上是 1a 笼子的缩略（1b 里重放抬脚），右上是 1d 的小笼子；下方是 1d 立体图的纸面部分（阴影）----
function p2(t) {
  const D = G.D, th = D.thumb, K = D.cage1a, c = G.ctx;
  c.save(); c.translate(th.o[0], th.o[1]); c.scale(th.s, th.s); c.translate(-K.x0, -K.y0);
  ga(1 - 0.6 * G.dim); cage1a(Math.max(t, D.b.cage[3] + 0.01), tr(D, "thumbLift", t)); ga(1); c.restore();
  const q = D.d1d, bq = D.b.cage1d;
  if (t >= bq[0]) {
    const u = seg(t, bq[0], bq[1], E.lin), [x0, y0, x1, y1] = q.cage, P = G.C.pencil;
    ga(1 - 0.6 * G.dim);
    line(partial([[x0, y1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]], u), lw(3), P);
    line(partial([[x0, y0 + 4.5], [x1, y0 + 4.5]], u), lw(2.4), P);
    for (const a of animals(D, t)) if (a.page === "p2") drawAnimal(a, t);
    ga(1);
  }
  const pop = tr(D, "pop1d", t);
  if (pop > 0.01) { // 立起的平面在纸上的投影（光从左上来）
    for (const [i, pl] of q.planes.entries()) {
      const g = tr(D, `pl${i}`, t); if (g <= 0) continue;
      const S = q.sol, pts = pl.pts.map((p) => { const r = S.map((s, k) => s + (p[k] - s) * g), z = r[2] * q.s * pop; return [q.o[0] + r[0] * q.s + 0.35 * z, q.o[1] + r[1] * q.s - 0.55 * z]; });
      c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); ga(0.07 * pop); c.fillStyle = "#3A2A1A"; c.fill(); ga(1);
    }
  }
}
// ---- p3：上半 1b（全是文字标注），下半 1c 坐标系 ----
function p3(t) {
  const D = G.D, g = D.g1c, b = D.b, C = G.C, W = (x, y) => [g.o[0] + x * g.s, g.o[1] + y * g.s], k = G.dim;
  if (t < b.axes1c[0]) return;
  const u = seg(t, b.axes1c[0], b.axes1c[1], E.lin), H = C.hand;
  ga(1 - 0.6 * k);
  line(partial([W(0, 0), W(41.5, 0)], u), lw(3), H); line(partial([W(0, 0), W(0, 42.5)], u), lw(3), H);
  for (let i = 1; i <= 4; i++) { if (u < 1) break; line([W(10 * i, 0), W(10 * i, -1.2)], lw(3), H); line([W(0, 10 * i), W(-1.2, 10 * i)], lw(3), H); }
  ga(1);
  const l1 = seg(t, b.line1[0], b.line1[1], E.lin), l2 = seg(t, b.line2[0], b.line2[1], E.lin);
  if (l1 > 0) glowLine(partial([W(0, 35), W(35, 0)], l1), lw(4.5), C.chick, k);
  if (l2 > 0) glowLine(partial([W(0, 23.5), W(40, 3.5)], l2), lw(4.5), C.rabbit, k);
  if (t >= b.slide1[0] - 0.3 && t < D.segs["1e"]) {
    const x = slideX(D, t), a = win(t, b.slide1[0] - 0.3, D.segs["1e"], 0.3, 0.3);
    ga(a * (1 - 0.6 * k)); dot(W(x, 35 - x), 0.55, C.red); ga(1);
  }
}
export const PAGES_A = { cover, p1, p2, p3 };
void mixHex; void clamp01; void txt;
