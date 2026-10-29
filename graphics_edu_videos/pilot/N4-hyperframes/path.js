// N4 导演层：轨迹、朝向、动作权重、镜头与投影、分辨率、季节与光。纯函数，无 DOM、无 import，浏览器与 node 校验共用
export const clamp01 = (u) => Math.min(1, Math.max(0, u));
export const lerp = (a, b, u) => a + (b - a) * u;
export const E = {
  lin: (u) => u, io2: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2), o3: (u) => 1 - (1 - u) ** 3,
  sine: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
};
export const seg = (t, a, b, e = E.io2) => e(clamp01((t - a) / (b - a)));
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const W = 1920, H = 1080;
const pw = (keys, t, e = E.sine) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], e((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};

export function makePath(D) {
  const B = D.beats, L = D.lay, ST = L.stone;
  const surface = (x, z) => (Math.hypot(x - ST.x, z - ST.z) < ST.r ? ST.top : 0);
  // ---- 轨迹：分段匀速，累计距离给步行相位 ----
  const cum = {};
  for (const [k, tr] of Object.entries(D.track)) {
    const c = [0];
    for (let i = 1; i < tr.length; i++) c.push(c[i - 1] + Math.hypot(tr[i][1] - tr[i - 1][1], tr[i][2] - tr[i - 1][2]));
    cum[k] = c;
  }
  function at(who, t) {
    const tr = D.track[who], c = cum[who];
    if (t <= tr[0][0]) return { x: tr[0][1], z: tr[0][2], v: 0, dist: 0 };
    for (let i = 1; i < tr.length; i++) {
      if (t >= tr[i][0]) continue;
      const [t0, x0, z0] = tr[i - 1], [t1, x1, z1] = tr[i], u = (t - t0) / (t1 - t0), d = c[i] - c[i - 1];
      return { x: lerp(x0, x1, u), z: lerp(z0, z1, u), v: d / (t1 - t0), dist: c[i - 1] + d * u };
    }
    const l = tr[tr.length - 1];
    return { x: l[1], z: l[2], v: 0, dist: c[c.length - 1] };
  }
  function yaw(who, t) {
    const ks = D.face[who];
    let y = ks[0][1];
    for (const [kt, ky] of ks) {
      if (t >= kt) { y = ky; continue; }
      if (t > kt - 0.35) y = lerp(y, ky, E.io2((t - (kt - 0.35)) / 0.35));
      break;
    }
    return (y * Math.PI) / 180;
  }
  function act(who, name, t, f = 0.3) {
    let w = 0;
    for (const [w0, n, t0, t1] of D.acts) {
      if (w0 !== who || n !== name || t < t0 || t > t1) continue;
      const ff = Math.min(f, (t1 - t0) / 2);
      w = Math.max(w, Math.min(seg(t, t0, t0 + ff), 1 - seg(t, t1 - ff, t1)));
    }
    return w;
  }
  const actU = (who, name, t) => { // 动作窗口内的进度 0..1（取当前所在窗口）
    for (const [w0, n, t0, t1] of D.acts) if (w0 === who && n === name && t >= t0 && t <= t1) return (t - t0) / (t1 - t0);
    return -1;
  };

  // ---- 镜头：分段缓动到目标状态；k = 1/视距，k = 0 即正交；变焦时 T 平面的画面大小不变 ----
  function cam(t) {
    const s = JSON.parse(JSON.stringify(D.master));
    for (const [t0, t1, tgt] of D.cam) {
      if (t <= t0) break;
      const u = E.io2(clamp01((t - t0) / (t1 - t0)));
      for (const [k, v] of Object.entries(tgt)) s[k] = Array.isArray(v) ? v.map((x, i) => lerp(s[k][i], x, u)) : lerp(s[k], v, u);
    }
    return s;
  }
  function toView(c, p) {
    const a = (c.yaw * Math.PI) / 180, q = (c.pitch * Math.PI) / 180;
    const dx = p[0] - c.T[0], dy = p[1] - c.T[1], dz = p[2] - c.T[2];
    const x1 = dx * Math.cos(a) - dz * Math.sin(a), z1 = dx * Math.sin(a) + dz * Math.cos(a);
    return [x1, dy * Math.cos(q) + z1 * Math.sin(q), -dy * Math.sin(q) + z1 * Math.cos(q)];
  }
  const depthRange = (c) => [Math.max(-40, -0.85 / Math.max(c.k, 1e-6)), 40];
  function project(c, p) {
    const [x, y, z] = toView(c, p), u = -z, w = 1 + c.k * u, hw = (c.hh * W) / H;
    return { sx: ((x / (hw * w) + 1) / 2) * W, sy: ((1 - y / (c.hh * w)) / 2) * H, w, u };
  }
  // Three.js 用的矩阵（列主序）：view = 世界 → 视空间，proj 把 w 写成 1 + k·u
  function matrices(c) {
    const a = (c.yaw * Math.PI) / 180, q = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cq = Math.cos(q), sq = Math.sin(q);
    const R = [[ca, 0, -sa], [sa * sq, cq, ca * sq], [sa * cq, -sq, ca * cq]];
    const tv = R.map((r) => -(r[0] * c.T[0] + r[1] * c.T[1] + r[2] * c.T[2]));
    const view = [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, tv[0], tv[1], tv[2], 1];
    const [un, uf] = depthRange(c), hw = (c.hh * W) / H, A = (2 + c.k * (uf + un)) / (uf - un), Bc = -(1 + c.k * un) - A * un;
    const proj = [1 / hw, 0, 0, 0, 0, 1 / c.hh, 0, 0, 0, 0, -A, -c.k, 0, 0, Bc, 1];
    return { view, proj };
  }
  const eye = (c) => {
    if (c.k <= 1e-6) return null;
    const a = (c.yaw * Math.PI) / 180, q = (c.pitch * Math.PI) / 180, d = 1 / c.k;
    return [c.T[0] + d * Math.cos(q) * Math.sin(a), c.T[1] - d * Math.sin(q), c.T[2] + d * Math.cos(q) * Math.cos(a)];
  };

  // ---- 分辨率：单一状态，或一次过渡（波前自主角向外裂开 / 自外向主角合并） ----
  function res(t) {
    let s = { mode: "single", n: 16 };
    for (const [t0, lo, hi, dur, dir] of D.res) {
      if (t < t0) break;
      s = t < t0 + dur + 0.35 ? { mode: "trans", lo, hi, t0, dur, dir } : { mode: "single", n: dir > 0 ? hi : lo };
    }
    return s;
  }
  const quant = (t) => pw(D.quant, t), season = (t) => pw(D.season, t), lit = (t) => pw(D.lit, t);
  // 太阳在左前方，影子朝右后方落进麦田；秋天高，黄昏落下，冬天高而散
  function sun(t) {
    let elev = 65;
    elev = lerp(elev, 8, seg(t, B.dusk0, B.dusk1, E.sine));
    elev = lerp(elev, 45, seg(t, B.s3a, B.s3b));
    const dusk = seg(t, B.dusk0, B.dusk1, E.sine) * (1 - seg(t, B.s3a, B.s3b));
    const e = (elev * Math.PI) / 180, az = (-40 * Math.PI) / 180;
    return { dir: [Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)], elev, dusk };
  }
  const snowFall = (t) => seg(t, B.snow0, B.snow0 + 2.0, E.lin) * (1 - seg(t, B.snowEnd - 2.0, B.snowEnd, E.lin));
  const snowCover = (t) => seg(t, B.s3a, B.s3b) * (1 - seg(t, B.melt0, B.melt1));
  const fog = (t) => seg(t, B.dolly0, B.dolly1) * (1 - seg(t, B.back0w, B.back1w));
  // 风自右向左：阵风是一道向 −x 推进的波
  const wind = (x, t) => 0.25 * Math.sin(1.7 * t + 0.6 * x) + [B.gust1, B.gust2].reduce((s, g) => s + Math.exp(-(((x - (8 - 4.5 * (t - g))) / 1.4) ** 2)), 0);

  // ---- 风筝：手里 / 拖着跑 / 落地 / 男孩举着 / 天上 / 收线 / 背着；位置由女孩的手或线长给出 ----
  const kiteMode = (t) => { let m = D.kite[0]; for (const k of D.kite) if (t >= k[0]) m = k; return { mode: m[1], t0: m[0] }; };
  const KDIR = [-0.8, -0.6];
  function kiteSky(t, hand, len) {
    const el = lerp(14, 38, seg(t, B.release, B.kiteUp, E.o3)) * Math.PI / 180, h = len * Math.cos(el);
    const bob = 0.25 * Math.sin(1.3 * t) + 0.12 * Math.sin(3.1 * t + 1);
    return [hand[0] + KDIR[0] * h + bob, hand[1] + len * Math.sin(el) + 0.6 * bob, hand[2] + KDIR[1] * h];
  }
  function kite(t, girlHand) {
    const { mode, t0 } = kiteMode(t);
    if (mode === "tow") {
      const u = seg(t, B.try0, B.kiteFall, E.lin), g = at("girl", t);
      return { mode, p: [g.x - 1.0 - 0.9 * u, 0.9 + 1.5 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - 0.5 * u), g.z], tilt: 0.6 * Math.sin(9 * t) };
    }
    if (mode === "fall") {
      const u = seg(t, B.kiteFall, B.kiteFall + 0.6, E.lin), g = at("girl", B.kiteFall), [rx, rz] = L.kiteRest;
      return { mode, p: [lerp(g.x - 1.9, rx, u), lerp(0.9, 0.04, u * u), lerp(g.z, rz, u)], tilt: lerp(0, 1.45, u) + 0.4 * Math.sin(14 * t) * (1 - u) };
    }
    if (mode === "sky" || mode === "reel") {
      const len = mode === "reel" ? lerp(L.kiteL, 0.4, seg(t, B.reel0, B.reel1, E.sine)) : lerp(1.0, L.kiteL, seg(t, B.release, B.kiteUp, E.o3));
      return { mode, p: kiteSky(t, girlHand, len), tilt: 0.15 * Math.sin(2.3 * t), lift: seg(t, B.release, B.release + 0.8) };
    }
    return { mode, t0 };
  }
  // 蝴蝶：从屋前花丛起飞，绕着男孩，落到石头上的橙斑（猫）上；猫动耳朵后飞走，飞向集市
  const BF = [[0, -5.6, 0.35, 0.6], [B.bfly0, -5.6, 0.35, 0.6], [5.0, -5.0, 1.4, 0.5], [6.2, -4.2, 2.1, 0.3], [7.4, -4.8, 1.9, 0.4],
    [8.6, -3.9, 1.8, 0.2], [9.6, -2.2, 1.3, -0.4], [B.bflyLand, -1.0, 0.74, -0.78], [B.bflyOff, -1.0, 0.74, -0.78],
    [17.0, -0.2, 1.8, -0.6], [19.0, 4.0, 3.4, -1.6], [21.0, 9.5, 4.5, -2.0], [B.melt0, 9.5, 4.5, -2.0], [B.melt1 + 0.4, -5.6, 0.35, 0.6]];
  function butterfly(t) {
    let i = 1; while (i < BF.length - 1 && t >= BF[i][0]) i++;
    const a = BF[i - 1], b2 = BF[i], u = E.sine(clamp01((t - a[0]) / (b2[0] - a[0])));
    const fly = !(t < B.bfly0 || (t >= B.bflyLand && t < B.bflyOff) || (t > 21 && t < B.melt0) || t >= B.melt1 + 0.4), f = fly ? 1 : 0;
    return { p: [lerp(a[1], b2[1], u) + f * 0.12 * Math.sin(5.3 * t), lerp(a[2], b2[2], u) + f * 0.1 * Math.sin(7.1 * t), lerp(a[3], b2[3], u)],
      flap: fly ? Math.sin(2 * Math.PI * 9 * t) : 0.2 * Math.sin(2 * Math.PI * 0.7 * t), heading: b2[1] >= a[1] ? 1 : -1 };
  }
  return { B, L, surface, at, yaw, act, actU, cam, toView, project, matrices, eye, depthRange, res, quant, season, lit, sun,
    snowFall, snowCover, fog, wind, kite, kiteMode, butterfly };
}
