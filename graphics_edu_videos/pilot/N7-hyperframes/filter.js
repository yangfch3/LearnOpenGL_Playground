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
  // ---- 点云：第 k 个采样像素从屏幕飞进立方体（弧线），之后停在它的颜色位置 ----
  const N = F.nx * F.ny, cols = Array.from({ length: N }, (_, k) => rgbAt(...sampPix(k)));
  function flyAt(t, k, t0) {
    const u = seg(t, t0, t0 + F.fly, E.io2), [px, py] = sampPix(k), a = scrW(t0, ...pixUV(px, py)), c = cubeW(t, cols[k]);
    const h = F.fh[k] * Math.sin(Math.PI * u);
    return [lerp(a[0], c[0], u), lerp(a[1], c[1], u), lerp(a[2], c[2], u) + h];
  }
  function cloud(t) {
    const out = [], fa = tr(D, "cloudA", t, 1);
    for (let k = 0; k < N; k++) {
      const t0 = k === F.tapK ? b.fly1[0] : b.pour[0] + F.fdt[k];
      if (t < t0) continue;
      out.push({ k, p: flyAt(t, k, t0), c: cols[k], a: fa, fly: t < t0 + F.fly });
    }
    return out;
  }
  // ---- 色卡：24 个点对（真实 = 实心点，拍出 = 空心圈）；校正矩阵 M(u) = I + u(CCM − I) ----
  const Mu = (t) => { const u = tr(D, "solve", t); return F.ccm.map((r, i) => r.map((v, j) => lerp(i === j ? 1 : 0, v, u))); };
  const mul = (M, c) => M.map((r) => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]);
  const shown = (t) => (t < b.pairs[0] ? 0 : Math.min(24, Math.floor((t - b.pairs[0]) / b.pairs[1]) + 1));
  function pairs(t) {
    const M = Mu(t), n = shown(t), out = [];
    for (let i = 0; i < n; i++) {
      const c = mul(M, F.cap[i]).map((v) => Math.max(0, Math.min(255, v))), t0 = b.pairs[0] + i * b.pairs[1];
      out.push({ i, tp: cubeW(t, F.ref[i]), cp: cubeW(t, c), cc: c, a: seg(t, t0, t0 + 0.25, E.o2), pulse: Math.sin(Math.PI * clamp01((t - t0) / 0.5)) });
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
    if (t >= b.pairs[0]) { // 方程个数随色块逐个点亮计数：每块 3 个
      const n = 3 * shown(t), q = F.eqc;
      push("eqc", "e1", `${n} ${T["p.eqn"]}`, q.p, q.size, "left", seg(t, b.pairs[0], b.pairs[0] + 0.3, E.sine));
    }
    if (t >= b.devShow) {
      const q = F.devL, a = seg(t, b.devShow, b.devShow + 0.4, E.sine);
      push("dev", "e1", `${T["p.dev"]} ${dev(t).toFixed(1)}`, q.p, q.size, "left", a, "red");
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
    const pos = [[o[0] + (c[0] / 255) * e + 1.5, o[1] + 1.2, z0], [o[0] - 2.2, o[1] + (c[1] / 255) * e, z0], [o[0] - 2.4, o[1], z0 + (c[2] / 255) * e]];
    for (let i = 0; i < 3; i++) {
      const a = seg(t, a0 + i * dt, a0 + i * dt + 0.3, E.sine) * fo;
      if (a > 0) out.push({ id: "axv" + i, str: String(c[i]), p: pos[i], size: 1.9, alpha: a, red: true, pulse: Math.sin(Math.PI * clamp01((t - a0 - i * dt) / 0.45)) });
    }
    return out;
  }
  const cubeCorners = (t) => { const r = []; for (const x of [0, 255]) for (const y of [0, 255]) for (const z of [0, 255]) r.push(cubeW(t, [x, y, z])); return r; };
  const phoneCorners = (t) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => scrW(t, (u * F.phone.w) / 2, (v * F.phone.h) / 2));
  return { F, rgbAt, pose, topZ, scrW, pixUV, sampPix, pop, cubeW, cloud, flyAt, Mu, mul, pairs, dev, pulseOf, labels, mxVals, sprites, cubeCorners, phoneCorners, shown, PAGE_Z };
}
