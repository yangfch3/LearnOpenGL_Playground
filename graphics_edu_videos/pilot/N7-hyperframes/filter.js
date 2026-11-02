// 下集 3 滤镜的纯逻辑（无 DOM、无 import；world.js 的工具经参数传入）：手机位姿与屏幕像素的世界坐标、颜色立方体坐标、
// 点云飞行、色卡点对、校正矩阵插值、纸上读数与立体文字的位置。浏览器与 check.mjs 共用
export function makeF3(W, D) {
  const F = D.f3;
  if (!F) return null;
  const { seg, E, lerp, clamp01, tr } = W, b = D.b;
  const photo = Uint8Array.from(atob(F.photo), (c) => c.charCodeAt(0));
  const rgbAt = (px, py) => { const i = (py * F.pw + px) * 3; return [photo[i], photo[i + 1], photo[i + 2]]; };
  const PAGE_Z = 0.14; // 纸面高度（书页堆叠约 0.1–0.14）
  // ---- 手机：pose = [x, y, 抬起高度]；屏幕局部坐标 (u, v)，单位为格，原点在屏幕中心，v 向上 ----
  const pose = (t) => { const v = tr(D, "phone", t, [F.phone.c[0], F.phone.c[1], 0]); return { x: v[0], y: v[1], lift: v[2] }; };
  const topZ = (t) => PAGE_Z + F.phone.th + pose(t).lift;
  function scrW(t, u, v) {
    const p = pose(t), a = (F.phone.rot * Math.PI) / 180;
    return [p.x + u * Math.cos(a) - v * Math.sin(a), p.y + u * Math.sin(a) + v * Math.cos(a), PAGE_Z + F.phone.th + p.lift + 0.01];
  }
  const pixUV = (px, py) => [((px + 0.5) / F.pw - 0.5) * F.phone.sw, (0.5 - (py + 0.5) / F.ph) * F.phone.sh];
  const sampPix = (k) => [(k % F.nx) * F.step + F.step / 2, Math.floor(k / F.nx) * F.step + F.step / 2];
  // ---- 颜色立方体：黑角在 o，红 +x、绿 +y、蓝 +z；pop 为立起的程度 ----
  const pop = (t) => tr(D, "cube", t);
  const cubeW = (t, c) => [F.cube.o[0] + (c[0] / 255) * F.cube.e, F.cube.o[1] + (c[1] / 255) * F.cube.e, PAGE_Z + (c[2] / 255) * F.cube.e * pop(t)];
  // ---- 滤镜矩阵 Mf(t)（3c 起）：每个像素的颜色乘它；立方体里的点就是颜色本身，所以跟着挪 ----
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mul = (M, c) => M.map((r) => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]);
  const Mf = (t) => tr(D, "filt", t, I3);
  const fcol = (M, c) => mul(M, c).map((v) => Math.max(0, Math.min(255, v)));
  const defU = (M) => { let s = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += Math.abs(M[i][j] - I3[i][j]); return clamp01(s * 4); };
  // ---- 点云：第 k 个采样像素从屏幕飞进立方体（弧线），之后停在它（滤镜后）的颜色位置 ----
  const N = F.nx * F.ny, cols = Array.from({ length: N }, (_, k) => rgbAt(...sampPix(k)));
  function flyAt(t, k, t0, M = Mf(t)) {
    const u = seg(t, t0, t0 + F.fly, E.io2), [px, py] = sampPix(k), a = scrW(t0, ...pixUV(px, py)), c = cubeW(t, fcol(M, cols[k]));
    const h = F.fh[k] * Math.sin(Math.PI * u);
    return [lerp(a[0], c[0], u), lerp(a[1], c[1], u), lerp(a[2], c[2], u) + h];
  }
  function cloud(t) {
    const out = [], fa = tr(D, "cloudA", t, 1), M = Mf(t);
    for (let k = 0; k < N; k++) {
      const t0 = k === F.tapK ? b.fly1[0] : b.pour[0] + F.fdt[k];
      if (t < t0) continue;
      out.push({ k, p: flyAt(t, k, t0, M), c: fcol(M, cols[k]), a: fa, fly: t < t0 + F.fly });
    }
    return out;
  }
  // 3d：扫描线扫过的每一行，原图的全部像素都落进立方体（点云由稀变密）；fn(位置, 颜色, 不透明度)
  function denseEach(t, fn) {
    const s = tr(D, "scan", t);
    if (s <= 0) return;
    const M = Mf(t);
    for (let py = 0; py < F.ph; py++) {
      const d = s - (py + 0.5) / F.ph, a = clamp01(d / 0.04), fresh = 1 - clamp01(d / 0.18); // 刚扫过的一行先大后小：亮一下
      if (a <= 0) break;
      for (let px = 0; px < F.pw; px++) { const c = fcol(M, rgbAt(px, py)); fn(cubeW(t, c), c, a, fresh); }
    }
  }
  // 被高亮的像素：照片上画圈、立方体里点放大（同一个像素两处同时亮）
  const C3 = D.f3c;
  function hl(t) {
    const out = [];
    if (!C3) return out;
    for (const [t0, t1, ks] of C3.hl) {
      const a = W.win(t, t0, t1, 0.35, 0.4);
      if (a > 0.003) for (const [px, py] of ks) out.push({ px, py, a, c: fcol(Mf(t), rgbAt(px, py)) });
    }
    return out;
  }
  // 手机下沿的工具条：按钮 0 暖色、1 黑白、2 撤销；返回当前选中的按钮、点按的涟漪、按了没反应时的抖动
  function ui(t) {
    if (!C3 || t < b.tbar) return null;
    let on = -1, rip = null, shake = 0;
    for (const [t0, btn, ok] of C3.taps) {
      if (t < t0) break;
      if (ok) on = btn === 2 ? -1 : btn;
      const u = (t - t0) / 0.5;
      if (u < 1) rip = { btn, u };
      if (!ok && t - t0 < 0.5) shake = Math.sin((t - t0) * 40) * (1 - (t - t0) / 0.5);
    }
    return { a: seg(t, b.tbar, b.tbar + 0.4, E.sine), on, rip, shake };
  }
  // 纸上的滤镜矩阵：换一个矩阵时旧的数先淡去，新的数逐个写出
  function fmAt(t) {
    if (!C3) return null;
    const S = C3.fm.states;
    let i = -1;
    for (let j = 0; j < S.length; j++) if (t >= S[j][0]) i = j;
    if (i < 0) return null;
    const [w0, w1, vals] = S[i], old = i > 0 ? S[i - 1][2] : null;
    return { vals, old, oldA: old ? 1 - seg(t, w0, w0 + 0.25, E.sine) : 0, rev: seg(t, w0 + (old ? 0.25 : 0), w1, E.lin) };
  }
  // 变形后的颜色空间：单位立方体的八个角乘 Mf（3c 起与原立方体对照）
  const tcube = (t, x, y, z) => cubeW(t, mul(Mf(t), [x * 255, y * 255, z * 255]));
  // ---- 色卡：24 个点对（真实 = 实心点，拍出 = 空心圈）；校正矩阵 M(u) = I + u(CCM − I) ----
  const Mu = (t) => { const u = tr(D, "solve", t); return F.ccm.map((r, i) => r.map((v, j) => lerp(i === j ? 1 : 0, v, u))); };
  const shown = (t) => (t < b.pairs[0] ? 0 : Math.min(24, Math.floor((t - b.pairs[0]) / b.pairs[1]) + 1));
  const clrA = (t) => (b.clr === undefined ? 1 : 1 - seg(t, b.clr, b.clr + 0.6, E.sine)); // 3c 开头：3b 的推导淡去
  function pairs(t) {
    const M = Mu(t), n = clrA(t) > 0.003 ? shown(t) : 0, out = [];
    for (let i = 0; i < n; i++) {
      const c = mul(M, F.cap[i]).map((v) => Math.max(0, Math.min(255, v))), t0 = b.pairs[0] + i * b.pairs[1];
      out.push({ i, tp: cubeW(t, F.ref[i]), cp: cubeW(t, c), cc: c, a: seg(t, t0, t0 + 0.25, E.o2) * clrA(t), pulse: Math.sin(Math.PI * clamp01((t - t0) / 0.5)) });
    }
    return out;
  }
  const dev = (t) => { const M = Mu(t); let s = 0; for (let i = 0; i < 24; i++) { const c = mul(M, F.cap[i]); for (let j = 0; j < 3; j++) s += (c[j] - F.ref[i][j]) ** 2; } return Math.sqrt(s / 24); };
  // 当前点亮对应关系的色块（色卡、屏幕、立方体里的点对同时强调）
  const pulseOf = (t, i) => Math.sin(Math.PI * clamp01((t - (b.pairs[0] + i * b.pairs[1])) / 0.5));
  // ---- 纸上随过程变的读数（绘制与校验共用）----
  const fmt2 = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2);
  function labels(T, t) {
    const out = [], push = (id, page, str, p, size, align, alpha, col = "hand") => out.push({ id, page, str, p, size, align, alpha, col, box: W.textBox(str, p, size, align) });
    const ca = clrA(t);
    if (t >= b.pairs[0] && ca > 0.003) { // 方程个数随色块逐个点亮计数：每块 3 个
      const n = 3 * shown(t), q = F.eqc;
      push("eqc", "e1", `${n} ${T["p.eqn"]}`, q.p, q.size, "left", seg(t, b.pairs[0], b.pairs[0] + 0.3, E.sine) * ca);
    }
    if (t >= b.devShow && ca > 0.003) {
      const q = F.devL, a = seg(t, b.devShow, b.devShow + 0.4, E.sine) * ca;
      push("dev", "e1", `${T["p.dev"]} ${dev(t).toFixed(1)}`, q.p, q.size, "left", a, "red");
    }
    if (C3 && t >= b.cnt[0] && t <= b.cnt[1]) { // 3d：扫描线扫到哪，像素数就数到哪（换算成一张 1200 万像素的照片）
      const q = C3.cnt, n = Math.round(1200 * Math.min(1, tr(D, "scan", t)));
      push("cnt", "e0", `${T["p.px"]} ${n} ${T["p.wan"]}`, q.p, q.size, "left", W.win(t, b.cnt[0], b.cnt[1], 0.3, 0.4));
    }
    return out;
  }
  // 校正矩阵的九个格：先写成 ?，解的过程中变成当前的数
  function mxVals(t) {
    const M = Mu(t), solving = tr(D, "solve", t) > 0;
    return M.map((r) => r.map((v) => (solving ? fmt2(v) : "?")));
  }
  // ---- 立体文字（Sprite）：立方体三条棱的名字、点开的那个像素在三条棱上的读数 ----
  function sprites(T, t) {
    const out = [], p = pop(t), o = F.cube.o, e = F.cube.e, z0 = PAGE_Z;
    const nameA = seg(t, b.cubeLbl, b.cubeLbl + 0.4, E.sine);
    if (nameA > 0) {
      out.push({ id: "axR", str: T["p.R"], p: [o[0] + e + 1.3, o[1], z0 + 1.0], size: 2.2, alpha: nameA });
      out.push({ id: "axG", str: T["p.G"], p: [o[0] + 1.4, o[1] + e + 1.3, z0], size: 2.2, alpha: nameA });
      out.push({ id: "axB", str: T["p.B"], p: [o[0] - 0.6, o[1], z0 + e * p + 1.6], size: 2.2, alpha: nameA });
    }
    const [a0, dt] = b.axn, c = F.tap, fo = 1 - seg(t, b.axnOut, b.axnOut + 0.4, E.sine);
    const pos = [[o[0] + (c[0] / 255) * e + 1.5, o[1] + 1.2, z0], [o[0] - 2.2, o[1] + (c[1] / 255) * e + 0.8, z0], [o[0] - 2.4, o[1] - 0.6, z0 + (c[2] / 255) * e]];
    for (let i = 0; i < 3; i++) {
      const a = seg(t, a0 + i * dt, a0 + i * dt + 0.3, E.sine) * fo;
      if (a > 0) out.push({ id: "axv" + i, str: String(c[i]), p: pos[i], size: 1.9, alpha: a, red: true, pulse: Math.sin(Math.PI * clamp01((t - a0 - i * dt) / 0.45)) });
    }
    // 3e：红花与绿草落到同一个灰点上方，先写「同一种灰」，按撤销不动后换成「红？绿？」
    if (C3 && b.same) {
      const g = cubeW(t, fcol(Mf(t), F.tap)), p = [g[0] + 4.8, g[1], g[2] - 1.6]; // 写在灰线右下方的空处，不压线、不碰棱名
      const a1 = W.win(t, b.same[0], b.same[1], 0.35, 0.3), a2 = W.win(t, b.rg[0], b.rg[1], 0.35, 0.4);
      if (a1 > 0) out.push({ id: "gray1", str: T["p.gray1"], p, size: 2.0, alpha: a1 });
      if (a2 > 0) out.push({ id: "rg", str: T["p.rg"], p, size: 2.2, alpha: a2, red: true, pulse: Math.sin(Math.PI * clamp01((t - b.rg[0]) / 0.5)) });
    }
    return out;
  }
  const cubeCorners = (t) => { const r = []; for (const x of [0, 255]) for (const y of [0, 255]) for (const z of [0, 255]) r.push(cubeW(t, [x, y, z])); return r; };
  const phoneCorners = (t) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => scrW(t, (u * F.phone.w) / 2, (v * F.phone.h) / 2));
  return { F, C3, rgbAt, pose, topZ, scrW, pixUV, sampPix, pop, cubeW, cloud, flyAt, Mu, mul, pairs, dev, pulseOf, labels, mxVals, sprites, cubeCorners, phoneCorners, shown, PAGE_Z,
    Mf, fcol, defU, denseEach, hl, ui, fmAt, tcube, clrA };
}
