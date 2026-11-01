// N6 纯逻辑（无 DOM、无 import）：缓动、镜头、镜头速度。浏览器与 check.mjs 共用
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
  back: (u) => { const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; },
};
// seg(t, 起, 止, 缓动)：区间内 0→1
export const seg = (t, a, b, e = E.io2) => e(clamp01((t - a) / (b - a)));
// 起 a 渐入 dIn，止 b 前渐出 dOut
export const win = (t, a, b, dIn = 0.4, dOut = 0.4) => Math.min(seg(t, a, a + dIn, E.sine), 1 - seg(t, b - dOut, b, E.sine));

export function makeCam(D) {
  const segs = D.cam;
  function at(t) {
    let c = D.start.c.slice(), s = D.start.s;
    for (const [t0, t1, g] of segs) {
      if (t <= t0) break;
      const e = (g.ease ? E[g.ease] : E.io2)(clamp01((t - t0) / (t1 - t0)));
      const c1 = g.c || c, s1 = g.s || s, ls = lerp(Math.log(s), Math.log(s1), e);
      let sn = Math.exp(g.dip ? ls + (Math.log(g.dip) - (Math.log(s) + Math.log(s1)) / 2) * Math.sin(Math.PI * e) : ls);
      let cn;
      if (g.anchor) { // 锚点在屏幕上的偏移线性过渡，推拉时它平稳移动
        const P = g.anchor, q0 = [(P[0] - c[0]) * s, (P[1] - c[1]) * s], q1 = [(P[0] - c1[0]) * s1, (P[1] - c1[1]) * s1];
        cn = [P[0] - lerp(q0[0], q1[0], e) / sn, P[1] - lerp(q0[1], q1[1], e) / sn];
      } else cn = [lerp(c[0], c1[0], e), lerp(c[1], c1[1], e)];
      c = cn; s = sn;
      if (t < t1) break;
    }
    return { c, s };
  }
  const toScr = (k, p) => [960 + (p[0] - k.c[0]) * k.s, 540 + (p[1] - k.c[1]) * k.s];
  // 镜头速度：屏幕四角与中心处，固定世界点一帧内的最大屏幕位移（px/帧）
  function speed(t) {
    const a = at(t), b = at(t + 1 / 60);
    let m = 0;
    for (const q of [[0, 0], [1920, 0], [0, 1080], [1920, 1080], [960, 540]]) {
      const w = [a.c[0] + (q[0] - 960) / a.s, a.c[1] + (q[1] - 540) / a.s], r = toScr(b, w);
      m = Math.max(m, Math.hypot(r[0] - q[0], r[1] - q[1]));
    }
    return m;
  }
  return { at, toScr, speed };
}
// 运动模糊子帧数：半帧快门内子帧间位移约 ≤ 1.5px
export const subframes = (v) => Math.min(16, Math.max(1, Math.ceil((v * 0.5) / 1.5)));
// 2×2 矩阵插值：MK = [[起, 止, M], ...]，从单位阵开始
export function matAt(MK, t) {
  let M = [[1, 0], [0, 1]];
  for (const [t0, t1, N] of MK) {
    if (t <= t0) break;
    const e = E.io2(clamp01((t - t0) / (t1 - t0)));
    M = [[lerp(M[0][0], N[0][0], e), lerp(M[0][1], N[0][1], e)], [lerp(M[1][0], N[1][0], e), lerp(M[1][1], N[1][1], e)]];
    if (t < t1) break;
  }
  return M;
}
export const mv = (M, p) => [M[0][0] * p[0] + M[0][1] * p[1], M[1][0] * p[0] + M[1][1] * p[1]];
export const det = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
