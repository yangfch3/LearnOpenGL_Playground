// 水彩平涂：边缘按固定种子轻微抖动，内部一层浅色积色，边缘描一圈深色细线
const NS = "http://www.w3.org/2000/svg";
export const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
export const g = (parent, attrs = {}) => el("g", attrs, parent);
export const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const rnd = mulberry32(2026);

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (a) => "#" + a.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
export const mixC = (a, b, k) => { const p = hex(a), q = hex(b); return toHex(p.map((v, i) => v + (q[i] - v) * k)); };
export const shade = (c, k) => (k < 0 ? mixC(c, "#3a2a24", -k) : mixC(c, "#ffffff", k));

// 闭合折线 → 加密、沿法向平滑抖动 → Catmull-Rom 曲线
function wobble(pts, amp, step = 26) {
  const dense = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const p1 = rnd() * 6.28, p2 = rnd() * 6.28, f1 = 2 + Math.floor(rnd() * 3), f2 = 5 + Math.floor(rnd() * 4), N = dense.length;
  return dense.map((p, i) => {
    const a = dense[(i + N - 1) % N], b = dense[(i + 1) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const s = (i / N) * 6.2832, d = amp * (0.65 * Math.sin(f1 * s + p1) + 0.35 * Math.sin(f2 * s + p2));
    return [p[0] - (dy / l) * d, p[1] + (dx / l) * d];
  });
}
export function curve(pts, closed = true) {
  const n = pts.length, P = (i) => pts[closed ? (i + n) % n : Math.min(Math.max(i, 0), n - 1)];
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return closed ? d + "Z" : d;
}
export const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export const ellPts = (cx, cy, rx, ry, n = 18) => [...Array(n)].map((_, i) => [cx + rx * Math.cos((i / n) * 6.2832), cy + ry * Math.sin((i / n) * 6.2832)]);

// 一块水彩：o.a 不透明度，o.amp 抖动幅度，o.edge 描边宽，o.bloom 积色强度
export function wash(parent, pts, color, o = {}) {
  const gr = g(parent, o.attrs || {}), w = wobble(pts, o.amp ?? 2.2, o.step ?? 26), d = curve(w);
  el("path", { d, fill: color, "fill-opacity": o.a ?? 0.96, stroke: shade(color, -0.28), "stroke-width": o.edge ?? 2, "stroke-opacity": o.edgeA ?? 0.4 }, gr);
  if ((o.bloom ?? 0.5) > 0) {
    let cx = 0, cy = 0;
    w.forEach((p) => { cx += p[0]; cy += p[1]; });
    cx /= w.length; cy /= w.length;
    const k = 0.72, inner = w.map((p, i) => [cx + (p[0] - cx) * k - 4 + 3 * Math.sin(i), cy + (p[1] - cy) * k - 5 + 3 * Math.cos(i * 1.3)]);
    el("path", { d: curve(inner), fill: shade(color, 0.22), "fill-opacity": 0.35 * (o.bloom ?? 0.5) * 2 }, gr);
  }
  return gr;
}
export const wrect = (p, x, y, w, h, c, o) => wash(p, rectPts(x, y, w, h), c, o);
export const well = (p, cx, cy, rx, ry, c, o) => wash(p, ellPts(cx, cy, rx, ry, Math.max(10, Math.round((rx + ry) / 9))), c, o);
export const wpoly = (p, pts, c, o) => wash(p, pts, c, o);
// 天空等大面积：自上而下几条互相交叠的色带
export function bands(parent, x0, x1, ys, colors, o = {}) {
  for (let i = 0; i < colors.length; i++) wrect(parent, x0, ys[i], x1 - x0, ys[i + 1] - ys[i] + 60, colors[i], { amp: 10, step: 90, edge: 0, bloom: 0.3, a: i ? 0.9 : 1, ...o });
}
export const line = (parent, pts, color, w, o = {}) =>
  el("path", { d: curve(pts, false), fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round", ...o }, parent);
