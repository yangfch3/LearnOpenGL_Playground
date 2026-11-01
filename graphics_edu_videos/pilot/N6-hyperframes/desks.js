// 六张书桌：桌面材质与静态器物。工作台里的动态内容由各章模块画
import { G, COL, hs, rr, fillS, shadow, txt, vtxt, line, dot, ring, rod, view } from "./draw.js";

const SURF = ["#CDB27A", "#4A3324", "#2F5242", "#B98C5A", "#8E949A", "#E6DCCB"];
function surface(i) {
  const c = G.ctx, x0 = i * 32, v = view(), y0 = Math.max(0, v[1]), y1 = Math.min(18, v[3]);
  const xa = Math.max(x0, v[0]), xb = Math.min(x0 + 32, v[2]);
  c.fillStyle = SURF[i]; c.fillRect(x0, 0, 32, 18);
  if (G.k.s < 6) return;
  c.globalAlpha = 1;
  if (i === 0) { // 竹席：横向篾条 + 交错的经线
    for (let y = Math.floor(y0 / 0.5) * 0.5; y < y1; y += 0.5) {
      c.fillStyle = (Math.round(y * 2) % 2) ? "#C4A86F" : "#D3B984"; c.fillRect(xa, y, xb - xa, 0.5);
      c.fillStyle = "rgba(90,60,20,0.18)"; c.fillRect(xa, y + 0.46, xb - xa, 0.04);
    }
    c.fillStyle = "rgba(90,60,20,0.12)";
    for (let x = Math.floor(xa / 2) * 2; x < xb; x += 2) c.fillRect(x, y0, 0.05, y1 - y0);
  } else if (i === 1 || i === 3) { // 木纹
    const col = i === 1 ? "rgba(20,10,4,0.28)" : "rgba(110,70,30,0.25)";
    for (let k = 0; k < 26; k++) {
      const y = 0.35 + k * 0.68 + hs(k + i * 40) * 0.3; if (y < y0 - 1 || y > y1 + 1) continue;
      const pts = []; for (let x = xa - 0.5; x <= xb + 0.5; x += 0.5) pts.push([x, y + 0.12 * Math.sin(x * 0.37 + k) + 0.05 * Math.sin(x * 1.3 + k * 2)]);
      line(pts, 0.035 + 0.03 * hs(k), col);
    }
  } else if (i === 2) { // 皮革桌面：胡桃木边 + 绿皮 + 烫金线
    c.fillStyle = "#4E3322"; c.fillRect(x0, 0, 32, 18);
    c.fillStyle = SURF[2]; c.fillRect(x0 + 0.8, 0.8, 30.4, 16.4);
    c.strokeStyle = "#B89A55"; c.lineWidth = 0.06; c.strokeRect(x0 + 1.2, 1.2, 29.6, 15.6); c.lineWidth = 0.025; c.strokeRect(x0 + 1.4, 1.4, 29.2, 15.2);
  } else if (i === 4) { // 防火板：细小斑点
    c.fillStyle = "rgba(255,255,255,0.10)";
    for (let k = 0; k < 900; k++) { const x = x0 + hs(k * 3.1) * 32, y = hs(k * 7.7) * 18; if (x > xa - 1 && x < xb + 1) c.fillRect(x, y, 0.06, 0.06); }
  } else { // 白桦
    for (let k = 0; k < 20; k++) {
      const y = 0.5 + k * 0.9; const pts = []; for (let x = xa - 0.5; x <= xb + 0.5; x += 0.6) pts.push([x, y + 0.08 * Math.sin(x * 0.2 + k)]);
      line(pts, 0.03, "rgba(150,120,80,0.12)");
    }
  }
}
export function floor() {
  const c = G.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#1D1A17"; c.fillRect(0, 0, 1920, 1080);
}
export function tableShadow() {
  const c = G.ctx; shadow(true, 1.6); c.fillStyle = "#000"; c.fillRect(0, 0, 192, 18); shadow(false);
}

// ---- 汉：竹简、禾捆、斗、算筹堆、砚台、毛笔（算板由 han.js 画）----
export function sheaf(x, y, len, col, k) {
  const c = G.ctx, p = new Path2D();
  p.ellipse(x + len * 0.55, y, len * 0.5, 0.42, 0, 0, 2 * Math.PI); fillS(p, col);
  for (let j = 0; j < 9; j++) { // 秆
    const yy = y - 0.32 + j * 0.08; line([[x + len * 0.15, yy], [x + len * 1.04, yy + (hs(j + k) - 0.5) * 0.1]], 0.03, "rgba(90,60,10,0.35)");
  }
  for (let j = 0; j < 11; j++) { // 穗
    const a = -0.5 + j * 0.1, px = x + len * 0.1 - 0.35 * Math.cos(a), py = y + 0.9 * Math.sin(a);
    const q = new Path2D(); q.ellipse(px, py, 0.32, 0.1, a * 0.6, 0, 2 * Math.PI); c.fillStyle = col; c.fill(q);
    c.strokeStyle = "rgba(90,60,10,0.35)"; c.lineWidth = 0.02; c.stroke(q);
  }
  rr(x + len * 0.6, y - 0.46, 0.22, 0.92, 0.06); c.fillStyle = "#7A5530"; c.fill(); // 草绳
}
function han() {
  const T = G.T, c = G.ctx;
  const rows = [[24.4, 0.62], [25.12, 0.62], [25.84, 0.62], [26.56, 0.62], [27.28, 0.62], [28.0, 0.62], [28.72, 0.62], [29.44, 1.08], [30.6, 0.8]];
  const p = new Path2D(); p.rect(24.4, 3.0, 7.0, 11.6); shadow(true); c.fillStyle = "#E3CF97"; c.fill(p); shadow(false);
  rows.forEach(([x, w], k) => {
    c.fillStyle = k % 2 ? "#E8D6A2" : "#DDC78C"; c.fillRect(x, 3.0, w - 0.06, 11.6);
    c.fillStyle = "rgba(120,80,30,0.25)"; c.fillRect(x + w - 0.08, 3.0, 0.02, 11.6);
  });
  for (const y of [4.1, 13.4]) line([[24.2, y], [31.6, y]], 0.07, "#6B4A2A");
  const ink = "#2A2018";
  vtxt(T.slip0, 31.0, 4.8, 0.42, ink, { weight: 600 });
  vtxt(T.slip1, 29.98, 5.0, 0.78, ink, { weight: 700 });
  [T.slip2, T.slip3, T.slip4, T.slip5].forEach((s, k) => {
    const ch = [...s], x = 28.72 + 0.31 - k * 0.72;
    ch.slice(0, 22).forEach((h, i) => txt(h, x, 4.75 + i * 0.4, 0.34, ink, { weight: 500, alpha: G.slipA?.[k] ?? 1 }));
  });
  sheaf(0.9, 5.0, 5.2, "#E0B54A", 1); sheaf(0.9, 6.9, 5.2, "#CDBB6A", 2); sheaf(0.9, 8.8, 5.2, "#A6AE62", 3);
  const d = new Path2D(); d.rect(2.3, 9.9, 2.6, 2.2); fillS(d, "#8A5E36");
  c.fillStyle = "#6B4626"; c.fillRect(2.55, 10.15, 2.1, 1.7);
  for (let k = 0; k < 60; k++) dot([2.65 + hs(k) * 1.9, 10.25 + hs(k + 99) * 1.5], 0.07, k % 3 ? "#E2C46A" : "#C9A94E");
  txt(T.dou, 3.6, 12.55, 0.36, "#4A3018", { weight: 700 });
  for (let k = 0; k < 24; k++) { // 算筹堆
    const x = 10.8 + hs(k * 5.3) * 10.2, y = 1.05 + hs(k * 2.1) * 1.6, a = (hs(k * 9.7) - 0.5) * 0.5, l = 1.1;
    rod([x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2], [x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2], 0.1, COL.rod, k % 3 === 0);
  }
  const st = new Path2D(); st.roundRect(3.0, 14.6, 3.4, 2.0, 0.3); fillS(st, "#2B2A2C");
  c.fillStyle = "#151416"; c.beginPath(); c.ellipse(4.0, 15.6, 0.7, 0.6, 0, 0, 2 * Math.PI); c.fill();
  line([[24.8, 16.0], [29.0, 16.0]], 0.16, "#7B5634"); line([[29.0, 16.0], [30.4, 16.0]], 0.3, "#2A2420");
}

// ---- 1801：望远镜、信、墨水瓶、羽毛笔、蜡烛（星图由 gauss.js 画）----
function tube(a, b, r0, r1, col) {
  const c = G.ctx, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, p = new Path2D();
  p.moveTo(a[0] + nx * r0, a[1] + ny * r0); p.lineTo(b[0] + nx * r1, b[1] + ny * r1); p.lineTo(b[0] - nx * r1, b[1] - ny * r1); p.lineTo(a[0] - nx * r0, a[1] - ny * r0); p.closePath();
  fillS(p, col);
  c.globalAlpha = 0.35; line([[a[0] + nx * r0 * 0.5, a[1] + ny * r0 * 0.5], [b[0] + nx * r1 * 0.5, b[1] + ny * r1 * 0.5]], Math.min(r0, r1) * 0.3, "#FFF6D8"); c.globalAlpha = 1;
}
function y1801() {
  const T = G.T, c = G.ctx;
  tube([56.2, 6.4], [60.0, 4.1], 0.34, 0.42, "#A9873F"); tube([60.0, 4.1], [62.8, 2.4], 0.5, 0.56, "#B8964A");
  for (const u of [0.0, 0.5, 1.0]) { const x = 58.1 + u * 3.6, y = 5.25 - u * 2.5; line([[x - 0.25, y - 0.4], [x + 0.25, y + 0.4]], 0.06, "#7A5E28"); }
  const lt = new Path2D(); lt.rect(57.3, 7.9, 4.4, 3.0); fillS(lt, "#EDE2C8");
  for (let k = 0; k < 5; k++) line([[57.7, 9.0 + k * 0.32], [61.0 - (k === 4 ? 1.4 : 0), 9.0 + k * 0.32]], 0.025, "rgba(60,40,20,0.45)");
  txt(T.era1, 59.5, 8.45, 0.5, "#3A2414", { font: '"KMainI"' });
  dot([61.0, 10.3], 0.32, "#9C2A1E"); dot([61.0, 10.3], 0.2, "#B5392A");
  const w = new Path2D(); w.arc(60.5, 13.7, 1.0, 0, 2 * Math.PI); fillS(w, "#26303A"); dot([60.5, 13.7], 0.55, "#0E1116"); dot([60.2, 13.4], 0.12, "rgba(255,255,255,0.4)");
  const q = new Path2D(); q.moveTo(56.4, 16.7); q.quadraticCurveTo(56.8, 13.4, 58.8, 11.2); q.quadraticCurveTo(58.0, 14.2, 56.4, 16.7); fillS(q, "#EEE9DD");
  line([[56.3, 16.9], [58.7, 11.3]], 0.04, "#B9B0A0");
  const cd = new Path2D(); cd.arc(33.6, 16.2, 0.95, 0, 2 * Math.PI); fillS(cd, "#8C7A4E"); dot([33.6, 16.2], 0.5, "#EFE6CF");
  dot([33.6, 16.2], 0.13, "#F2B544"); dot([33.6, 16.2], 0.06, "#FFF0C0");
}
// ---- 1858：论文、蘸水笔、怀表、放大镜 ----
function y1858() {
  const T = G.T, c = G.ctx;
  const m = new Path2D(); m.rect(64.9, 2.3, 4.8, 5.8); fillS(m, "#EFE6D0");
  c.strokeStyle = "#2A2420"; c.lineWidth = 0.03; c.strokeRect(65.15, 2.55, 4.3, 5.3);
  const f = { font: '"KMain"', weight: 400 };
  txt(T.memoir0, 67.3, 3.5, 0.27, "#2A2420", f); txt(T.memoir1, 67.3, 3.95, 0.3, "#2A2420", f);
  line([[66.3, 4.5], [68.3, 4.5]], 0.02, "#2A2420"); txt(T.memoir2, 67.3, 4.95, 0.2, "#2A2420", f);
  for (let k = 0; k < 6; k++) line([[65.6, 5.6 + k * 0.3], [69.0, 5.6 + k * 0.3]], 0.02, "rgba(42,36,32,0.35)");
  txt(T.memoir3, 67.3, 7.55, 0.3, "#2A2420", f);
  line([[65.8, 16.1], [69.0, 11.0]], 0.2, "#2C2A2E"); line([[69.0, 11.0], [69.5, 10.6]], 0.08, "#B89A55");
  const wt = new Path2D(); wt.arc(92.5, 4.0, 1.5, 0, 2 * Math.PI); fillS(wt, "#B89A55"); dot([92.5, 4.0], 1.25, "#F3EEE2");
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; line([[92.5 + Math.cos(a) * 1.0, 4.0 + Math.sin(a) * 1.0], [92.5 + Math.cos(a) * 1.15, 4.0 + Math.sin(a) * 1.15]], 0.05, "#2A2420"); }
  line([[92.5, 4.0], [92.5, 3.2]], 0.07, "#2A2420"); line([[92.5, 4.0], [93.1, 4.3]], 0.05, "#2A2420");
  const lp = new Path2D(); lp.arc(92.6, 12.6, 1.3, 0, 2 * Math.PI); fillS(lp, "#5A3A26");
  dot([92.6, 12.6], 1.05, "rgba(210,230,225,0.35)"); line([[93.4, 13.6], [94.3, 16.6]], 0.35, "#5A3A26");
}

// ---- 1925：明信片、手帕、眼镜、铅笔、笔记本纸面 ----
function y1925() {
  const T = G.T, c = G.ctx;
  c.save(); c.translate(99.6, 5.0); c.rotate(-0.1);
  const pc = new Path2D(); pc.rect(-2.6, -1.7, 5.2, 3.4); fillS(pc, "#F1EBDD");
  c.fillStyle = "#6E9BB5"; c.fillRect(-2.4, -1.5, 4.8, 3.0);
  c.fillStyle = "#B2523A"; c.beginPath(); c.moveTo(-1.6, 0.7); c.lineTo(-1.2, -0.3); c.lineTo(0.6, -0.5); c.lineTo(1.5, 0.1); c.lineTo(1.7, 0.7); c.closePath(); c.fill();
  c.fillStyle = "#7FA36A"; c.fillRect(-1.25, -0.5, 1.9, 0.2);
  c.restore();
  txt(T.helgo, 99.7, 6.15, 0.36, "#F4EFE4", { font: '"KMainI"', rot: -0.1 });
  const cl = new Path2D(); cl.rect(97.6, 11.0, 4.2, 4.2); fillS(cl, "#F3F1EA");
  c.strokeStyle = "#5C7FA8"; c.lineWidth = 0.08; c.strokeRect(97.9, 11.3, 3.6, 3.6);
  for (const x of [123.7, 125.9]) { ring([x, 5.0], 0.85, 0.12, "#2A2420"); dot([x, 5.0], 0.75, "rgba(220,235,240,0.25)"); }
  line([[124.5, 4.9], [125.1, 4.9]], 0.1, "#2A2420");
  line([[122.8, 15.3], [126.2, 9.9]], 0.36, "#E2B73A"); line([[126.2, 9.9], [126.6, 9.4]], 0.2, "#E8CFA4"); dot([126.65, 9.35], 0.06, "#2A2A2A");
  const nb = new Path2D(); nb.rect(103.0, 3.4, 18.0, 11.6); fillS(nb, "#F4F1E8");
  c.strokeStyle = "rgba(120,150,180,0.35)"; c.lineWidth = 0.02;
  c.beginPath(); for (let x = 103.5; x < 121; x += 0.5) { c.moveTo(x, 3.6); c.lineTo(x, 14.8); } for (let y = 3.9; y < 15; y += 0.5) { c.moveTo(103.2, y); c.lineTo(120.8, y); } c.stroke();
  c.fillStyle = "rgba(60,50,40,0.18)"; c.fillRect(111.85, 3.4, 0.3, 11.6);
}
// ---- 1998：绿条打印纸、键盘、鼠标、软盘、光盘、便签 ----
function y1998() {
  const T = G.T, c = G.ctx;
  const pp = new Path2D(); pp.rect(134.0, 2.8, 18.0, 12.4); fillS(pp, "#F4F6F0");
  c.fillStyle = "#DCEBD5"; for (let y = 2.8; y < 15.2; y += 1.6) c.fillRect(134.7, y, 16.6, 0.8);
  c.fillStyle = "#C9CCC4"; for (let y = 3.1; y < 15.2; y += 0.5) { dot([134.33, y], 0.12, "#C9CCC4"); dot([151.67, y], 0.12, "#C9CCC4"); }
  const kb = new Path2D(); kb.roundRect(141.0, 15.6, 14.0, 2.2, 0.2); fillS(kb, "#D6CFBF");
  c.fillStyle = "#E6E0D2"; for (let r = 0; r < 4; r++) for (let k = 0; k < 24; k++) c.fillRect(141.3 + k * 0.56, 15.85 + r * 0.46, 0.46, 0.38);
  const ms = new Path2D(); ms.ellipse(156.1, 9.0, 0.9, 1.4, 0, 0, 2 * Math.PI); fillS(ms, "#D6CFBF");
  line([[156.1, 7.6], [156.1, 7.0], [155.4, 6.0], [156.6, 5.4]], 0.08, "#8E8778"); line([[155.5, 8.4], [156.7, 8.4]], 0.03, "#A39B8A");
  const fl = new Path2D(); fl.rect(129.4, 3.0, 2.8, 2.9); fillS(fl, "#2C3E66");
  c.fillStyle = "#AEB4BC"; c.fillRect(130.1, 3.0, 1.4, 1.0); c.fillStyle = "#F0EEE8"; c.fillRect(129.8, 4.4, 2.0, 1.3);
  const cdp = new Path2D(); cdp.arc(131.0, 12.0, 1.5, 0, 2 * Math.PI); fillS(cdp, "#C9CED6");
  ring([131.0, 12.0], 1.1, 0.05, "rgba(255,255,255,0.5)"); dot([131.0, 12.0], 0.3, SURF[4]);
  const sk = new Path2D(); sk.rect(155.2, 2.3, 2.6, 2.6); fillS(sk, "#F2DC6B", 0.6);
  txt(T.era4, 156.5, 3.6, 0.62, "#2A2A2A", { weight: 700, rot: 0.06 });
}
// ---- 今天：手机、平板外壳、杯子、耳机盒、手表、笔（屏幕由 today.js 画）----
function today() {
  const c = G.ctx;
  const ph = new Path2D(); ph.roundRect(174.6, 3.8, 5.2, 10.4, 0.7); fillS(ph, "#9DA3AA");
  c.fillStyle = "#121417"; rr(174.75, 3.95, 4.9, 10.1, 0.6); c.fill();
  const tb = new Path2D(); tb.roundRect(162.0, 3.0, 10.6, 7.4, 0.5); fillS(tb, "#5E646B");
  c.fillStyle = "#101215"; rr(162.2, 3.2, 10.2, 7.0, 0.36); c.fill();
  const sc = new Path2D(); sc.arc(186.6, 4.6, 2.3, 0, 2 * Math.PI); fillS(sc, "#F3F1EC"); ring([186.6, 4.6], 1.75, 0.18, "#E2DED6");
  dot([186.6, 4.6], 1.6, "#FFFFFF"); dot([186.6, 4.6], 1.25, "#5A3A24"); dot([186.2, 4.3], 0.25, "rgba(255,255,255,0.25)");
  const bd = new Path2D(); bd.roundRect(185.3, 12.5, 2.6, 2.2, 0.8); fillS(bd, "#FBFBF8"); line([[185.5, 13.25], [187.7, 13.25]], 0.02, "#D8D6D0");
  const wt = new Path2D(); wt.roundRect(163.6, 13.1, 1.8, 2.0, 0.45); fillS(wt, "#2A2D31"); rr(163.8, 13.3, 1.4, 1.6, 0.35); c.fillStyle = "#0B0C0E"; c.fill();
  line([[166.9, 12.6], [171.7, 12.6]], 0.26, "#3A4A6A"); line([[171.7, 12.6], [171.9, 12.6]], 0.1, "#C0C4CA");
}
const DESK = [han, y1801, y1858, y1925, y1998, today];
export function drawDesks() {
  const v = view();
  for (let i = 0; i < 6; i++) {
    if (i * 32 > v[2] || i * 32 + 32 < v[0]) continue;
    surface(i);
    if (G.k.s >= 6) DESK[i]();
    if (i > 0) { G.ctx.fillStyle = "rgba(0,0,0,0.35)"; G.ctx.fillRect(i * 32 - 0.03, 0, 0.06, 18); }
  }
}
