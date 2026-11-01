// 1e 寻宝地图（向量）、1f 外卖回归直线（p5），1-post 叠在左页 p4 上的「直的东西」
import { G, lw, world, line, dot, txt, partial, ga, arrow, penRing, glowLine, poly } from "./paper.js";
import { seg, E, lerp, clamp01, tr } from "./world.js";

function p5(t) {
  const D = G.D, b = D.b, C = G.C, k = G.dim;
  const e = D.d1e, V = (v, o = e.S) => [o[0] + v[0] * e.st, o[1] + v[1] * e.st];
  if (t >= b.map[0]) { // 罗盘与宝藏
    const u = seg(t, b.map[0], b.map[1], E.lin), cx = [42.0, 24.4];
    ga(1 - 0.6 * k);
    arrow(cx, [cx[0], cx[1] + 3.0 * u], lw(3), C.hand, lw(10)); arrow(cx, [cx[0] + 2.4 * u, cx[1]], lw(3), C.hand, lw(10));
    const T = e.tre, s = 0.9 * u; line([[T[0] - s, T[1] - s], [T[0] + s, T[1] + s]], lw(3.4), C.hand); line([[T[0] - s, T[1] + s], [T[0] + s, T[1] - s]], lw(3.4), C.hand);
    dot(e.S, 0.4, C.hand); ga(1);
  }
  const [w0, wd] = b.walk;
  if (t >= w0) { // 一步一步走：脚印 + 小点
    const n = Math.min(5, (t - w0) / wd), i = Math.floor(n), f = E.io2(n - i);
    ga(1 - 0.6 * k);
    for (let j = 1; j <= Math.min(i, 5); j++) dot(e.walk[j], 0.28, C.hand);
    if (t < b.va[1] + 0.4) { const p = i >= 5 ? e.walk[5] : [lerp(e.walk[i][0], e.walk[i + 1][0], f), lerp(e.walk[i][1], e.walk[i + 1][1], f) + 0.8 * Math.sin(Math.PI * f)]; dot(p, 0.55, C.red); }
    ga(1);
  }
  const va = seg(t, b.va[0], b.va[1], E.o2), vb = seg(t, b.vb[0], b.vb[1], E.o2), vs = seg(t, b.vs[0], b.vs[1], E.o2);
  if (va > 0) glowArrow(e.S, lerpP(e.S, V([3, 2]), va), C.hand, k);
  if (vb > 0) glowArrow(V([3, 2]), lerpP(V([3, 2]), V([4, 4]), vb), C.hand, k);
  if (vs > 0) glowArrow(e.S, lerpP(e.S, V([4, 4]), vs), C.red, k);
  const [c0, c1, c2] = b.v2a;
  if (t >= c0) { // a 拉长成两倍：先复制一根 a，再拉长
    const g = seg(t, c0, c1, E.o2), h = seg(t, c1 + 0.1, c2, E.io2), tip = V([3 + 3 * h, 2 + 2 * h], e.S2);
    dot(e.S2, 0.4, C.hand); glowArrow(e.S2, lerpP(e.S2, tip, g), C.hand, k);
  }
  p5f(t);
}
const lerpP = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
function glowArrow(a, b, col, k) {
  if (k > 0.01) { ga(0.2 * k); line([a, b], lw(14), col); ga(1); }
  arrow(a, b, lw(4), col, lw(14));
}
function p5f(t) {
  const D = G.D, b = D.b, C = G.C, f = D.d1f, k = G.dim, c = G.ctx;
  if (t < b.axes1f[0]) return;
  const P = (km, mn) => [f.o[0] + km * f.sx, f.o[1] + mn * f.sy], u = seg(t, b.axes1f[0], b.axes1f[1], E.lin), H = C.hand;
  ga(1 - 0.6 * k);
  line(partial([P(0, 0), P(6.4, 0)], u), lw(3), H); line(partial([P(0, 0), P(0, 53)], u), lw(3), H);
  if (u >= 1) for (let i = 1; i <= 6; i++) line([P(i, 0), [P(i, 0)[0], f.o[1] - 0.6]], lw(3), H);
  if (u >= 1) for (let i = 1; i <= 5; i++) line([P(0, 10 * i), [f.o[0] - 0.6, P(0, 10 * i)[1]]], lw(3), H);
  const g = seg(t, b.bag[0], b.bag[1], E.lin);
  if (g > 0) { // 外卖袋
    const x = 10.5, y = -8.5;
    line(partial([[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.3, y + 1.4], [x - 1.3, y + 1.4], [x - 1.6, y - 1.6]], g), lw(3), H);
    line(partial([[x - 0.7, y + 1.4], [x - 0.6, y + 2.4], [x + 0.6, y + 2.4], [x + 0.7, y + 1.4]], g), lw(2.6), H);
  }
  const [p0, pd] = b.pts;
  const fit = b.fit, gi = clamp01((t - fit[1]) / (fit[2] - fit[1])) * (f.path.length - 1), i0 = Math.floor(gi), fr = gi - i0;
  const L = f.path[Math.min(i0, f.path.length - 1)], L2 = f.path[Math.min(i0 + 1, f.path.length - 1)];
  const sl = lerp(L[0], L2[0], fr), ic = lerp(L[1], L2[1], fr);
  const sq = seg(t, fit[1], fit[1] + 0.5, E.sine) * (1 - seg(t, b.f3, b.f3 + 0.6, E.sine));
  for (let i = 0; i < f.km.length; i++) {
    const tb = p0 + pd * Math.floor(i / 25), a = seg(t, tb, tb + 0.35, E.o3);
    if (a <= 0) continue;
    const q = P(f.km[i], f.mn[i]);
    if (sq > 0 && t >= fit[0]) { // 每个点到直线的竖直距离画成小方块
      const yl = P(f.km[i], sl * f.km[i] + ic)[1], s = yl - q[1];
      ga(sq * 0.16); c.fillStyle = C.red; c.fillRect(q[0], Math.min(q[1], yl), Math.abs(s), Math.abs(s)); ga(1);
    }
    ga(a * (1 - 0.6 * k)); dot([q[0], q[1] + (1 - a) * 3], 0.36, C.ink); ga(1);
  }
  if (t >= fit[0]) {
    const a = seg(t, fit[0], fit[0] + 0.4, E.sine), x0 = 0, x1 = 6.2;
    ga(a); glowLine([P(x0, sl * x0 + ic), P(x1, sl * x1 + ic)], lw(4.5), C.hand, k); ga(1);
    const lbl = D.ann.find((x) => x.id === "arealbl"), sse = lerp(f.sse[Math.min(i0, f.sse.length - 1)], f.sse[Math.min(i0 + 1, f.sse.length - 1)], fr);
    if (t >= lbl.t[0]) { // 「总面积」条
      const w = 10 * Math.sqrt(sse / f.sse[0]) * seg(t, lbl.t[0], lbl.t[0] + 0.4, E.sine);
      ga(0.75 * (1 - 0.6 * k)); c.fillStyle = C.red; c.fillRect(lbl.p[0] + 7.2, lbl.p[1] - 0.6, w, 1.2); ga(1);
    }
  }
  if (t >= b.pred[0]) { // 3.2 公里处的竖虚线
    const u2 = seg(t, b.pred[0], b.pred[1], E.lin), x = 3.2, y = f.b * x + f.a;
    ga(1 - 0.6 * k); line(partial([P(x, 0), P(x, y)], u2), lw(3), C.hand, [lw(8), lw(6)]); if (u2 >= 1) dot(P(x, y), 0.5, C.hand); ga(1);
  }
  if (t >= b.cloud[0]) { // 红笔把 100 个点圈成一团，箭头指向那两个数
    const u3 = seg(t, b.cloud[0], b.cloud[1], E.lin), ang = Math.atan2(f.b * f.sy, f.sx);
    ga(1 - 0.6 * k); penRing(P(3.05, f.b * 3.05 + f.a), 17.5, lw(3.2), C.red, u3, null, 5.2, ang);
    const u4 = seg(t, b.toNums[0], b.toNums[1], E.o2), a = P(4.6, 46), m = D.ann.find((x) => x.id === "fml");
    if (u4 > 0) arrow(a, lerpP(a, [m.p[0] + 6.5, m.p[1] - 1.6], u4), lw(3.2), C.red, lw(12));
    ga(1);
  }
}
// 1-post：直的东西逐个叠到左页
function p4(t) {
  const D = G.D, [s0, dt] = D.b.stack, C = G.C, bx = D.d1p.box, cx = (bx[0] + bx[2]) / 2, cy = (bx[1] + bx[3]) / 2;
  if (t < s0) return;
  const k = Math.max(0.35, G.dim), A = (i) => seg(t, s0 + dt * i, s0 + dt * i + 0.6, E.sine);
  const sc = 0.55, W = (x, y) => [cx - 11 + x * sc, cy - 11 + y * sc];
  if (A(0) > 0) { ga(A(0)); glowLine([W(0, 35), W(35, 0)], lw(4.5), C.chick, k); ga(1); }
  if (A(1) > 0) { ga(A(1)); glowLine([W(0, 23.5), W(40, 3.5)], lw(4.5), C.rabbit, k); ga(1); }
  if (A(2) > 0) { ga(A(2) * 0.8); poly([[cx - 14, cy + 6], [cx + 4, cy + 16], [cx + 12, cy - 4], [cx - 6, cy - 12]], "rgba(42,143,163,0.18)", C.fly, lw(3)); ga(1); }
  if (A(3) > 0) { ga(A(3)); arrow([cx - 12, cy - 8], [cx + 6, cy + 4], lw(4), C.hand, lw(14)); arrow([cx + 6, cy + 4], [cx + 12, cy + 16], lw(4), C.hand, lw(14)); arrow([cx - 12, cy - 8], [cx + 12, cy + 16], lw(4), C.red, lw(14)); ga(1); }
  if (A(4) > 0) { ga(A(4)); glowLine([[cx - 16, cy - 14], [cx + 16, cy + 13]], lw(4.5), C.hand, k); ga(1); }
  void txt; void world;
}
export const PAGES_B = { p4, p5 };
