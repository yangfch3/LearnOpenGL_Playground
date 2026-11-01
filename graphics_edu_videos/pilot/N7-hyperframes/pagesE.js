// 下集 3 滤镜的纸面：左页 e0（手机与色卡投在纸上的影、点开像素的色块），右页 e1（便签、立方体底框、图例、偏差条、校正矩阵）
import { G, lw, line, partial, ga, txt, dot, measureW } from "./paper.js";
import { HL } from "./annot.js";
import { seg, E, clamp01, lerp, tr } from "./world.js";

const rgb = (c) => `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")})`;
function rrect(x, y, w, h, r) { const c = G.ctx; c.beginPath(); c.roundRect(x, y, w, h, r); }
// 物体压在纸上的影：光从左上来，离纸越高影子越偏、越淡、越虚
function shadow(cx, cy, w, h, rot, z, a0 = 0.34) {
  const c = G.ctx, f = G.map.f;
  c.save(); c.filter = `blur(${((0.5 + 0.35 * z) * f).toFixed(1)}px)`;
  c.translate(cx + 0.35 * z, cy - 0.55 * z); c.rotate((rot * Math.PI) / 180);
  ga(a0 / (1 + 0.12 * z)); c.fillStyle = "#2B1D12"; rrect(-w / 2, -h / 2, w, h, 1.2); c.fill(); ga(1); c.restore();
}

function e0(t) {
  const F3 = G.F3; if (!F3) return;
  const F = F3.F, b = G.D.b, p = F3.pose(t);
  const cd = tr(G.D, "card", t, [-92, F.card.c[1]]), cw = 6 * F.card.cell + 5 * F.card.gap + 2 * F.card.pad, ch = 4 * F.card.cell + 3 * F.card.gap + 2 * F.card.pad;
  if (cd[0] > -48 - cw) shadow(cd[0], cd[1], cw, ch, 0, F.card.z + 0.3, 0.28);
  shadow(p.x, p.y, F.phone.w, F.phone.h, F.phone.rot, F.phone.th + p.lift);
  if (t >= b.pairs[0]) { // 图例贴着它指的东西：色卡旁 ● 真实，手机旁 ○ 拍出（与立方体里的点同形）
    const a = seg(t, b.pairs[0], b.pairs[0] + 0.4, E.sine), [lp, lq] = F.legend, c = G.ctx;
    ga(a); dot(lp, 0.55, G.C.ink); ga(1);
    ga(a); c.beginPath(); c.arc(lq[0], lq[1], 0.5, 0, 2 * Math.PI); c.strokeStyle = G.C.ink; c.lineWidth = lw(3.2); c.stroke(); ga(1);
  }
  // 点开的那个像素：纸上一块同色的小方块，后面写着它的三个数；三个数与立方体棱上的读数同时亮一下
  if (t >= b.swatch && t < b.f3 + 0.6) {
    const a = seg(t, b.swatch, b.swatch + 0.3, E.sine) * (1 - seg(t, b.f3, b.f3 + 0.3, E.sine)), s = F.swatch, c = G.ctx;
    ga(a); c.fillStyle = rgb(F.tap); c.fillRect(s[0] - 1.2, s[1] - 1.2, 2.4, 2.4); c.strokeStyle = G.C.hand; c.lineWidth = lw(3); c.strokeRect(s[0] - 1.2, s[1] - 1.2, 2.4, 2.4); ga(1);
    for (const sp of F3.sprites(G.T, t)) {
      if (!sp.id.startsWith("axv") || !(sp.pulse > 0)) continue;
      const an = G.D.ann.find((x) => x.id === ["rdR", "rdG", "rdB"][+sp.id[3]]), w = measureW(G.T[["p.R", "p.G", "p.B"][+sp.id[3]]] + " " + F.tap[+sp.id[3]], an.size, "hand");
      ga(0.5 * sp.pulse * a); c.fillStyle = HL; c.fillRect(an.p[0] - 0.3, an.p[1] - an.size * 0.5, w + 0.6, an.size * 0.85); ga(1);
    }
  }
}

// 便签：一张黄纸「啪」地贴上，五步逐个写出；当前一步前面一个红箭头，做完的打红勾、字变淡
function note(t) {
  const D = G.D, b = D.b, N = G.F3.F.note, c = G.ctx;
  if (t < b.note[0]) return;
  const u = seg(t, b.note[0], b.note[1], E.o3), s = lerp(1.12, 1, u), [w0, dw, wd] = b.noteW;
  c.save(); c.translate(N.c[0], N.c[1]); c.rotate((N.rot * Math.PI) / 180); c.scale(s, s);
  c.save(); c.filter = `blur(${(0.5 * G.map.f).toFixed(1)}px)`; ga(0.3 * u); c.fillStyle = "#2B1D12"; c.fillRect(-N.w / 2 + 0.3, -N.h / 2 - 0.5, N.w, N.h); c.restore();
  ga(u); c.fillStyle = "#F8E58C"; c.fillRect(-N.w / 2, -N.h / 2, N.w, N.h);
  c.fillStyle = "rgba(120,90,20,0.08)"; c.fillRect(-N.w / 2, N.h / 2 - 2.0, N.w, 2.0); ga(1); // 顶上背胶的一条
  const ticks = D.noteTick || [], rowY = (i) => N.h / 2 - 3.6 - i * N.dy, x0 = -N.w / 2 + 3.2;
  const a = (N.rot * Math.PI) / 180, L = (x, y) => [N.c[0] + s * (x * Math.cos(a) - y * Math.sin(a)), N.c[1] + s * (x * Math.sin(a) + y * Math.cos(a))];
  // 勾：箭头先滑走（0–0.3s），再打勾、字变淡（0.25s 起）
  for (const k of ticks) {
    if (t < k[1] + 0.25) continue;
    const y = rowY(k[0]), q = [[x0 - 2.3, y + 0.1], [x0 - 1.6, y - 0.7], [x0 - 0.3, y + 1.0]];
    line(partial(q, seg(t, k[1] + 0.25, k[2] + 0.25, E.lin)), lw(3.6), G.C.red);
  }
  const aw = seg(t, w0 + 5 * dw, w0 + 5 * dw + 0.3, E.sine);
  if (aw > 0) { // 当前一步：红箭头
    let y = rowY(0);
    for (const k of ticks) if (t >= k[1]) y = lerp(rowY(k[0]), rowY(k[0] + 1), seg(t, k[1], k[1] + 0.3, E.io2));
    if (y > rowY(4) - 0.1) { ga(aw); line([[x0 - 2.6, y], [x0 - 0.8, y]], lw(3.4), G.C.red); line([[x0 - 1.5, y + 0.6], [x0 - 0.8, y], [x0 - 1.5, y - 0.6]], lw(3.4), G.C.red); ga(1); }
  }
  c.restore();
  for (let i = 0; i < 5; i++) {
    const r = seg(t, w0 + i * dw, w0 + i * dw + wd, E.lin), k = ticks.find((q) => q[0] === i), dim = k ? seg(t, k[1] + 0.25, k[2] + 0.25, E.sine) : 0;
    txtR(G.T[N.items[i]], L(x0, rowY(i)), N.size * s, G.C.hand, N.rot, { reveal: r, alpha: u * (1 - 0.5 * dim) });
  }
}
// 跟着纸转的手写字（左对齐，锚点在左端中线）
function txtR(str, p, size, color, rot, o = {}) {
  const c = G.ctx, px = size * G.map.f, X = (p[0] - G.map.x0) * G.map.f, Y = (G.map.y1 - p[1]) * G.map.f, rv = o.reveal ?? 1;
  if (px < 3 || rv <= 0) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.translate(X, Y); c.rotate((-rot * Math.PI) / 180);
  c.globalAlpha = o.alpha ?? 1; c.font = `400 ${px.toFixed(2)}px "WenKai"`; c.textAlign = "left"; c.textBaseline = "middle"; c.fillStyle = color;
  if (rv < 1) { const w = c.measureText(str).width; c.beginPath(); c.rect(-px * 0.1, -px, (w + px * 0.2) * rv, px * 2); c.clip(); }
  c.fillText(str, 0, 0); c.restore();
}

function e1(t) {
  const F3 = G.F3; if (!F3) return;
  const F = F3.F, b = G.D.b, C = G.C, o = F.cube.o, e = F.cube.e;
  if (t >= b.foot[0]) { // 立方体的底：先用铅笔画在纸上，立方体从这里立起来
    const u = seg(t, b.foot[0], b.foot[1], E.lin);
    line(partial([o, [o[0] + e, o[1]], [o[0] + e, o[1] + e], [o[0], o[1] + e], o], u), lw(2.6), C.pencil);
  }
  if (t >= b.devShow) { // 偏差条：长度随偏差缩短（与上集外卖的「总面积」条同一画法）
    const d = F3.dev(t), a = seg(t, b.devShow, b.devShow + 0.4, E.sine), q = F.devL.p;
    ga(0.75 * a); G.ctx.fillStyle = C.red; G.ctx.fillRect(q[0] + 10.4, q[1] - 0.5, 7.5 * (d / F.rms[0]) * a, 1.0); ga(1);
  }
  if (t >= b.mxW[0]) { // 校正矩阵：先写九个 ?，解的过程中变成数；括号按两位小数的宽度留足
    const m = F.mx, r = seg(t, b.mxW[0], b.mxW[1], E.lin), V = F3.mxVals(t), hw = m.dx + m.numW / 2 + 0.5, hh = m.dy + m.size * 0.7, c = G.ctx;
    ga(Math.min(1, r * 3));
    for (const sg of [-1, 1]) {
      c.beginPath(); c.moveTo(m.c[0] + sg * hw, m.c[1] + hh); c.quadraticCurveTo(m.c[0] + sg * (hw + m.size * 0.3), m.c[1], m.c[0] + sg * hw, m.c[1] - hh);
      c.strokeStyle = C.hand; c.lineWidth = lw(3); c.stroke();
    }
    ga(1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      txt(V[i][j], [m.c[0] + (j - 1) * m.dx, m.c[1] - (i - 1) * m.dy], m.size, C.hand, { font: "print", reveal: clamp01(r * 9 - (i * 3 + j)) });
  }
  note(t);
}
export const PAGES_E = { e0, e1 };
