// 今天：手机（照片、推近见 RGB 数字、几个 App）与平板（第 6–8 章的工作台）
import { G, COL, rr, txt, line, dot, ga, visible } from "./draw.js";
import { seg, win, E, lerp, clamp01 } from "./world.js";
import * as jpeg from "./jpeg.js";
import * as ai from "./ai.js";
import * as fin from "./fin.js";

let photo, PX;
export function init(D) {
  const P = D.photo, bin = atob(P.b64), img = new ImageData(P.w, P.h);
  for (let i = 0, j = 0; i < P.w * P.h; i++) { img.data[j++] = bin.charCodeAt(i * 3); img.data[j++] = bin.charCodeAt(i * 3 + 1); img.data[j++] = bin.charCodeAt(i * 3 + 2); img.data[j++] = 255; }
  photo = document.createElement("canvas"); photo.width = P.w; photo.height = P.h; photo.getContext("2d").putImageData(img, 0, 0);
  PX = (i, j) => { const o = (j * P.w + i) * 3; return [bin.charCodeAt(o), bin.charCodeAt(o + 1), bin.charCodeAt(o + 2)]; };
  G.photo = photo; G.px = PX;
}
// 照片画进矩形 r；像素大时改为最近邻，再大时每格写出 RGB 三个数
export function drawPhoto(r, a = 1) {
  const c = G.ctx, P = G.D.photo, pw = (r[2] - r[0]) / P.w, px = pw * G.k.s;
  const sharp = clamp01((px - 5) / 7);
  ga(a); c.imageSmoothingEnabled = true; c.drawImage(photo, r[0], r[1], r[2] - r[0], r[3] - r[1]);
  if (sharp > 0) { ga(a * sharp); c.imageSmoothingEnabled = false; c.drawImage(photo, r[0], r[1], r[2] - r[0], r[3] - r[1]); c.imageSmoothingEnabled = true; }
  ga(1);
  if (px < 60) return;
  const k = G.k, v0 = [k.c[0] - 960 / k.s, k.c[1] - 540 / k.s], v1 = [k.c[0] + 960 / k.s, k.c[1] + 540 / k.s];
  const i0 = Math.max(0, Math.floor((v0[0] - r[0]) / pw)), i1 = Math.min(P.w - 1, Math.floor((v1[0] - r[0]) / pw));
  const j0 = Math.max(0, Math.floor((v0[1] - r[1]) / pw)), j1 = Math.min(P.h - 1, Math.floor((v1[1] - r[1]) / pw));
  const na = clamp01((px - 90) / 50) * a;
  ga(na * 0.6); c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = pw * 0.03; c.beginPath();
  for (let i = i0; i <= i1 + 1; i++) { c.moveTo(r[0] + i * pw, r[1] + j0 * pw); c.lineTo(r[0] + i * pw, r[1] + (j1 + 1) * pw); }
  for (let j = j0; j <= j1 + 1; j++) { c.moveTo(r[0] + i0 * pw, r[1] + j * pw); c.lineTo(r[0] + (i1 + 1) * pw, r[1] + j * pw); } c.stroke(); ga(1);
  if (na <= 0.01) return;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const rgb = PX(i, j), lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2], col = lum > 140 ? "#1A1A1A" : "#F4F4F0", x = r[0] + (i + 0.5) * pw, y = r[1] + (j + 0.5) * pw;
    ["#E04A3A", "#3DAA5A", "#3E6FD8"].forEach((bc, q) => {
      const yy = y + (q - 1) * pw * 0.27; ga(na); c.fillStyle = bc; c.fillRect(x - pw * 0.36, yy - pw * 0.09, pw * 0.07, pw * 0.18); ga(1);
      txt(String(rgb[q]), x + pw * 0.06, yy, pw * 0.2, col, { font: '"JBM"', weight: 600, alpha: na });
    });
  }
}
function apps(t, r, B) { // 修图、推荐、AI：依次从右边滑进来
  const c = G.ctx, w = r[2] - r[0], h = r[3] - r[1];
  const k = B.apps.filter((a) => t >= a).length; if (k === 0 || t > B.map[1]) return false;
  c.save(); rr(r[0], r[1], w, h, 0.5); c.clip();
  for (let i = Math.max(0, k - 2); i < k; i++) {
    const off = (1 - seg(t, B.apps[i], B.apps[i] + 0.45, E.o3)) * w, x = r[0] + off;
    c.fillStyle = ["#1C1F24", "#F3F3F1", "#0F1115"][i]; c.fillRect(x, r[1], w, h);
    if (i === 0) { c.save(); c.translate(off, 0); drawPhoto([r[0] + 0.3, r[1] + 1.2, r[2] - 0.3, r[1] + 1.2 + (w - 0.6) * 375 / 180 * 0.62]); c.restore();
      for (let s = 0; s < 3; s++) { const y = r[3] - 2.2 + s * 0.6; line([[x + 0.6, y], [x + w - 0.6, y]], 0.06, "#555B63"); dot([x + 0.6 + (w - 1.2) * [0.3, 0.62, 0.45][s], y], 0.15, "#E9EDF2"); } }
    if (i === 1) for (let q = 0; q < 10; q++) { const cx = x + 0.3 + (q % 2) * (w / 2 - 0.15), cy = r[1] + 0.5 + Math.floor(q / 2) * 1.9;
      c.fillStyle = ["#E9B44C", "#5B8DB8", "#C45B4A", "#6FA36A", "#8B6BB5"][(q * 3) % 5]; c.fillRect(cx, cy, w / 2 - 0.45, 1.3); c.fillStyle = "#C9CBCE"; c.fillRect(cx, cy + 1.4, w / 2 - 0.9, 0.12); }
    if (i === 2) for (let q = 0; q < 6; q++) { const me = q % 2 === 1, bw = w * (0.45 + 0.25 * ((q * 7) % 3) / 2), y = r[1] + 0.8 + q * 1.45;
      c.fillStyle = me ? "#3E6FD8" : "#2A2E35"; rr(me ? x + w - 0.3 - bw : x + 0.3, y, bw, 1.0, 0.3); c.fill(); }
  }
  c.restore(); return true;
}
export function draw(t) {
  const B = G.D.b, L = G.D.L;
  if (visible(L.phone)) {
    const r = L.screen, c = G.ctx;
    c.save(); rr(r[0], r[1], r[2] - r[0], r[3] - r[1], 0.5); c.clip();
    if (!apps(t, r, B)) drawPhoto(r);
    jpeg.phone(t, r);
    c.restore();
  }
  if (visible(L.tablet)) {
    const r = L.tscreen, c = G.ctx;
    c.save(); rr(r[0], r[1], r[2] - r[0], r[3] - r[1], 0.3); c.clip();
    c.fillStyle = "#101215"; c.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    jpeg.tablet(t, r); ai.draw(t, r); fin.draw(t, r);
    c.restore();
  }
}
