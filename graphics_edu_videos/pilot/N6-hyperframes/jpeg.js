// 第 6 章（平板）：87 元的硬币与纸币 → 一行 8 像素换一套单位 → 8×8 块用 64 块积木拼回、扔掉近 0 的
import { G, COL, rr, txt, line, dot, ring, ga } from "./draw.js";
import { seg, win, E, lerp, clamp01 } from "./world.js";

const RED = COL.red, PAPER = "#F4EFE4", DIM = "#9AA6B8";
const C8 = Array.from({ length: 8 }, (_, k) => Array.from({ length: 8 }, (_, n) => Math.sqrt((k ? 2 : 1) / 8) * Math.cos(Math.PI * (n + 0.5) * k / 8)));
let atlas;
function tiles() { // 64 块积木：8×8 像素一块，排成 64×64 的图集
  if (atlas) return atlas;
  atlas = document.createElement("canvas"); atlas.width = atlas.height = 64;
  const g = atlas.getContext("2d"), im = g.createImageData(64, 64);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = Math.max(0, Math.min(255, 128 + 360 * C8[i][y] * C8[j][x])), o = ((i * 8 + y) * 64 + j * 8 + x) * 4;
    im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0); return atlas;
}
export function phone() {}
function coins(t, B) {
  const a = win(t, B.coins[0], B.rowIn, 0.3, 0.4); if (a <= 0.01) return;
  for (let k = 0; k < 87; k++) {
    const u = seg(t, B.coins[0] + k * 0.02, B.coins[0] + k * 0.02 + 0.25, E.o3); if (u <= 0) continue;
    const x = 163.2 + (k % 10) * 0.42, y = 4.3 + Math.floor(k / 10) * 0.42 - 0.4 * (1 - u);
    ga(a * u); dot([x, y], 0.18, "#C9CDD2"); dot([x, y], 0.12, "#B3B8BF"); ga(1);
  }
  txt(G.T.coin1, 165.1, 8.5, 0.34, PAPER, { font: '"JBM"', weight: 600, alpha: a });
  const notes = [[50, "#4F8A62"], [20, "#9A6B4A"], [10, "#4F6FA8"], [5, "#7A5A9A"]];
  notes.forEach(([v, col], k) => {
    const u = seg(t, B.notes[0] + k * 0.25, B.notes[0] + k * 0.25 + 0.35, E.o3); if (u <= 0) return;
    const x = 167.8 + (k % 2) * 2.05, y = 4.4 + Math.floor(k / 2) * 1.2 - 0.5 * (1 - u);
    ga(a * u); rr(x, y, 1.9, 0.95, 0.08); G.ctx.fillStyle = col; G.ctx.fill(); ga(1);
    txt(String(v), x + 0.95, y + 0.48, 0.42, PAPER, { font: '"JBM"', weight: 700, alpha: a * u });
  });
  for (let k = 0; k < 2; k++) { const u = seg(t, B.notes[1] + k * 0.2, B.notes[1] + k * 0.2 + 0.3, E.o3); if (u > 0) { ga(a * u); dot([168.5 + k * 0.6, 7.2], 0.22, "#C9CDD2"); ga(1); } }
  txt(G.T.notes, 169.9, 8.5, 0.3, PAPER, { font: '"JBM"', weight: 600, alpha: a * seg(t, B.notes[1], B.notes[1] + 0.4, E.sine) });
}
function rowPart(t, B, J) {
  const a = win(t, B.rowIn, B.tiles[0], 0.4, 0.4); if (a <= 0.01) return;
  const x0 = 163.4, w = 0.62;
  J.rowv.forEach((v, n) => {
    const g = Math.round(v); ga(a); G.ctx.fillStyle = `rgb(${g},${g},${g})`; G.ctx.fillRect(x0 + n * (w + 0.04), 3.8, w, w); ga(1);
    txt(String(Math.round(v)), x0 + n * (w + 0.04) + w / 2, 4.75, 0.24, PAPER, { font: '"JBM"', alpha: a });
  });
  const rows = [[0, G.T.avg], [1, G.T.slope], [2, G.T.wave], [5, G.T.wave]];
  rows.forEach(([k, lbl], q) => {
    const ra = a * seg(t, B.rowBasis[q], B.rowBasis[q] + 0.4, E.sine); if (ra <= 0.01) return;
    const y = 5.6 + q * 0.85;
    ga(ra * 0.4); line([[x0, y], [x0 + 8 * (w + 0.04), y]], 0.02, DIM); ga(1);
    for (let n = 0; n < 8; n++) { const hgt = C8[k][n] * 0.9; ga(ra); G.ctx.fillStyle = q === 0 ? PAPER : "#C9D3E2"; G.ctx.fillRect(x0 + n * (w + 0.04) + 0.12, Math.min(y, y - hgt), w - 0.24, Math.abs(hgt)); ga(1); }
    txt(lbl, x0 - 0.15, y, 0.28, DIM, { align: "right", alpha: ra });
    const ca = a * seg(t, B.rowCoef + q * 0.25, B.rowCoef + q * 0.25 + 0.3, E.sine), cv = J.rowc[k], big = Math.abs(cv) > 20;
    txt(cv.toFixed(0), 170.4, y, 0.4, big ? RED : DIM, { font: '"JBM"', weight: 700, align: "left", alpha: ca });
  });
}
function blockPart(t, B, J) {
  const a = win(t, B.tiles[0] - 0.3, G.D.chap.ai + 0.4, 0.4, 0.4); if (a <= 0.01) return;
  const c = G.ctx, cs = 0.3, P = G.px;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const p = P(J.block[0] + x, J.block[1] + y); ga(a); c.fillStyle = `rgb(${p})`; c.fillRect(162.8 + x * cs, 3.8 + y * cs, cs, cs); }
  ga(1);
  const n = Math.floor(seg(t, B.tiles[0], B.tiles[1], E.lin) * 64 + 1e-6), drop = seg(t, B.drop[0], B.drop[1], E.lin);
  const keep = new Set(J.keep.map(([i, j]) => i * 8 + j));
  const used = J.zz.slice(0, n).filter(([i, j], q) => keep.has(i * 8 + j) || q >= drop * 64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const rgb = [0, 1, 2].map((ch) => { let s = 0; for (const [i, j] of used) s += C8[i][y] * J.coef[ch][i][j] * C8[j][x]; return Math.max(0, Math.min(255, Math.round(s))); });
    ga(a * (n > 0 ? 1 : 0.25)); c.fillStyle = `rgb(${rgb})`; c.fillRect(162.8 + x * cs, 6.5 + y * cs, cs, cs);
  }
  ga(a); c.strokeStyle = DIM; c.lineWidth = 0.02; c.strokeRect(162.8, 3.8, 2.4, 2.4); c.strokeRect(162.8, 6.5, 2.4, 2.4); ga(1);
  txt("=", 164.0, 6.36, 0.3, DIM, { alpha: a });
  const at = tiles(), ts = 0.62, gx = 166.2, gy = 3.6;
  J.zz.forEach(([i, j], q) => {
    const ta = seg(t, B.tiles[0] + q * 0.05, B.tiles[0] + q * 0.05 + 0.15, E.sine); if (ta <= 0) return;
    const kept = keep.has(i * 8 + j), qd = drop * 64, gone = !kept && q < qd, ga2 = gone ? 0.15 : 1;
    const x = gx + j * (ts + 0.04), y = gy + i * (ts + 0.04);
    ga(a * ta * ga2); c.imageSmoothingEnabled = false; c.drawImage(at, j * 8, i * 8, 8, 8, x, y, ts, ts); c.imageSmoothingEnabled = true; ga(1);
    if (kept && drop > 0) { ga(a); c.strokeStyle = RED; c.lineWidth = 0.04; c.strokeRect(x, y, ts, ts); ga(1); }
    if (gone) { ga(a * clamp01(qd - q)); line([[x + 0.12, y + 0.12], [x + ts - 0.12, y + ts - 0.12]], 0.04, RED); line([[x + 0.12, y + ts - 0.12], [x + ts - 0.12, y + 0.12]], 0.04, RED); ga(1); }
  });
}
export function tablet(t, r) {
  const B = G.D.b, J = G.D.jpeg;
  if (t < B.coins[0] - 0.5 || t > G.D.chap.ai + 1) return;
  coins(t, B); rowPart(t, B, J); blockPart(t, B, J);
}
