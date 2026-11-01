// 第 8 章（平板）：受热铁板切成格，每格 = 四邻平均，一格一个方程；格子越切越细
import { G, COL, txt, line, ga } from "./draw.js";
import { seg, win, E, lerp } from "./world.js";

const heat = (v) => { // 0 冷（深蓝）→ 100 热（朱红）
  const u = Math.max(0, Math.min(1, v / 100)), a = [40, 62, 110], b = [230, 160, 70], c = [217, 69, 46];
  const m = u < 0.5 ? a.map((x, i) => lerp(x, b[i], u * 2)) : b.map((x, i) => lerp(x, c[i], (u - 0.5) * 2));
  return `rgb(${m.map(Math.round)})`;
};
export function draw(t, r) {
  const B = G.D.b, F = G.D.fin;
  if (t < B.plate - 0.5 || t > B.fly[1]) return;
  const a = win(t, B.plate, B.fly[0] + 1.0, 0.5, 0.6), c = G.ctx, x0 = 163.9, y0 = 3.7, W = 7.0, H = 4.2;
  if (a <= 0.01) return;
  const T = (x, y) => { // 双线性取格子温度；x, y ∈ [0, 1]
    const gx = Math.max(0, Math.min(F.gx - 1.001, x * F.gx - 0.5)), gy = Math.max(0, Math.min(F.gy - 1.001, y * F.gy - 0.5)), i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j;
    const g = (ii, jj) => F.T[jj * F.gx + ii];
    return lerp(lerp(g(i, j), g(i + 1, j), u), lerp(g(i, j + 1), g(i + 1, j + 1), u), v);
  };
  // 先是一整块连续的铁板，再切成 10×6 格，之后越切越细
  const [r0, r1] = B.refine, lv = t < r0 ? 1 - seg(t, B.cut2, B.cut2 + 0.9, E.io2) : seg(t, r0, r1, E.io2);
  const n = Math.round(F.gx * Math.pow(13, lv)), m = Math.round(n * F.gy / F.gx);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const v = n === F.gx ? F.T[j * F.gx + i] : T((i + 0.5) / n, (j + 0.5) / m);
    ga(a); c.fillStyle = heat(v); c.fillRect(x0 + i * W / n, y0 + j * H / m, W / n * (n > 60 ? 1.02 : 0.94), H / m * (n > 60 ? 1.02 : 0.94));
  }
  ga(a); c.fillStyle = "#D9452E"; c.fillRect(x0 - 0.35, y0, 0.25, H); ga(1);
  txt(G.T.hot, x0 - 0.6, y0 + H / 2, 0.3, "#F4EFE4", { weight: 700, rot: -Math.PI / 2, alpha: a });
  // 一格与四邻
  const na = win(t, B.nbr, B.refine[0] + 0.2, 0.3, 0.3);
  if (na > 0.01 && n === F.gx) {
    const ci = 3, cj = 2, cw = W / F.gx, chh = H / F.gy, cx = x0 + (ci + 0.5) * cw, cy = y0 + (cj + 0.5) * chh;
    ga(na); c.strokeStyle = "#F4EFE4"; c.lineWidth = 0.06; c.strokeRect(cx - cw / 2, cy - chh / 2, cw, chh);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.lineWidth = 0.03; c.strokeRect(cx + dx * cw - cw / 2 + 0.04, cy + dy * chh - chh / 2 + 0.04, cw - 0.08, chh - 0.08); line([[cx + dx * cw * 0.7, cy + dy * chh * 0.7], [cx + dx * cw * 0.25, cy + dy * chh * 0.25]], 0.04, "#F4EFE4"); }
    ga(1);
    txt(F.T[cj * F.gx + ci].toFixed(0), cx, cy, 0.3, "#F4EFE4", { font: '"JBM"', weight: 700, alpha: na });
    txt("= ( ↑ + ↓ + ← + → ) ÷ 4", x0 + W / 2, y0 + H + 0.45, 0.34, "#F4EFE4", { font: '"JBM"', weight: 600, alpha: na });
  }
  const ea = seg(t, B.refine[0] + 0.25, B.refine[0] + 0.7, E.sine) * a * (1 - seg(t, B.fields, B.fields + 0.4, E.sine));
  fields(t, B, a);
  if (ea > 0.01) txt(G.T.eqs.replaceAll("{n}", (n * m).toLocaleString("en-US")), x0 + W / 2, y0 + H + 0.45, 0.34, "#F4EFE4", { weight: 600, alpha: ea });
}

// 天气、桥梁、芯片、CT、新药：五个线描图标依次落在铁板上
function fields(t, B, a0) {
  const c = G.ctx, P = "#F4EFE4", k0 = B.fields;
  if (t < k0) return;
  const dim = seg(t, k0, k0 + 0.5, E.sine); ga(a0 * dim * 0.7); c.fillStyle = "#101215"; c.fillRect(163.4, 3.5, 8.0, 5.1); ga(1);
  const ic = [
    (x, y) => { G.ctx.beginPath(); G.ctx.arc(x - 0.2, y - 0.15, 0.32, 0, 2 * Math.PI); G.ctx.stroke(); line([[x - 0.6, y + 0.3], [x + 0.6, y + 0.3]], 0.07, P); line([[x - 0.3, y + 0.55], [x + 0.45, y + 0.55]], 0.07, P); },
    (x, y) => { G.ctx.beginPath(); G.ctx.arc(x, y + 0.5, 0.7, Math.PI, 2 * Math.PI); G.ctx.stroke(); line([[x - 0.85, y + 0.5], [x + 0.85, y + 0.5]], 0.08, P); for (const d of [-0.4, 0, 0.4]) line([[x + d, y + 0.5], [x + d, y + 0.5 - Math.sqrt(0.49 - d * d)]], 0.04, P); },
    (x, y) => { G.ctx.strokeRect(x - 0.45, y - 0.45, 0.9, 0.9); for (const d of [-0.25, 0, 0.25]) { line([[x + d, y - 0.45], [x + d, y - 0.7]], 0.05, P); line([[x + d, y + 0.45], [x + d, y + 0.7]], 0.05, P); } },
    (x, y) => { G.ctx.beginPath(); G.ctx.arc(x, y, 0.65, 0, 2 * Math.PI); G.ctx.stroke(); G.ctx.beginPath(); G.ctx.arc(x, y, 0.3, 0, 2 * Math.PI); G.ctx.stroke(); },
    (x, y) => { G.ctx.save(); G.ctx.translate(x, y); G.ctx.rotate(-0.6); rrS(-0.7, -0.25, 1.4, 0.5); line([[0, -0.25], [0, 0.25]], 0.05, P); G.ctx.restore(); },
  ];
  ic.forEach((f, i) => {
    const u = seg(t, k0 + 0.3 + i * 0.35, k0 + 0.6 + i * 0.35, E.o3); if (u <= 0) return;
    ga(a0 * u); c.strokeStyle = P; c.lineWidth = 0.07; f(164.6 + i * 1.6, 6.0 + 0.3 * (1 - u)); ga(1);
  });
}
function rrS(x, y, w, h) { const c = G.ctx, r = h / 2; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.stroke(); }
