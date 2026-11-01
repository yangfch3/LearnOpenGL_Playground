// 2a–2e：右页 p7「头–脚」坐标纸（格子、箭头链、矩阵），左页 p6（1c 缩小图、笼子小窗、图例箭头）。跨页的飞行物两页都画，各自裁在页内
import { G, lw, world, line, dot, arrow, txt, penRing, mixHex, ga, clipRect, partial, pmatrix } from "./paper.js";
import { seg, win, E, lerp, matAt, mv, det, animals, sweepAt, grW, glW, keyW, tr, latM, textW } from "./world.js";
import { drawAnimal } from "./animals.js";

const L = () => G.D.L2;
const annBy = (id) => G.D.ann.find((a) => a.id === id);
const duckU = (t) => { const f = G.D.b.flat; return seg(t, f[0], f[0] + 0.4 * (f[1] - f[0]), E.sine); };
const mcell = (i, j) => { const l = L(); return [l.mat[0] + (j - 0.5) * l.matc.dx, l.mat[1] - (i - 0.5) * l.matc.dy]; };
const subX = (a, i) => { const s = G.T[a.key]; return a.p[0] + textW(s.slice(0, i), a.size) + textW(s[i], a.size) / 2; };
const RL = [30, 10]; // 2c 红线：兔 = 10，鸡 0..30（像落在右页 40 头以内）
// 对应关系的一闪：同色宽描边垫在下面
function flash(pts, k, col) { if (k > 0.01) { ga(0.35 * k); line(pts, lw(16), col); ga(1); } }

// 2b：系数、未知数、右边的数从左页方程组飞到右页的矩阵写法里
function pullItems() {
  const e1 = annBy("eq1"), e2 = annBy("eq2a"), l = L(), dy = l.matc.dy / 2, C = G.C, y1 = e1.p[1], y2 = e2.p[1];
  return [
    { s: "1", a: [subX(e1, 2), y1 + 1.8], b: mcell(0, 0), col: "chick" }, { s: "1", a: [subX(e1, 6), y1 + 1.8], b: mcell(0, 1), col: "rabbit" },
    { s: "2", a: [subX(e2, 2), y2], b: mcell(1, 0), col: "chick" }, { s: "4", a: [subX(e2, 7), y2], b: mcell(1, 1), col: "rabbit" },
    { s: "x", a: [subX(e1, 2), y1], b: [l.vec1[0], l.vec1[1] + dy], col: "ink", f: "math" }, { s: "y", a: [subX(e1, 6), y1], b: [l.vec1[0], l.vec1[1] - dy], col: "ink", f: "math" },
    { s: "35", a: [subX(e1, 10) + 0.6, y1], b: [l.vec2[0], l.vec2[1] + dy], col: "ink" }, { s: "94", a: [subX(e2, 12) + 0.6, y2], b: [l.vec2[0], l.vec2[1] - dy], col: "ink" },
  ].map((it, i) => ({ ...it, i, C }));
}
const pullU = (t, i) => { const [p0] = G.D.b.pull; return seg(t, p0 + 0.16 * i, p0 + 0.16 * i + 1.0, E.io2); };
function flyers(t) { // 两页共用：飞行中的系数、穿过矩阵的点
  const D = G.D, b = D.b, C = G.C;
  if (t >= b.pull[0] && t <= b.pull[1] + 1.2) for (const it of pullItems()) {
    const u = pullU(t, it.i); if (u <= 0 || u >= 1) continue;
    const p = [lerp(it.a[0], it.b[0], u), lerp(it.a[1], it.b[1], u) + 5 * Math.sin(Math.PI * u)];
    txt(it.s, p, lerp(2.4, L().matc.size, u), it.col === "ink" ? C.ink : mixHex(C.ink, C[it.col + "T"], seg(t, b.colTint[0], b.colTint[1])), { font: it.f || "print" });
  }
  const m = L().mat;
  for (const [k, a, z] of [["in1", glW(L(), 10, 5), grW(L(), 15, 40)], ["in2", glW(L(), 23, 12), grW(L(), 35, 94)], ["rev", grW(L(), 35, 94), glW(L(), 23, 12)]]) {
    const [t0, t1] = b[k]; if (t < t0 || t > t1) continue;
    const u = seg(t, t0, t1, E.io2), h = u < 0.5 ? u * 2 : (u - 0.5) * 2, P = u < 0.5 ? [a, [m[0], m[1] + 4]] : [[m[0], m[1] + 4], z];
    const p = [lerp(P[0][0], P[1][0], h), lerp(P[0][1], P[1][1], h) + 3 * Math.sin(Math.PI * h)];
    dot(p, 0.7, C.red);
  }
  const [c0, c1, c2] = b.colLink; // 每一列连到图例里的那根箭头
  if (t > c0 && t < c2 + 0.4) {
    const a = 1 - seg(t, c2, c2 + 0.4, E.sine), u = seg(t, c0, c1, E.lin), M = matAt(D, "M", t);
    for (const j of [0, 1]) {
      const s = mcell(1, j), e = keyW(L(), [M[0][j], M[1][j]]), q = [s[0], s[1] - 2.2], m2 = [(q[0] + e[0]) / 2, Math.min(q[1], e[1]) - 6], pts = [];
      for (let i = 0; i <= 30; i++) { const v = i / 30; pts.push([(1 - v) ** 2 * q[0] + 2 * v * (1 - v) * m2[0] + v * v * e[0], (1 - v) ** 2 * q[1] + 2 * v * (1 - v) * m2[1] + v * v * e[1]]); }
      ga(a); line(partial(pts, u), lw(3), j ? C.rabbit : C.chick, [lw(10), lw(7)]); ga(1);
    }
  }
}

function p7(t) {
  const D = G.D, l = L(), C = G.C, b = D.b, o = l.gr.o, W = (h, f) => grW(l, h, f), c = G.ctx;
  if (t < b.axes2[0]) return;
  const M = matAt(D, "M", t), Lm = latM(D, t), col2 = mixHex(C.rabbit, C.duck, duckU(t));
  const la = tr(D, "latt", t);
  if (la > 0) { // 变形后的格子：铺满平面、裁到坐标纸内；平时很浅，纸被变形时提起来
    c.save(); clipRect([o[0], o[1], o[0] + l.gr.hmax, o[1] + l.gr.fmax * l.gr.sy]);
    const st = l.gr.step, R = 400, c1 = [Lm[0][0], Lm[1][0]], c2 = [Lm[0][1], Lm[1][1]];
    const wins = D.mats.M.keys.map((k) => [k[0], k[1]]).concat([[D.tracks.latU.keys[0][0], D.tracks.latU.keys[0][1]]]);
    const emph = Math.max(0, ...wins.map(([t0, t1]) => Math.min(seg(t, t0 - 0.6, t0, E.sine), 1 - seg(t, t1 + 0.4, t1 + 1.4, E.sine))));
    for (const [dir, other, col] of [[c1, c2, C.chick], [c2, c1, col2]]) {
      c.beginPath();
      for (let j = -150; j <= 150; j += st) {
        const p = W(j * other[0] - R * dir[0], j * other[1] - R * dir[1]), q = W(j * other[0] + R * dir[0], j * other[1] + R * dir[1]);
        c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]);
      }
      c.strokeStyle = col; c.lineWidth = lw(2); ga(la * (0.13 + 0.22 * emph)); c.stroke(); ga(1);
    }
    const ce = tr(D, "cell", t), aa = seg(t, b.areaShow ?? 1e9, (b.areaShow ?? 1e9) + 0.5, E.sine);
    const q = [[0, 0], [st * c1[0], st * c1[1]], [st * (c1[0] + c2[0]), st * (c1[1] + c2[1])], [st * c2[0], st * c2[1]]].map((p) => W(p[0], p[1]));
    if (aa > 0) { c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); ga(0.12 * aa); c.fillStyle = C.ink; c.fill(); ga(0.7 * aa); c.strokeStyle = C.ink; c.lineWidth = lw(2.2); c.stroke(); ga(1); }
    if (ce > 0) {
      ga(ce); line([q[0], q[1]], lw(5), C.chick); line([q[0], q[3]], lw(5), C.rabbit); ga(1);
      flash([q[0], q[1]], tr(D, "fC", t), C.chick); flash([q[0], q[3]], tr(D, "fR", t), C.rabbit);
    }
    c.restore();
  }
  const u = seg(t, b.axes2[0], b.axes2[1], E.lin), H = C.hand;
  line(partial([W(0, 0), [o[0] + 41.5, o[1]]], u), lw(3), H); line(partial([W(0, 0), [o[0], o[1] + 26.5]], u), lw(3), H);
  if (u >= 1) { for (let k = 1; k <= 4; k++) line([W(10 * k, 0), [W(10 * k, 0)[0], o[1] - 0.6]], lw(3), H); for (let k = 1; k <= 5; k++) line([W(0, 20 * k), [o[0] - 0.6, W(0, 20 * k)[1]]], lw(3), H); }
  const [r0, r1, r2] = b.redLine; // 2c：左页「兔 = 10」那条线上每一点，送进矩阵后落在右页这条线上；两端笔尖同步
  if (t > r0 && t < r2 + 0.4) {
    const u = seg(t, r0, r1, E.lin), P = (x) => W(Lm[0][0] * x + Lm[0][1] * RL[1], Lm[1][0] * x + Lm[1][1] * RL[1]);
    ga(1 - seg(t, r2, r2 + 0.4, E.sine)); line(partial([P(0), P(RL[0])], u), lw(4), C.red); dot(P(RL[0] * u), lw(7), C.red); ga(1);
  }
  // 箭头链：鸡箭头一根根接上，之后是兔（鸭）箭头；「怎么分都对」时鸡的只数在变
  const shown = b.chain.filter((x) => x <= t).length, sw = sweepAt(D.sweep || [], t), nC = sw ? sw.k : 23;
  const c1 = [M[0][0], M[1][0]], c2 = [M[0][1], M[1][1]];
  let p = [0, 0];
  for (let i = 0; i < shown; i++) {
    const v = i < nC ? c1 : c2, q = [p[0] + v[0], p[1] + v[1]], g = seg(t, b.chain[i], b.chain[i] + 0.12, E.o2);
    arrow(W(p[0], p[1]), W(p[0] + v[0] * g, p[1] + v[1] * g), lw(3), i < nC ? C.chick : col2, lw(8)); p = q;
  }
  if (shown >= 35) dot(W(p[0], p[1]), lw(6), C.ink);
  for (const k of ["in1", "in2"]) if (t >= b[k][1]) { const z = k === "in1" ? W(15, 40) : null; if (z) dot(z, 0.5, C.ink); }
  if (b.reach) {
    const [q0, q1, q2] = b.reach, ra = 1 - seg(t, q2, q2 + 0.3, E.sine);
    if (t > q0 && ra > 0) { const a = W(35, 70), e = W(35, 94); ga(ra); line([a, [a[0], lerp(a[1], e[1] - 1.4, seg(t, q0, q1, E.o2))]], lw(3), C.red, [lw(9), lw(7)]); ga(1); }
  }
  matrix(t, M);
  flyers(t);
}
function matrix(t, M) {
  const D = G.D, b = D.b, l = L(), C = G.C, mc = l.matc, tint = seg(t, b.colTint[0], b.colTint[1]);
  const br = seg(t, b.brk[0], b.brk[1], E.lin);
  if (br <= 0 && t < b.pull[0]) return;
  const cols = [mixHex(C.ink, C.chickT, tint), mixHex(C.ink, mixHex(C.rabbitT, C.duckT, duckU(t)), tint)], items = pullItems();
  const vals = M.map((r, i) => r.map((v, j) => (pullU(t, i * 2 + j) >= 1 ? v : "")));
  pmatrix(l.mat, vals, mc.size, cols, mc.dx, mc.dy, 1, 1, br);
  const va = tr(D, "vecs", t, 1);
  if (va > 0) {
    const sub = (k) => items.filter((it) => it.i >= k && it.i < k + 2).map((it) => [pullU(t, it.i) >= 1 ? it.s : ""]);
    pmatrix(l.vec1, sub(4), mc.size, [C.ink], 0, mc.dy, va, 1, br);
    pmatrix(l.vec2, sub(6), mc.size, [C.ink], 0, mc.dy, va, 1, br);
    txt("=", l.eqs, mc.size, C.ink, { font: "print", alpha: va * br });
  }
}

function p6(t) {
  const D = G.D, l = L(), C = G.C, b = D.b, Wl = (x, y) => glW(l, x, y), c = G.ctx;
  if (t < D.segs["2a"]) return;
  const H = C.hand, u = seg(t, b.axes2[0], b.axes2[1], E.lin);
  line(partial([Wl(0, 0), Wl(41.6, 0)], u), lw(3), H); line(partial([Wl(0, 0), Wl(0, 41.6)], u), lw(3), H);
  if (u >= 1) for (let k = 1; k <= 4; k++) { line([Wl(10 * k, 0), Wl(10 * k, -1.2)], lw(3), H); line([Wl(0, 10 * k), Wl(-1.2, 10 * k)], lw(3), H); }
  const ll = tr(D, "latL", t);
  c.save(); clipRect([...Wl(0, 0), ...Wl(40, 40)]);
  if (ll > 0) { // 2c：左边的「鸡数–兔数」方格（每 5 只一格）
    ga(0.3 * ll); for (let k = 5; k <= 40; k += 5) { line([Wl(k, 0), Wl(k, 40)], lw(2), C.chick); line([Wl(0, k), Wl(40, k)], lw(2), C.rabbit); } ga(1);
  }
  line([Wl(0, 35), Wl(35, 0)], lw(5), C.chick);
  const gh = seg(t, b.ghost?.[0] ?? 1e9, b.ghost?.[1] ?? 1e9, E.sine);
  if (gh > 0) { ga(gh); line([Wl(0, 35), Wl(35, 0)], lw(3), C.duck, [lw(10), lw(8)]); ga(1); }
  const [la, lb, lc] = tr(D, "l2", t, [2, 4, 94]), eb = D.ann.find((a) => a.id === "eq2b");
  line([Wl(0, lc / lb), Wl(40, (lc - 40 * la) / lb)], lw(3.2), mixHex(C.rabbit, C.duck, eb ? seg(t, eb.w[0], eb.w[1], E.sine) : 0));
  const [r0, r1, r2] = b.redLine;
  if (t > r0 && t < r2 + 0.4) {
    const u = seg(t, r0, r1, E.lin);
    ga(1 - seg(t, r2, r2 + 0.4, E.sine)); line(partial([Wl(0, RL[1]), Wl(RL[0], RL[1])], u), lw(4), C.red); dot(Wl(RL[0] * u, RL[1]), lw(7), C.red); ga(1);
  }
  c.restore();
  for (const k of ["in1", "in2"]) if (t >= b[k][0]) dot(k === "in1" ? Wl(10, 5) : Wl(23, 12), 0.5, C.ink);
  const sw = sweepAt(D.sweep || [], t), lo = 1 - seg(t, b.litOff ?? 1e9, (b.litOff ?? 1e9) + 0.4, E.sine);
  if (sw && lo > 0) { // 走过的分法逐个亮起：x + y = 35 上的整数点
    ga(lo); for (let k = sw.lo; k <= sw.hi; k++) dot(Wl(k, 35 - k), lw(5), C.red);
    if (t < D.sweep[D.sweep.length - 1][0] + 0.3) penRing(Wl(sw.k, 35 - sw.k), lw(14), lw(3), C.red); ga(1);
  }
  if (t >= b.ones[0] && t < b.pull[1] + 1.2) { // 隐含的系数 1
    const e1 = annBy("eq1"), a = seg(t, b.ones[0], b.ones[1], E.sine);
    for (const i of [2, 6]) if (pullU(t, i === 2 ? 0 : 1) <= 0) txt("1", [subX(e1, i), e1.p[1] + 1.8], 1.6, C.hand, { alpha: a });
  }
  vignette(t);
  flyers(t);
}
function vignette(t) {
  const D = G.D, l = L(), V = l.vg, C = G.C, b = D.b, c = G.ctx, [x0, y0, x1, y1] = V.box, M = matAt(D, "M", t);
  c.save();
  c.beginPath(); c.roundRect(x0, y0, x1 - x0, y1 - y0, 0.8); c.fillStyle = C.paper; ga(0.92); c.fill(); ga(1);
  c.strokeStyle = C.pencil; c.lineWidth = lw(2.5); c.stroke(); c.clip();
  const [cx0, cy0, cx1, cy1] = V.cage, P = C.pencil, w = lw(2.6);
  for (const a of animals(D, t)) if (a.page === "p6") {
    const k = a.id === "vc" ? b.keyC : a.id === "vr" ? b.keyR : null, j = k ? seg(t, k[0], k[0] + 0.36, E.lin) : 0;
    drawAnimal({ ...a, y: a.y + (j > 0 && j < 1 ? 1.2 * Math.sin(Math.PI * j) : 0) }, t); // 被点到名时原地一跳
  }
  line([[cx0 - 0.4, cy0], [cx1 + 0.4, cy0]], lw(3), P); line([[cx0 - 0.4, cy1], [cx1 + 0.4, cy1]], lw(3), P);
  for (let x = cx0; x < cx1 - 0.1; x += 1.75) line([[x, cy0], [x, cy1]], w, P);
  line([[cx1, V.hinge[1]], [cx1, cy1]], w, P);
  const [d0, d1, d2, d3] = b.door, ang = (seg(t, d0, d1, E.o2) - seg(t, d2, d3, E.io2)) * 1.45; // 门挂在上沿，向外掀起
  c.save(); c.translate(V.hinge[0], V.hinge[1]); c.rotate(ang);
  const hgt = V.hinge[1] - cy0; line([[0, 0], [0, -hgt]], lw(3), P); line([[-0.6, -hgt * 0.5], [0, -hgt * 0.5]], w, P); c.restore();
  c.restore();
  // 图例：放大的鸡、兔（鸭）箭头，跟着纸一起被推
  const o = V.ko, c1 = [M[0][0], M[1][0]], c2 = [M[0][1], M[1][1]];
  for (const [k, from, v, col] of [["keyC", [-13.8, 9.5], c1, C.chick], ["keyR", [-7.5, 9.5], c2, C.rabbit]]) {
    const [, k1, k2] = b[k], dl = seg(t, k1, k2, E.lin), dla = 1 - seg(t, k2 + 0.6, k2 + 1.2, E.sine);
    if (dl > 0 && dla > 0) { ga(dla); line(partial([from, keyW(l, [v[0] * 0.5, v[1] * 0.5])], dl), lw(2.6), P, [lw(8), lw(6)]); ga(1); }
  }
  const g1 = seg(t, b.keyC[2], b.keyC[2] + 0.5, E.o3), g2 = seg(t, b.keyR[2], b.keyR[2] + 0.5, E.o3);
  const a2 = 1 - seg(t, b.duckKey[0], b.duckKey[1], E.sine), du = seg(t, b.duckKey[1], b.duckKey[2], E.o3);
  for (const [k, v, col] of [["fC", c1, C.chick], ["fR", c2, C.rabbit]]) flash([o, keyW(l, v)], tr(D, k, t), col);
  if (du > 0) arrow(o, keyW(l, [du, 2 * du]), lw(5), C.duck, lw(19), lw(4));
  if (a2 > 0 && g2 > 0) { ga(a2); arrow(o, keyW(l, [c2[0] * g2, c2[1] * g2]), lw(5), C.rabbit, lw(19)); ga(1); }
  if (g1 > 0) arrow(o, keyW(l, [c1[0] * g1, c1[1] * g1]), lw(5), C.chick, lw(19));
  if (g1 > 0) dot(o, lw(6), C.ink);
}
export const PAGES_C = { p6, p7 };
void win; void mv; void det; void world;
