// 纸上标注的通用画法：文字（逐字写出）、红笔圈、红笔连线、印刷体矩阵、大括号。位置与时间窗都来自数据
import { G, lw, world, line, txt, penRing, pmatrix, partial, ga, measureW } from "./paper.js";
import { seg, E, labels, dynLabels } from "./world.js";

export const HL = "#F4D35E"; // 荧光笔
const colOf = (c) => (c === "hand" ? (G.pid === "p1" ? G.C.pencil : G.C.hand) : c === "red" ? G.C.red : c === "ink" ? G.C.ink : G.C[c + "T"] || G.C[c] || c);
let cacheT = -1, cache = [];
function all(t) {
  if (t !== cacheT) { cacheT = t; cache = labels(G.D, G.T, t).concat(dynLabels(G.D, G.T, t)); }
  return cache;
}
export function drawAnn(pid, t, filt = null) {
  world();
  const dimK = 1 - 0.6 * G.dim;
  for (const a of all(t)) {
    if (a.page !== pid || (filt && !filt(a))) continue;
    const u = a.w ? (a.w[0] < 0 ? 1 : seg(t, a.w[0], a.w[1], E.lin)) : 1, al = a.alpha * dimK;
    if (a.kind === "live" || a.kind === "box") continue;
    if (a.kind === "ring") {
      let p = a.p;
      if (a.sub) { // 圈住某条文字里的几个字：按实测字宽算圈心
        const tg = G.D.ann.find((x) => x.id === a.sub.of), s = tg.key ? G.T[tg.key] : tg.s, W = measureW(s, tg.size, tg.font);
        const x0 = tg.align === "left" ? tg.p[0] : tg.align === "right" ? tg.p[0] - W : tg.p[0] - W / 2;
        p = [x0 + measureW(s.slice(0, a.sub.i), tg.size, tg.font) + measureW(s.substr(a.sub.i, a.sub.n), tg.size, tg.font) / 2, tg.p[1]];
      }
      ga(al); penRing(p, a.r, lw(3.2), G.C.red, u, a.dash ? [lw(9), lw(7)] : null); ga(1); continue;
    }
    if (a.kind === "link") { // 红笔连线：两端之间的一条弧，末端一个小箭头
      const { a: p, b: q } = a.ab, m = [(p[0] + q[0]) / 2, Math.max(p[1], q[1]) + 3.0], pts = [];
      for (let i = 0; i <= 30; i++) { const s = i / 30; pts.push([(1 - s) ** 2 * p[0] + 2 * s * (1 - s) * m[0] + s * s * q[0], (1 - s) ** 2 * p[1] + 2 * s * (1 - s) * m[1] + s * s * q[1]]); }
      ga(al); line(partial(pts, u), lw(3.2), G.C.red); ga(1); continue;
    }
    if (a.kind === "pmat") { pmatrix(a.p, a.vals, a.size, a.cols.map(colOf), a.dx, a.dy, al, u); continue; }
    if (a.font === "brace") { brace(a.box, colOf(a.col), al, u); continue; }
    if (a.hl && a.str) { // 点题的词：荧光笔先划过，再写字
      const W = measureW(a.str, a.size, a.font), x0 = a.align === "left" ? a.p[0] : a.align === "right" ? a.p[0] - W : a.p[0] - W / 2, c = G.ctx;
      ga(0.45 * al); c.fillStyle = HL; c.fillRect(x0 - 0.4, a.p[1] - a.size * 0.5, (W + 0.8) * Math.min(1, u * 1.6), a.size * 0.8); ga(1);
    }
    if (a.str) txt(a.str, a.p, a.size, colOf(a.col), { align: a.align, alpha: al, reveal: u, font: a.font });
  }
}
// 手写大括号：左侧一道带尖的弧
export function brace(b, color, alpha, u) {
  const [x0, y0, x1, y1] = b, xm = (x0 + x1) / 2, pts = [];
  for (let i = 0; i <= 48; i++) { // 两端向右卷、中间向左出尖
    const s = i / 48, d = Math.min(s, 1 - s);
    pts.push([xm + (x1 - xm) * Math.max(0, 1 - d / 0.1) ** 2 - (xm - x0) * Math.max(0, 1 - (0.5 - d) / 0.08) ** 2, y1 - (y1 - y0) * s]);
  }
  ga(alpha); line(partial(pts, u), lw(3.2), color); ga(1);
}
