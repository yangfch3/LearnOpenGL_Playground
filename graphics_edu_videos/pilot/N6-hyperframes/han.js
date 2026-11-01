// 第 1 章：漆算板。先用天平讲「两边拿走一样的还相等」，再把线索摆成算筹列，遍乘直除
import { G, COL, hs, rr, fillS, txt, line, dot, ring, rod, ga, visible } from "./draw.js";
import { seg, win, E, lerp, clamp01 } from "./world.js";

const RL = 0.56, RW = 0.085, SP = 0.14;
// 一位算筹数字：纵式（个、百位）/ 横式（十位）。返回棍子线段 [[x0,y0],[x1,y1]]（以字中心为原点）
function digitRods(n, horiz) {
  const out = [], h = RL / 2;
  if (n === 0) return out;
  const five = n >= 6, k = five ? n - 5 : n;
  if (!horiz) {
    const y0 = five ? -0.06 : -h, y1 = h;
    for (let i = 0; i < k; i++) { const x = (i - (k - 1) / 2) * SP; out.push([[x, y0], [x, y1]]); }
    if (five) out.push([[-h * 0.85, -h], [h * 0.85, -h]]);
  } else {
    const x0 = -h, x1 = h, top = five ? -0.04 : -((k - 1) / 2) * SP;
    for (let i = 0; i < k; i++) { const y = (five ? 0.02 + i * SP : top + i * SP); out.push([[x0, y], [x1, y]]); }
    if (five) out.push([[0, -h], [0, -0.1]]);
  }
  return out;
}
export function numRods(v) { // 多位数：自左向右；个位纵、十位横、百位纵
  const ds = String(v).split("").map(Number), out = [], n = ds.length;
  ds.forEach((d, i) => { const place = n - 1 - i, cx = (i - (n - 1) / 2) * 0.74; for (const [a, b] of digitRods(d, place % 2 === 1)) out.push([[a[0] + cx, a[1]], [b[0] + cx, b[1]]]); });
  return out;
}
function drawNum(v, x, y, a = 1, col = COL.rod, sc = 1) {
  if (a <= 0.01 || v === 0) return;
  ga(a); for (const [p, q] of numRods(v)) rod([x + p[0] * sc, y + p[1] * sc], [x + q[0] * sc, y + q[1] * sc], RW * sc, col, sc > 0.6); ga(1);
}
function board(ga0) {
  const c = G.ctx, p = new Path2D(); p.rect(8.6, 3.4, 14.8, 10.2); fillS(p, COL.lacq);
  c.strokeStyle = COL.cinn; c.lineWidth = 0.22; c.strokeRect(8.75, 3.55, 14.5, 9.9);
  if (ga0 <= 0.01) return;
  ga(ga0); c.lineWidth = 0.035; c.strokeStyle = "rgba(158,43,30,0.75)";
  c.beginPath(); for (const x of [10.6, 14.2, 17.8, 21.4]) { c.moveTo(x, 4.0); c.lineTo(x, 12.0); }
  for (const y of [5.95, 7.85]) { c.moveTo(10.6, y); c.lineTo(21.4, y); } c.stroke();
  c.lineWidth = 0.07; c.beginPath(); c.moveTo(10.6, 9.9); c.lineTo(21.4, 9.9); c.stroke();
  const T = G.T;
  ga(1);
  ["he0", "he1", "he2", "shi"].forEach((k, i) => txt(T[k], 9.6, [5.0, 6.9, 8.8, 11.0][i], 0.42, "#C9B48A", { weight: 600, alpha: ga0 }));
}

// ---- 天平（画在算板上的线描）----
const SHC = ["#E0B54A", "#CDBB6A", "#A6AE62"], VAL = [9.25, 4.25, 2.75], IV = "#E9DDB5";
function icon(x, y, k, a = 1) {
  if (a <= 0.01) return;
  const c = G.ctx; ga(a); c.fillStyle = SHC[k]; c.beginPath(); c.ellipse(x, y, 0.2, 0.11, 0, 0, 2 * Math.PI); c.fill();
  c.fillStyle = "#7A5530"; c.fillRect(x + 0.02, y - 0.11, 0.05, 0.22); ga(1);
}
function slots(cnt) { // 每个图标在左盘上的位置（盘中心为原点），三种禾依次排，每行 6 个，从盘面往上堆
  const out = []; let i = 0;
  cnt.forEach((n, k) => { for (let j = 0; j < n; j++, i++) out.push([k, ((i % 5) - 2) * 0.38, -0.2 - Math.floor(i / 5) * 0.26]); });
  return out;
}
// 摆角：目标角变化后按阻尼振荡收敛
function swing(keys, t) {
  let th = 0, prev = 0, t0 = -99;
  for (const [tk, v] of keys) { if (t < tk) break; prev = th; th = v; t0 = tk; }
  const u = t - t0;
  return th + (prev - th) * Math.exp(-3.5 * u) * Math.cos(8 * u);
}
function balance(cx, cy, th, draw, a) {
  if (a <= 0.01) return;
  const c = G.ctx, L = 2.2; ga(a);
  line([[cx, cy + 2.0], [cx, cy - 1.9]], 0.12, IV); line([[cx - 1.1, cy + 2.0], [cx + 1.1, cy + 2.0]], 0.14, IV);
  dot([cx, cy - 1.95], 0.16, COL.cinn);
  const ex = Math.cos(th) * L, ey = Math.sin(th) * L, ends = [[cx - ex, cy - 1.95 - ey], [cx + ex, cy - 1.95 + ey]];
  line([ends[0], ends[1]], 0.13, IV);
  const pans = ends.map((e) => [e[0], e[1] + 1.7]);
  for (const [e, p] of ends.map((e, i) => [e, pans[i]])) {
    line([e, [p[0] - 0.95, p[1]]], 0.03, IV); line([e, [p[0] + 0.95, p[1]]], 0.03, IV);
    c.strokeStyle = IV; c.lineWidth = 0.09; c.beginPath(); c.moveTo(p[0] - 1.1, p[1]); c.quadraticCurveTo(p[0], p[1] + 0.5, p[0] + 1.1, p[1]); c.stroke();
  }
  ga(1); draw(pans[0], pans[1], a);
}
function weight(p, v, a, col = IV) { // 右盘：一堆谷子 + 斗数
  if (a <= 0.01) return;
  const c = G.ctx; ga(a); c.fillStyle = "#D8B85E"; c.beginPath(); c.ellipse(p[0], p[1] - 0.12, 0.8, 0.28, 0, Math.PI, 2 * Math.PI); c.fill(); ga(1);
  txt(`${v} ${G.T.dou}`, p[0], p[1] - 0.75, 0.46, col, { weight: 700, font: '"Noto Sans SC"', alpha: a });
}
function stone(p, a, dy) { if (a > 0.01) { ga(a); dot([p[0] + 0.55, p[1] - 0.25 - dy], 0.24, "#8C8C88"); ga(1); } }

function balances(t, B, fade) {
  const c1 = [11.9, 8.9], c2 = [20.1, 8.9];
  // 天平一：线索一。拿走一捆上禾（错）→ 倾斜；两边各放一块石头 → 仍平
  const a1 = seg(t, B.balIn, B.balIn + 0.6, E.sine) * fade, gone = t >= B.wrong[0] && t < B.wrong[1];
  const th1 = swing([[B.wrong[0] + 0.25, 0.22], [B.wrong[1] + 0.25, 0]], t);
  balance(c1[0], c1[1], th1, (pl, pr, a) => {
    slots([3, 2, 1]).forEach(([k, x, y], i) => {
      let dy = 0, al = seg(t, B.balIn + 0.3 + i * 0.08, B.balIn + 0.55 + i * 0.08, E.o3);
      if (i === 0) { const u = seg(t, B.wrong[0], B.wrong[0] + 0.4, E.o2) - seg(t, B.wrong[1] - 0.4, B.wrong[1], E.i2); dy = 1.4 * u; al *= 1 - 0.6 * u; }
      icon(pl[0] + x, pl[1] + y - dy, k, al * a);
    });
    weight(pr, 39, a);
    const sa = win(t, B.stones[0], B.stones[1], 0.3, 0.3) * a, sd = 1.2 * (1 - seg(t, B.stones[0], B.stones[0] + 0.3, E.o3));
    stone(pl, sa, sd); stone(pr, sa, sd);
  }, a1);
  if (gone && t > B.wrong[0] + 0.3) txt("✕", c1[0], c1[1] - 3.3, 0.7, COL.red, { weight: 700, alpha: win(t, B.wrong[0] + 0.3, B.wrong[1], 0.2, 0.2) });
  // 天平二：线索二 → ×3 → 两次拿走一份线索一
  const a2 = seg(t, B.t5, B.t5 + 0.6, E.sine) * fade;
  if (a2 <= 0.01) return;
  const n3 = t >= B.x3, subN = (t >= B.sub[0] + 0.7 ? 1 : 0) + (t >= B.sub[1] + 0.7 ? 1 : 0);
  const cnt = n3 ? [6 - 3 * subN, 9 - 2 * subN, 3 - subN] : [2, 3, 1], w = n3 ? 102 - 39 * subN : 34;
  balance(c2[0], c2[1], 0, (pl, pr, a) => {
    const pop = n3 && subN === 0, re = subN > 0 ? seg(t, B.sub[subN - 1] + 0.7, B.sub[subN - 1] + 0.95, E.sine) : 1;
    slots(cnt).forEach(([k, x, y], i) => icon(pl[0] + x, pl[1] + y, k, a * re * (pop ? seg(t, B.x3 + i * 0.03, B.x3 + 0.25 + i * 0.03, E.o3) : 1)));
    weight(pr, w, a);
  }, a2);
  txt("×3", c2[0], c2[1] - 3.4, 0.62, COL.red, { weight: 700, font: '"JBM"', alpha: win(t, B.x3 - 0.1, B.sub[0] + 0.2, 0.25, 0.3) * fade });
  for (const s0 of B.sub) { // 一份线索一从天平一飞到天平二
    const u = seg(t, s0, s0 + 0.7, E.io2), al = win(t, s0, s0 + 0.95, 0.15, 0.25) * fade;
    if (al <= 0.01) continue;
    const ox = lerp(0, c2[0] - c1[0], u), oy = -1.6 * Math.sin(Math.PI * u);
    slots([3, 2, 1]).forEach(([k, x, y]) => icon(c1[0] - 2.2 + x + ox, c1[1] - 0.25 + y + oy, k, al * 0.9));
    txt(`39 ${G.T.dou}`, c1[0] + 2.2 + ox, c1[1] - 1.0 + oy, 0.4, COL.red, { weight: 700, alpha: al });
  }
  const za = win(t, B.zero, B.t7_e, 0.3, 0.3) * fade;
  if (za > 0.01) { ring([c2[0] - 2.9, c2[1] - 0.6], 0.5, 0.06, COL.red); txt("0", c2[0] - 2.9, c2[1] - 0.6, 0.5, COL.red, { weight: 700, font: '"JBM"', alpha: za }); }
}

// ---- 算筹列 ----
function colState(H, t) { // 每列：[当前值, 上一值, 变化时刻]
  const st = [[H.clues[2], null, -1], [H.clues[1], null, -1], [H.clues[0], null, -1]];
  for (const e of H.ev) if (t >= e.t) st[e.col] = [e.vals, st[e.col][0], e.t];
  return st;
}
function columns(t, B, H, a, red) {
  const st = colState(H, t);
  st.forEach(([v, pv, te], ci) => {
    const x = H.colx[ci], ap = a * seg(t, B.toRods + (2 - ci) * 0.4, B.toRods + (2 - ci) * 0.4 + 0.5, E.o3);
    const u = te < 0 ? 1 : seg(t, te, te + 0.3, E.o2);
    H.rowy.forEach((y, ri) => {
      if (pv && u < 1 && pv[ri] !== v[ri]) drawNum(pv[ri], x, y - 0.25 * u, ap * (1 - u));
      const same = !pv || pv[ri] === v[ri];
      drawNum(v[ri], x, y + (same ? -0.6 * (1 - seg(t, B.toRods + (2 - ci) * 0.4, B.toRods + (2 - ci) * 0.4 + 0.5, E.o3)) : 0.25 * (1 - u)), same ? ap : ap * u, red && ci === 0 && ri >= 2 ? COL.red : COL.rod);
    });
  });
  for (const e of H.ev) {
    const fa = win(t, e.t - 0.45, e.t + 0.45, 0.15, 0.25) * a;
    if (fa > 0.01) { G.ctx.strokeStyle = COL.red; G.ctx.lineWidth = 0.06; ga(fa); rr(H.colx[e.col] - 1.65, 4.05, 3.3, 7.9, 0.2); G.ctx.stroke(); ga(1); }
    if (e.kind === "mul") txt(`×${e.f}`, H.colx[e.col], 3.95, 0.5, COL.red, { weight: 700, font: '"JBM"', alpha: win(t, e.t - 0.3, e.t + 0.6, 0.15, 0.2) * a });
    else {
      const u = seg(t, e.t - 0.45, e.t, E.io2), al = win(t, e.t - 0.45, e.t + 0.15, 0.1, 0.15) * a;
      if (al > 0.01) { const sv = colState(H, e.t - 0.5)[e.src][0], x = lerp(H.colx[e.src], H.colx[e.col], u); H.rowy.forEach((y, ri) => drawNum(sv[ri], x, y, al * 0.75, COL.red)); }
    }
  }
}
function finRods(t, B, H) { // 第 8 章：方阵裂成成百上千列，再收回，算筹飞回筹堆
  const [b0, b1] = B.burst, [c0, c1] = B.condense, [k0, k1] = B.back, c = G.ctx;
  const da = Math.min(seg(t, b0, b0 + 0.6, E.sine), 1 - seg(t, c0, c0 + 0.8, E.sine));
  if (da > 0.01) {
    const n = Math.round(3 * Math.pow(40, seg(t, b0, b1, E.io2))), m = Math.max(4, Math.round(n * 0.75)), w = 10.8 / n, h = 8.0 / m;
    c.strokeStyle = COL.rod; c.lineWidth = Math.min(0.085, w * 0.22); ga(da); c.beginPath();
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const r = hs(i * 131 + j * 7), x = 10.6 + (i + 0.5) * w, y = 4.0 + (j + 0.5) * h;
      if (r < 0.15) continue;
      if (r < 0.6) { c.moveTo(x, y - h * 0.3); c.lineTo(x, y + h * 0.3); } else { c.moveTo(x - w * 0.3, y); c.lineTo(x + w * 0.3, y); }
    }
    c.stroke(); ga(1);
  }
  const oa = seg(t, c0 + 0.4, c1, E.sine);
  if (oa <= 0.01 || t >= k1) return;
  const u = seg(t, k0, k1, E.io3);
  H.clues.forEach((v, j) => {
    const x = H.colx[2 - j];
    H.rowy.forEach((y, ri) => numRods(v[ri]).forEach(([p, q], i) => {
      const id = j * 97 + ri * 13 + i, tx = 10.8 + hs(id * 5.3) * 10.2, ty = 1.05 + hs(id * 2.1) * 1.6;
      const mx = lerp(x + (p[0] + q[0]) / 2, tx, u), my = lerp(y + (p[1] + q[1]) / 2, ty, u) - 1.5 * Math.sin(Math.PI * u), hx = (q[0] - p[0]) / 2, hy = (q[1] - p[1]) / 2;
      ga(oa * (1 - seg(t, k1 - 0.25, k1, E.lin))); rod([mx - hx, my - hy], [mx + hx, my + hy], RW, COL.rod); ga(1);
    }));
  });
}

export function draw(t) {
  if (!visible([0, 0, 32, 18])) return;
  const B = G.D.b, H = G.D.han, c = G.ctx;
  const g = seg(t, B.toRods, B.toRods + 0.8, E.sine); // 天平退场，算板格线与行名出现
  board(t < G.D.chap.han ? 0 : g * (1 - 0.85 * seg(t, B.title - 0.4, B.title + 0.8, E.sine)));
  if (g < 1 && t > B.balIn) balances(t, B, 1 - g);
  if (t >= B.toRods && t < B.burst[0] + 0.7) columns(t, B, H, 1 - seg(t, B.burst[0], B.burst[0] + 0.6, E.sine), t >= B.hi && t < B.burst[0]);
  if (t >= B.hi && t < B.t10_e + 0.3) for (const ri of [2, 3]) {
    ga(win(t, B.hi, B.t10_e + 0.3, 0.3, 0.3)); c.strokeStyle = COL.red; c.lineWidth = 0.07; rr(H.colx[0] - 1.5, H.rowy[ri] - 0.62, 3.0, 1.24, 0.3); c.stroke(); ga(1);
  }
  if (t >= B.burst[0]) finRods(t, B, H);
  // 禾捆上的签：先是问号，再写上答案
  const ta = seg(t, B.tags, B.tags + 0.5, E.o3);
  for (let k = 0; k < 3 && ta > 0.01; k++) {
    const y = H.rowy[k], at = B.ans[2 - k], p = new Path2D(); p.roundRect(6.35, y - 0.4, 1.95, 0.8, 0.12);
    ga(ta); fillS(p, "#F2E9D0", 0.6); line([[6.1, y], [6.35, y]], 0.04, "#7A5530");
    const u = seg(t, at, at + 0.35, E.o3);
    txt("?", 7.32, y + 0.02, 0.5, "#8A6A3A", { weight: 700, alpha: ta * (1 - u) });
    txt(`${H.ans[k]}${G.T.dou}`, 7.32, y + 0.02, 0.42, COL.red, { weight: 700, alpha: u }); ga(1);
  }
  for (let k = 0; k < 3; k++) { // 竹简上的三条线索依次标红
    const a = win(t, B.slipHi[k], B.t3_e + 0.4, 0.3, 0.4); if (a <= 0.01) continue;
    ga(a); line([[28.72 + 0.31 - k * 0.72 - 0.33, 4.6], [28.72 + 0.31 - k * 0.72 - 0.33, 12.9]], 0.06, COL.red); ga(1);
  }
}
