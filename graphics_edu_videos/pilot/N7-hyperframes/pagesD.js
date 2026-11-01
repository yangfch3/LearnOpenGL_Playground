// 2f：两台机器接着开。左页 p8 先转再拉，右页 p9 先拉再转；同一只兔子与它所在的格子一起被变换
import { G, lw, line, ga, clipRect } from "./paper.js";
import { tr } from "./world.js";
import { drawAnimal } from "./animals.js";

function machine(o, M, sc) {
  const c = G.ctx, C = G.C, n = 4, st = 3.0, h = G.D.d2f.half;
  c.save(); clipRect([o[0] - h, o[1] - h, o[0] + h, o[1] + h]);
  c.save(); c.translate(o[0], o[1]); c.transform(M[0][0], M[1][0], M[0][1], M[1][1], 0, 0);
  ga(0.3);
  for (let k = -n; k <= n; k++) { line([[k * st, -n * st], [k * st, n * st]], lw(2), C.grid); line([[-n * st, k * st], [n * st, k * st]], lw(2), C.grid); }
  ga(1);
  line([[-n * st, 0], [n * st, 0]], lw(2.6), C.hand); line([[0, -n * st], [0, n * st]], lw(2.6), C.hand);
  drawAnimal({ kind: "rabbit", x: 0, y: -1.75 * sc, sc, face: 1, lift: 0, shown: true });
  c.restore(); c.restore();
}
const R = (deg) => { const a = (deg * Math.PI) / 180; return [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]]; };
const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
function p8(t) {
  const D = G.D, d = D.d2f; if (!d || t < D.segs["2f"]) return;
  machine(d.oL, mul([[tr(D, "sxL", t, 1), 0], [0, 1]], R(tr(D, "rotL", t))), d.sc);
}
function p9(t) {
  const D = G.D, d = D.d2f; if (!d || t < D.segs["2f"]) return;
  machine(d.oR, mul(R(tr(D, "rotR", t)), [[tr(D, "sxR", t, 1), 0], [0, 1]]), d.sc);
}
export const PAGES_D = { p8, p9 };
