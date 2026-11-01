// 绘制公用：世界坐标下画图，文字一律换算到屏幕像素再画（字号不被变换缩放）
export const G = { ctx: null, k: null, t: 0, T: null };
export const COL = {
  ink: "#1E2638", paper: "#F4EFE4", red: "#D9452E", rod: "#E9DDB5", rodEnd: "#C9B383", lacq: "#1C1714", cinn: "#9E2B1E",
  gold: "#C9B27A", navy: "#1B2740", grid: "#B9C3CC", dim: "#9AA6B8",
};
export const hs = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function world() { const { ctx, k } = G; ctx.setTransform(k.s, 0, 0, k.s, 960 - k.s * k.c[0], 540 - k.s * k.c[1]); }
export function rr(x, y, w, h, r) {
  const c = G.ctx; r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
// 投影：光从左上，偏移 (0.12, 0.18)、模糊 0.3 单位（shadow 参数不随变换缩放，按 s 换算）
export function shadow(on, k = 1) {
  const c = G.ctx, s = G.k.s;
  if (!on || s > 600) { c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetX = c.shadowOffsetY = 0; return; }
  c.shadowColor = `rgba(20,12,6,${0.35 * k})`; c.shadowBlur = 0.3 * s * k; c.shadowOffsetX = 0.12 * s * k; c.shadowOffsetY = 0.18 * s * k;
}
export function fillS(path, color, k = 1) { const c = G.ctx; shadow(true, k); c.fillStyle = color; c.fill(path); shadow(false); }
export const scr = (p) => [960 + (p[0] - G.k.c[0]) * G.k.s, 540 + (p[1] - G.k.c[1]) * G.k.s];
export function txt(s, x, y, size, color, o = {}) {
  const c = G.ctx, px = size * G.k.s;
  if (px < 4 || (o.alpha ?? 1) <= 0.003) return;
  const [X, Y] = scr([x, y]);
  if (X < -2000 || X > 3920 || Y < -2000 || Y > 3080) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha *= o.alpha ?? 1;
  c.font = `${o.weight || 500} ${px.toFixed(2)}px ${o.font || '"Noto Sans SC"'}`;
  c.textAlign = o.align || "center"; c.textBaseline = o.base || "middle"; c.fillStyle = color;
  if (o.rot) { c.translate(X, Y); c.rotate(o.rot); c.fillText(s, 0, 0); } else c.fillText(s, X, Y);
  c.restore();
}
// 竖排文字（竹简）
export function vtxt(s, x, y, size, color, o = {}) { [...s].forEach((ch, i) => txt(ch, x, y + i * size * 1.08, size, color, o)); }
export function line(pts, w, color, cap = "round") {
  const c = G.ctx; c.strokeStyle = color; c.lineWidth = w; c.lineCap = cap; c.lineJoin = "round";
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke();
}
export function dot(p, r, color) { const c = G.ctx; c.fillStyle = color; c.beginPath(); c.arc(p[0], p[1], r, 0, 2 * Math.PI); c.fill(); }
export function ring(p, r, w, color) { const c = G.ctx; c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.arc(p[0], p[1], r, 0, 2 * Math.PI); c.stroke(); }
// 一根算筹：象牙色圆头细棍，带一条亮边；color 可改为朱红 / 墨色
export function rod(a, b, w = 0.1, color = COL.rod, sh = true) {
  const c = G.ctx;
  if (sh) shadow(true, 0.6);
  line([a, b], w, color); shadow(false);
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w * 0.22, ny = dx / l * w * 0.22;
  c.globalAlpha *= 0.45; line([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]], w * 0.25, "#FFFFFF"); c.globalAlpha /= 0.45;
}
// 向量算筹：末端带一个小三角
export function vrod(a, b, w, color) {
  rod(a, b, w, color);
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-3) return;
  const ux = dx / l, uy = dy / l, h = w * 2.6, c = G.ctx;
  c.fillStyle = color; c.beginPath(); c.moveTo(b[0] + ux * h * 0.9, b[1] + uy * h * 0.9);
  c.lineTo(b[0] - uy * h * 0.75, b[1] + ux * h * 0.75); c.lineTo(b[0] + uy * h * 0.75, b[1] - ux * h * 0.75); c.closePath(); c.fill();
}
export const ga = (a) => { G.ctx.globalAlpha = a; };
// 屏幕可见范围（世界坐标）
export function view() { const { c, s } = G.k; return [c[0] - 960 / s, c[1] - 540 / s, c[0] + 960 / s, c[1] + 540 / s]; }
export const visible = (b, m = 0.5) => { const v = view(); return b[2] > v[0] - m && b[0] < v[2] + m && b[3] > v[1] - m && b[1] < v[3] + m; };
// 在局部坐标系里画：原点 o、单位 g、y 向上
export function local(o, g, fn) { const c = G.ctx; c.save(); c.translate(o[0], o[1]); c.scale(g, -g); fn(); c.restore(); }
