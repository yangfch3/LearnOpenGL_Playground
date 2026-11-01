// N7 纯逻辑核心（无 DOM、无 import）：缓动、相机与投影、翻页角、矩阵插值、动物位置、标注包围盒。浏览器与 check.mjs 共用
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const E = {
  io2: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2),
  io3: (u) => (u < 0.5 ? 4 * u ** 3 : 1 - 4 * (1 - u) ** 3),
  o3: (u) => 1 - (1 - u) ** 3,
  o2: (u) => 1 - (1 - u) ** 2,
  i2: (u) => u * u,
  sine: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
  lin: (u) => u,
};
export const seg = (t, a, b, e = E.io2) => e(clamp01((t - a) / (b - a)));
export const win = (t, a, b, dIn = 0.4, dOut = 0.4) => Math.min(seg(t, a, a + dIn, E.sine), 1 - seg(t, b - dOut, b, E.sine));
const lerpArr = (a, b, u) => (Array.isArray(a) ? a.map((v, i) => lerpArr(v, b[i], u)) : lerp(a, b, u));
// 关键帧轨道：v0 起始值，keys = [[起, 止, 目标], ...]，段间保持，段内 io2（或段自带缓动名）
export function track(v0, keys, t) {
  let v = v0;
  for (const [t0, t1, N, ez] of keys) {
    if (t <= t0) break;
    v = lerpArr(v, N, E[ez || "io2"](clamp01((t - t0) / (t1 - t0))));
    if (t < t1) break;
  }
  return v;
}

// ---- 相机：画面中心 c（桌面上的点）、纸面半高 hh、k = 1/视距（0 即正交）、偏航 yaw、俯仰 pitch（度）----
export const CAM_KEYS = ["c", "hh", "k", "yaw", "pitch"];
export function makeCam(D) {
  function at(t) {
    const s = { c: D.cam0.c.slice(), hh: D.cam0.hh, k: D.cam0.k, yaw: D.cam0.yaw, pitch: D.cam0.pitch };
    for (const [t0, t1, g] of D.cam) {
      if (t <= t0) break;
      const e = E[g.ease || "io2"](clamp01((t - t0) / (t1 - t0)));
      if (g.c) s.c = s.c.map((v, i) => lerp(v, g.c[i], e));
      if (g.hh) s.hh = Math.exp(lerp(Math.log(s.hh), Math.log(g.hh), e));
      for (const k of ["k", "yaw", "pitch"]) if (g[k] !== undefined) s[k] = lerp(s[k], g[k], e);
      if (t < t1) break;
    }
    return s;
  }
  // 世界点（桌面 z = 0，z 向上）→ 屏幕 [x, y, w]。俯仰 0 时正视桌面；俯仰增大，相机从 −y 一侧斜看过去
  function project(c, p) {
    const a = (c.yaw * Math.PI) / 180, q = (c.pitch * Math.PI) / 180;
    const dx = p[0] - c.c[0], dy = p[1] - c.c[1], dz = p[2] || 0;
    const x1 = dx * Math.cos(a) + dy * Math.sin(a), y1 = -dx * Math.sin(a) + dy * Math.cos(a);
    const yv = y1 * Math.cos(q) + dz * Math.sin(q), zv = -y1 * Math.sin(q) + dz * Math.cos(q);
    const w = Math.max(0.05, 1 - c.k * zv), f = 540 / c.hh;
    return [960 + (x1 / w) * f, 540 - (yv / w) * f, w];
  }
  // 屏幕运动速度：画面四角与中心处桌面点一帧（60fps）内的最大屏幕位移
  const probe = [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95], [0, 0]];
  function speed(t) {
    const a = at(t), b = at(t + 1 / 60);
    let m = 0;
    for (const [u, v] of probe) {
      const p = [a.c[0] + u * a.hh * 1.6, a.c[1] + v * a.hh, 0], r0 = project(a, p), r1 = project(b, p);
      m = Math.max(m, Math.hypot(r1[0] - r0[0], r1[1] - r0[1]));
    }
    return m;
  }
  const flat = (c) => Math.abs(c.pitch) < 1e-6 && Math.abs(c.yaw) < 1e-6 && Math.abs(c.k) < 1e-9;
  return { at, project, speed, flat };
}
export const subframes = (v) => Math.min(16, Math.max(1, Math.ceil((v * 0.5) / 1.5)));

// ---- 翻页：每张纸（leaf）一个角 θ（0 = 躺在右边，π = 躺在左边），绕书脊 x = 0 转 ----
export function leafAngles(D, t) {
  const th = D.leaf0.slice();
  for (const [i, t0, t1, a0, a1] of D.flips) if (t > t0) th[i] = lerp(a0, a1, E.sine(clamp01((t - t0) / (t1 - t0))));
  return th;
}
// 当前能看见的纸面：右堆最上一张的正面、左堆最上一张的背面、正在翻的纸
export function pagesAt(D, t) {
  const th = leafAngles(D, t), n = th.length;
  let r = -1, l = -1;
  for (let i = 0; i < n; i++) if (th[i] <= 1e-6) { r = i; break; }
  for (let i = n - 1; i >= 0; i--) if (th[i] >= Math.PI - 1e-6) { l = i; break; }
  const moving = [];
  for (let i = 0; i < n; i++) if (th[i] > 1e-6 && th[i] < Math.PI - 1e-6) moving.push([i, th[i]]);
  return { th, right: r >= 0 ? D.leaves[r][0] : null, left: l >= 0 ? D.leaves[l][1] : null, moving };
}

// ---- 矩阵（任意阶）----
export const mv = (M, p) => M.map((r) => r.reduce((s, v, j) => s + v * p[j], 0));
export const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
export const det = (M) => (M.length === 2 ? M[0][0] * M[1][1] - M[0][1] * M[1][0]
  : M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]));
export const matAt = (D, name, t) => track(D.mats[name].m0, D.mats[name].keys, t);
export const sweepAt = (keys, t) => { // 只数沿关键帧走（取整），并记录走过的范围
  if (!keys.length || t < keys[0][0]) return null;
  let k = keys[0][1], lo = k, hi = k;
  for (let i = 1; i < keys.length; i++) {
    const [t0, k0] = keys[i - 1], [t1, k1] = keys[i];
    k = Math.round(t >= t1 ? k1 : lerp(k0, k1, clamp01((t - t0) / (t1 - t0)))); lo = Math.min(lo, k); hi = Math.max(hi, k);
    if (t < t1) break;
  }
  return { k, lo, hi };
};

// ---- 动物：moves = [[起, 止, x0, y0, x1, y1, 弧高]]；lift（抬两只脚）为时间窗；face 在起跳前 0.3s 内压扁翻面 ----
export function animals(D, t) {
  return D.animals.map((a) => {
    let x = a.x, y = a.y, face = a.face, air = 0;
    const mvs = a.moves, moving = mvs.length > 0 && t >= mvs[0][0] - 0.1 && t <= mvs[mvs.length - 1][1];
    for (const [t0, t1, x0, y0, x1, y1, h] of mvs) {
      const f1 = Math.sign(x1 - x0) || face;
      if (f1 !== face) face = lerp(face, f1, seg(t, t0 - 0.32, t0 - 0.04, E.sine));
      if (t < t0) { x = x0; y = y0; break; }
      const u = clamp01((t - t0) / (t1 - t0));
      x = lerp(x0, x1, u); y = lerp(y0, y1, u) + h * Math.sin(Math.PI * u); face = f1; air = u < 1 ? 1 : 0;
      if (t < t1) break;
    }
    let lift = 0;
    for (const [t0, t1] of a.lift) lift = Math.max(lift, Math.min(seg(t, t0, t0 + D.liftDur), 1 - seg(t, t1, t1 + D.liftDur)));
    const shown = t >= a.show[0] && t <= a.show[1], s = a.sc;
    return { id: a.id, kind: a.kind, page: a.page, sc: s, x, y, face, lift, air, shown, cage: a.cage, moving,
      box: [x - a.r[0] * s, y, x + a.r[0] * s, y + a.r[1] * s] };
  });
}
// 着地的脚（局部 x，乘 sc·face）：鸡两只（蹲坐后收起），兔四只（立起后只剩两只后脚）
export function feet(a) {
  const xs = a.kind === "chicken" ? (a.lift < 0.5 ? [-0.3, 0.25] : []) : a.kind === "rabbit" ? (a.lift < 0.5 ? [-1.0, -0.3, 0.75, 1.0] : [-1.0, -0.3]) : [-0.25, 0.25];
  return xs.map((v) => [a.x + v * a.sc * Math.sign(a.face || 1), a.y]);
}

// ---- 标注：文字宽度按字数估（全角 1 个字号，其余约 0.55）----
export const textW = (s, size) => [...s].reduce((w, ch) => w + (/[\u3000-\u9fff\uff00-\uffef①②③《》]/.test(ch) ? 1 : ch === " " ? 0.3 : 0.56) * size, 0);
export function textBox(s, p, size, align = "center") {
  const w = textW(s, size), x0 = align === "left" ? p[0] : align === "right" ? p[0] - w : p[0] - w / 2;
  return [x0, p[1] - size * 0.55, x0 + w, p[1] + size * 0.55];
}
// 纸上的静态标注：{ id, page, p, size, key|s, t: [起, 止], w: [书写起, 止], col, align, kind }
export function labels(D, T, t) {
  const out = [];
  for (const a of D.ann) {
    if (t < a.t[0] || t > a.t[1]) continue;
    const s = a.key ? T[a.key] : a.s, al = win(t, a.t[0], a.t[1], 0.01, a.fout ?? 0.3);
    out.push({ ...a, str: s, alpha: al, box: a.box || textBox(s, a.p, a.size, a.align) });
  }
  return out;
}
export const overlap = (a, b, m = 0) => a[0] < b[2] - m && b[0] < a[2] - m && a[1] < b[3] - m && b[1] < a[3] - m;

// ---- 通用参数轨道与版面几何 ----
export const tr = (D, name, t, dflt = 0) => (D.tracks[name] ? track(D.tracks[name].v0, D.tracks[name].keys, t) : dflt);
export const grW = (L, h, f) => [L.gr.o[0] + h * L.gr.sx, L.gr.o[1] + f * L.gr.sy];
export const glW = (L, x, y) => [L.gl.o[0] + x * L.gl.s, L.gl.o[1] + y * L.gl.s];
export const keyW = (L, v) => [L.vg.ko[0] + v[0] * L.vg.ks[0], L.vg.ko[1] + v[1] * L.vg.ks[1]];
export const fmtI = (v) => String(Math.round(v) + 0).replace("-", "−");
// 1c：小点沿 ① 的位置（鸡的只数，连续）
export function slideX(D, t) {
  const [a0, a1] = D.b.slide1, [b0, b1] = D.b.slide2;
  if (t < a0) return 35;
  if (t < b0) return lerp(35, 0, E.sine(clamp01((t - a0) / (a1 - a0))));
  return lerp(0, 23, E.io2(clamp01((t - b0) / (b1 - b0))));
}
// 2a–2e：右页格子矩阵 = lerp(I, M, latU)
export const latM = (D, t) => { const M = matAt(D, "M", t), u = tr(D, "latU", t); return M.map((r, i) => r.map((v, j) => lerp(i === j ? 1 : 0, v, u))); };

// 随数据移动的标注（绘制与校验共用）：1c 滑动标签；2a–2e 的箭头链终点、图例坐标、直线 ② 编号、面积倍数
export function dynLabels(D, T, t) {
  const out = [], b = D.b;
  const push = (id, page, str, p, size, align, alpha, col = "hand") => out.push({ id, page, str, p, size, align, alpha, col, box: textBox(str, p, size, align) });
  if (t >= b.slide1[0] && t < D.segs["1d"] + 0.3) { // 1d 开场随镜头离开淡出
    const g = D.g1c, x = slideX(D, t), xi = Math.round(x), p = [g.o[0] + x * g.s, g.o[1] + (35 - x) * g.s];
    const s = `鸡 ${xi} · 兔 ${35 - xi} · 脚 ${2 * xi + 4 * (35 - xi)}`;
    const off = t >= b.slide2[1] ? [2.4, 2.6] : [1.4, 1.6]; // 停在交点后让开红圈
    push("slide", "p3", s, x < 27 ? [p[0] + off[0], p[1] + off[1]] : [p[0] - 1.4, p[1] + 1.6], 1.9, x < 27 ? "left" : "right", win(t, b.slide1[0] - 0.3, D.segs["1d"] + 0.3, 0.3, 0.3));
  }
  if (t >= D.segs["2a"] && t < D.segs["2f"] + 0.5) {
    const L = D.L2, M = matAt(D, "M", t), al = 1 - seg(t, D.segs["2f"], D.segs["2f"] + 0.5, E.lin);
    const nch = b.chain.filter((x) => x <= t).length;
    if (nch >= 35) {
      const P = mv(M, [23, 12]), pp = grW(L, P[0], P[1]);
      push("pt", "p7", `(${fmtI(P[0])}, ${fmtI(P[1])})`, [pp[0] - 1.6, pp[1] + 2.3], 2.0, "right", al);
    }
    const c1 = [M[0][0], M[1][0]], c2 = [M[0][1], M[1][1]], k1 = keyW(L, c1), k2 = keyW(L, c2);
    const a1 = seg(t, b.keyC[2], b.keyC[2] + 0.4, E.sine), a2 = Math.min(seg(t, b.keyR[2], b.keyR[2] + 0.4, E.sine), 1 - seg(t, b.duckKey[0], b.duckKey[1], E.sine));
    if (a1 > 0.003) push("k1", "p6", `(${fmtI(c1[0])}, ${fmtI(c1[1])})`, [k1[0] + 1.1, k1[1]], 2.0, "left", a1 * al);
    if (a2 > 0.003) push("k2", "p6", `(${fmtI(c2[0])}, ${fmtI(c2[1])})`, [k2[0] + 1.1, k2[1]], 2.0, "left", a2 * al);
    const [la, lb, lc] = tr(D, "l2", t, [2, 4, 94]), q = glW(L, 30, (lc - la * 30) / lb);
    push("n2", "p6", "②", [q[0] + 0.6, q[1] + 1.4], 2.0, "center", al);
    if (t >= b.areaShow) {
      const d = Math.abs(det(M)), r = Math.round(d);
      const s = t >= b.areaFinal ? `${T["p.areaM"]} ×2 → ×0` : `${T["p.areaM"]} ×${Math.abs(d - r) < 0.05 ? r : d.toFixed(1)}`;
      push("area", "p7", s, L.area, L.areaSize, "left", seg(t, b.areaShow, b.areaShow + 0.4, E.sine) * al);
    }
  }
  return out;
}
