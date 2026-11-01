// 纸面绘制公用：在页面贴图上按世界坐标（单位 = 格，y 向上）画线与形；文字换算到贴图像素再画（字形不翻转）
// 线宽按纸上的物理宽度给：px0 为每格 20 像素时的像素宽，推近时随纸一起变粗
export const G = { ctx: null, map: null, t: 0, D: null, T: null, C: null, dim: 0 };
const F0 = 20;
export const lw = (px0) => px0 / F0;
export function world() { const { ctx, map: m } = G; ctx.setTransform(m.f, 0, 0, -m.f, -m.f * m.x0, m.f * m.y1); }
export const scr = (p) => [(p[0] - G.map.x0) * G.map.f, (G.map.y1 - p[1]) * G.map.f];
export const ga = (a) => { G.ctx.globalAlpha = a; };
export function mixHex(a, b, u) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * u).toString(16).padStart(2, "0")).join("");
}
export function line(pts, w, color, dash) {
  const c = G.ctx;
  c.strokeStyle = color; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round";
  if (dash) c.setLineDash(dash);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke();
  if (dash) c.setLineDash([]);
}
// 部分画出的折线：u = 0..1 按长度
export function partial(pts, u) {
  if (u >= 1) return pts;
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const goal = L[L.length - 1] * Math.max(0, u), out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (L[i] <= goal) { out.push(pts[i]); continue; }
    const k = (goal - L[i - 1]) / (L[i] - L[i - 1] || 1);
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]); break;
  }
  return out;
}
export function dot(p, r, color) { const c = G.ctx; c.fillStyle = color; c.beginPath(); c.arc(p[0], p[1], r, 0, 2 * Math.PI); c.fill(); }
// 箭头：杆宽 w，箭头长 h（不超过全长的 45%）；outline > 0 时画同形的粗描边
export function arrow(a, b, w, color, h = w * 2.8, outline = 0) {
  const c = G.ctx, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
  if (l < 1e-4) return;
  const ux = dx / l, uy = dy / l, hh = Math.min(h, l * 0.45), hw = hh * 0.62, m = [b[0] - ux * hh, b[1] - uy * hh];
  const tri = () => { c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(m[0] - uy * hw, m[1] + ux * hw); c.lineTo(m[0] + uy * hw, m[1] - ux * hw); c.closePath(); };
  if (outline) { line([a, m], w + outline * 2, color); tri(); c.strokeStyle = color; c.lineWidth = outline * 2; c.lineJoin = "round"; c.stroke(); c.fillStyle = color; c.fill(); return; }
  line([a, [m[0] + ux * w * 0.3, m[1] + uy * w * 0.3]], w, color); tri(); c.fillStyle = color; c.fill();
}
const FONTS = { hand: '"WenKai"', print: '"KMain"', math: '"KMath"', vec: '"KMath"', sans: '"Noto Sans SC"' };
// 实测字宽（世界单位）：贴着文字的标记（圈、连线）按它定位
export function measureW(s, size, font) {
  const c = G.ctx; c.save(); c.font = `400 ${(size * G.map.f).toFixed(2)}px ${FONTS[font] || FONTS.hand}`;
  const w = c.measureText(s).width; c.restore(); return w / G.map.f;
}
// 文字：p 为世界坐标锚点，size 为纸上字高（格）；reveal 0..1 自左向右写出
export function txt(s, p, size, color, o = {}) {
  const c = G.ctx, px = size * G.map.f, a = (o.alpha ?? 1) * c.globalAlpha;
  if (px < 3 || a <= 0.003 || (o.reveal ?? 1) <= 0) return;
  const [X, Y] = scr(p), W = c.canvas.width, H = c.canvas.height;
  if (X < -px * 30 || X > W + px * 30 || Y < -px * 3 || Y > H + px * 3) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = a;
  c.font = `${o.weight || 400} ${px.toFixed(2)}px ${FONTS[o.font] || FONTS.hand}`;
  c.textAlign = o.align || "center"; c.textBaseline = "middle"; c.fillStyle = color;
  const w = c.measureText(s).width, x0 = o.align === "left" ? X : o.align === "right" ? X - w : X - w / 2;
  if ((o.reveal ?? 1) < 1) { c.beginPath(); c.rect(x0 - px * 0.1, Y - px, (w + px * 0.2) * o.reveal, px * 2); c.clip(); }
  c.fillText(s, X, Y);
  if (o.font === "vec") { // 向量记号：首字母上方加小箭头
    const w0 = c.measureText(s[0]).width, ax = x0 + w0 * 0.1, ay = Y - px * 0.62, al = w0 * 0.85;
    c.strokeStyle = color; c.lineWidth = px * 0.06; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + al, ay);
    c.moveTo(ax + al - px * 0.14, ay - px * 0.09); c.lineTo(ax + al, ay); c.lineTo(ax + al - px * 0.14, ay + px * 0.09); c.stroke();
  }
  if (s.includes("ŷ") && o.font === "print") { /* KaTeX_Main 自带 ŷ 字形 */ }
  c.restore();
}
// 红笔圈：起笔偏一点、多绕 10%，略带起伏；rx/ry 可不同，rot 为旋转角
export function penRing(p, r, w, color, u = 1, dash, ry = null, rot = 0) {
  if (u <= 0) return;
  const n = 72, pts = [], a0 = 2.2, tot = 2 * Math.PI * 1.1 * u, cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (tot * i) / n, k = 1 + 0.06 * Math.sin(a * 3 + 1.3) + 0.04 * (i / n);
    const x = r * 1.12 * k * Math.cos(a), y = (ry ?? r) * 0.92 * k * Math.sin(a);
    pts.push([p[0] + x * cr - y * sr, p[1] + x * sr + y * cr]);
  }
  line(pts, w, color, dash);
}
export function ellipse(cx, cy, rx, ry, rot = 0) { const c = G.ctx; c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, 2 * Math.PI); }
export function shape(fill, stroke, w) {
  const c = G.ctx;
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = w; c.lineJoin = "round"; c.lineCap = "round"; c.stroke(); }
}
export function clipRect(b) { const c = G.ctx; c.beginPath(); c.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]); c.clip(); }
export function poly(pts, fill, stroke, w) { const c = G.ctx; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); shape(fill, stroke, w); }
// 印刷体矩阵：括号 + 元素（KaTeX 字形），cols 为各列颜色
export function pmatrix(c0, vals, size, cols, dx, dy, alpha = 1, reveal = 1, brA = 1) {
  const n = vals.length, m = vals[0].length, hw = ((m - 1) * dx) / 2 + size * 0.75, hh = ((n - 1) * dy) / 2 + size * 0.65;
  ga(alpha * Math.min(1, reveal * 3) * brA);
  for (const s of [-1, 1]) {
    const c = G.ctx; c.beginPath(); c.moveTo(c0[0] + s * hw, c0[1] + hh); c.quadraticCurveTo(c0[0] + s * (hw + size * 0.28), c0[1], c0[0] + s * hw, c0[1] - hh);
    c.strokeStyle = G.C.ink; c.lineWidth = lw(3); c.stroke();
  }
  ga(1);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const v = vals[i][j], s = typeof v === "number" ? String(Math.round(v) + 0).replace("-", "−") : v;
    txt(s, [c0[0] + (j - (m - 1) / 2) * dx, c0[1] - (i - (n - 1) / 2) * dy], size, cols[j], { font: "print", alpha, reveal: Math.min(1, Math.max(0, reveal * (n * m) - (i * m + j))) });
  }
}

// ---- 纸张底：封面、横线算术本、方格本 / 草稿纸（每 5 格一条粗格）；底纹很浅，只作背景 ----
const STYLE = { cover: "cover", inner: "plain", end: "plain", p1: "ruled" };
export function paperBase(pid, R) {
  const c = G.ctx, C = G.C, [x0, y0, x1, y1] = R, st = STYLE[pid] || "grid";
  world();
  c.fillStyle = st === "cover" ? C.cover : C.paper; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (st === "cover") { // 封面：布纹 + 一张贴纸标签
    ga(0.06); c.strokeStyle = "#FFFFFF"; c.lineWidth = lw(1.5); c.beginPath();
    for (let y = y0; y < y1; y += 0.8) { c.moveTo(x0, y); c.lineTo(x1, y); } c.stroke(); ga(1);
    c.fillStyle = C.paper; c.fillRect(x0 + 10, y1 - 22, 28, 11);
    line([[x0 + 12, y1 - 19.5], [x0 + 36, y1 - 19.5]], lw(2), C.rule); line([[x0 + 12, y1 - 15.5], [x0 + 36, y1 - 15.5]], lw(2), C.rule);
    txt(G.T["p.cover"], [x0 + 24, y1 - 17.4], 4.2, C.hand);
    return;
  }
  if (st === "plain") return;
  const fine = new Path2D(), bold = new Path2D(), m = 1;
  if (st === "ruled") {
    for (let y = Math.ceil((y0 + m) / 2.2) * 2.2; y <= y1 - 3; y += 2.2) { fine.moveTo(x0 + m, y); fine.lineTo(x1 - m, y); }
    c.lineWidth = lw(2); c.strokeStyle = C.rule; ga(0.55); c.stroke(fine); ga(1);
  } else {
    const xa = Math.ceil(x0 + m), xb = Math.floor(x1 - m);
    for (let x = xa; x <= xb; x++) { if (Math.abs(x) < 0.5) continue; const P = x % 5 === 0 ? bold : fine; P.moveTo(x, y0 + m); P.lineTo(x, y1 - m); }
    for (let y = Math.ceil(y0 + m); y <= y1 - m; y++) { const P = y % 5 === 0 ? bold : fine; P.moveTo(Math.max(xa, x0 + m), y); P.lineTo(Math.min(xb, x1 - m), y); }
    c.lineWidth = lw(2); c.strokeStyle = C.grid; ga(0.22); c.stroke(fine); ga(0.38); c.stroke(bold); ga(1);
  }
  // 书脊一侧的阴影（左页在右缘、右页在左缘）
  const sx = x0 < -1 ? x1 : x0, g = c.createLinearGradient(sx, 0, sx + (x0 < -1 ? -3 : 3), 0);
  g.addColorStop(0, "rgba(60,40,20,0.16)"); g.addColorStop(1, "rgba(60,40,20,0)");
  c.fillStyle = g; c.fillRect(Math.min(sx, sx + (x0 < -1 ? -3 : 3)), y0, 3, y1 - y0);
}
// 发亮（1-post）：同色宽描边垫在下面，再画一遍本体
export function glowLine(pts, w, color, k) {
  if (k > 0.01) { ga(0.22 * k); line(pts, w + lw(10) * k, color); ga(0.12 * k); line(pts, w + lw(22) * k, color); ga(1); }
  line(pts, w, color);
}
