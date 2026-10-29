// N3 纯逻辑：镜头、匹配剪辑主体、人物姿态。无 DOM、无 import，浏览器与 check.mjs 共用
export const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
export const lerp = (a, b, k) => a + (b - a) * k;
export const E = {
  lin: (k) => k,
  io: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  io2: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out: (k) => 1 - (1 - k) ** 3,
  out2: (k) => 1 - (1 - k) ** 2,
  in: (k) => k ** 3,
  in2: (k) => k * k,
  sine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  back: (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
};
export const seg = (t, a, b, e = E.io) => e(clamp((t - a) / (b - a)));
export const pulse = (t, a, up, hold, down) => seg(t, a, a + up) * (1 - seg(t, a + up + hold, a + up + hold + down));
export const mix = (p, q, k) => p.map((v, i) => lerp(v, q[i], k));
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

// 关键帧：[[t, [v...], 缓动名?], ...]
export function kf(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1, e] = keys[i + 1];
    if (t < t1) return mix(v0, v1, E[e || "io"]((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
// 沿 x 行走：[[t, x, 缓动名?], ...] → 位置与累计路程
function walk(keys, t) {
  let dist = 0;
  if (t <= keys[0][0]) return { x: keys[0][1], dist: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0] = keys[i], [t1, x1, e] = keys[i + 1];
    if (t < t1) {
      const k = E[e || "io2"]((t - t0) / (t1 - t0));
      return { x: lerp(x0, x1, k), dist: dist + Math.abs(x1 - x0) * k };
    }
    dist += Math.abs(x1 - x0);
  }
  return { x: keys[keys.length - 1][1], dist };
}
// 步态：相位由路程决定（支撑脚不打滑），摆幅由速度决定
export function gait(keys, t, H, run = 0) {
  const a = walk(keys, t), b = walk(keys, t + 0.02), v = Math.abs(b.x - a.x) / 0.02;
  const S1 = (0.15 + 0.035 * run) * H;
  return { x: a.x, ph: (Math.PI * a.dist) / (2 * S1), amp: clamp(v / ((run ? 1.9 : 0.95) * H)), run, dir: Math.sign(b.x - a.x) };
}
export const blinkAt = (t, seed) => (((t + seed * 1.37) % 3.9) < 0.13 ? 1 : 0);

// ---- 视差镜头：cam = [cx, cy, z]，因子 f 的层：屏幕 = (世界 − o) × z_f + (960, 540) ----
export function view(c0, cam, f) {
  return { z: 1 + (cam[2] - 1) * f, ox: c0[0] + f * (cam[0] - c0[0]), oy: c0[1] + f * (cam[1] - c0[1]) };
}
export const toScreen = (v, p) => [(p[0] - v.ox) * v.z + 960, (p[1] - v.oy) * v.z + 540];
// 反求镜头：让 f 层上世界点 w（半径 r0）落在屏幕 P、半径 R
export function aim(c0, f, w, r0, P, R) {
  const zf = R / r0, z = 1 + (zf - 1) / f;
  const ox = w[0] - (P[0] - 960) / zf, oy = w[1] - (P[1] - 540) / zf;
  return [c0[0] + (ox - c0[0]) / f, c0[1] + (oy - c0[1]) / f, z];
}

// ---- 平面人物骨骼（侧面）：比例以身高 H 为单位 ----
export const BODY = {
  kid: { hip: 0.47, sh: 0.75, neck: 0.78, headC: 0.875, headR: 0.105, thigh: 0.26, shin: 0.245, up: 0.19, fore: 0.18 },
  adult: { hip: 0.5, sh: 0.8, neck: 0.83, headC: 0.915, headR: 0.072, thigh: 0.265, shin: 0.255, up: 0.2, fore: 0.195 },
};
function ik(s, t, l1, l2, pick) {
  const dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy) || 1e-6;
  const max = l1 + l2 - 1e-6, min = Math.abs(l1 - l2) + 1e-6, dd = clamp(d, min, max);
  const ux = dx / d, uy = dy / d, a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = s[0] + ux * a, my = s[1] + uy * a, e1 = [mx - uy * h, my + ux * h], e2 = [mx + uy * h, my - ux * h];
  return { e: pick(e1, e2) ? e1 : e2, end: [s[0] + ux * dd, s[1] + uy * dd], err: Math.max(0, d - max) };
}
// P: x, y（脚底）, H, kind, face, amp, ph, run, crouch, lean, jump, tilt, headFace,
//    手：hN / hF（世界坐标）或 hNrel / hFrel（相对肩，局部朝前为 +x），两者都给时按 kN / kF 混合（1 取世界坐标）；
//        都不给时用 aN/bN（肩角/肘角，0 为下垂）
//    脚：fN / fF（世界坐标）
export function solve(P) {
  const K = BODY[P.kind || "kid"], H = P.H, f = P.face ?? 1, amp = P.amp ?? 0, ph = P.ph ?? 0, cr = P.crouch ?? 0, run = P.run ?? 0;
  const L = (p) => [(p[0] - P.x) * f, p[1] - P.y + (P.jump ?? 0)];
  const W = (p) => [P.x + p[0] * f, P.y + p[1] - (P.jump ?? 0)];
  const hip = [-0.07 * H * cr, -K.hip * H * (1 - 0.42 * cr) - (Math.abs(Math.cos(ph)) - 0.5) * 0.025 * H * amp * (1 + run) + (P.dip ?? 0) * H];
  const Sx = (0.15 + 0.035 * run) * H * amp, Ly = (0.05 + 0.07 * run) * H * amp;
  const foot = (phi, rest) => (amp > 0 ? [Sx * Math.sin(phi) + rest * (1 - amp), -Ly * Math.max(0, Math.cos(phi))] : [rest, 0]);
  const fN = P.fN ? L(P.fN) : foot(ph, (cr ? 0.1 : 0.035) * H), fF = P.fF ? L(P.fF) : foot(ph + Math.PI, (cr ? -0.02 : -0.035) * H);
  const knee = (a, b) => a[0] > b[0];
  const legN = ik(hip, fN, K.thigh * H, K.shin * H, knee), legF = ik(hip, fF, K.thigh * H, K.shin * H, knee);
  const lean = (P.lean ?? 0) + 0.06 * amp * (1 + 1.5 * run) + 0.5 * cr;
  const up = (len) => [Math.sin(lean) * len, -Math.cos(lean) * len];
  const sh = add(hip, up((K.sh - K.hip) * H)), neck = add(hip, up((K.neck - K.hip) * H));
  const head = add(add(neck, up((K.headC - K.neck) * H)), [0.012 * H * Math.cos(lean), 0]);
  const elbow = (a, b) => a[1] - 0.6 * a[0] > b[1] - 0.6 * b[0];
  const arm = (w, rel, ang, bend, k) => {
    const rt = rel ? add(sh, [rel[0] * H, rel[1] * H]) : null;
    const tgt = w && rt && k !== undefined ? mix(rt, L(w), k) : w ? L(w) : rt;
    if (tgt) return ik(sh, tgt, K.up * H, K.fore * H, elbow);
    const e = add(sh, [Math.sin(ang) * K.up * H, Math.cos(ang) * K.up * H]);
    return { e, end: add(e, [Math.sin(ang + bend) * K.fore * H, Math.cos(ang + bend) * K.fore * H]), err: 0 };
  };
  const sw = 0.5 * amp * (1 + 0.8 * run) * Math.sin(ph);
  const armN = arm(P.hN, P.hNrel, P.aN ?? -sw, P.bN ?? 0.25 + 0.9 * run * amp, P.kN);
  const armF = arm(P.hF, P.hFrel, P.aF ?? sw, P.bF ?? 0.25 + 0.9 * run * amp, P.kF);
  const o = { f, H, K, kind: P.kind || "kid", lean, crouch: cr, tilt: P.tilt ?? 0, headFace: P.headFace ?? f, blink: P.blink ?? 0, smile: P.smile ?? 0, sway: P.sway ?? 0, err: [] };
  const J = { hip, sh, neck, head, kneeN: legN.e, footN: legN.end, kneeF: legF.e, footF: legF.end, elbN: armN.e, handN: armN.end, elbF: armF.e, handF: armF.end };
  for (const k in J) o[k] = W(J[k]);
  for (const [n, r] of [["legN", legN], ["legF", legF], ["armN", armN], ["armF", armF]]) if (r.err > 0.5) o.err.push(`${n} +${r.err.toFixed(1)}px`);
  return o;
}

// ---- 各场：c0 设计镜头；layers 视差因子；cam(t)；hero(t) 匹配剪辑主体（世界坐标、层、半径）；cast(t) 人物姿态；props(t) 道具 ----
export function makeScenes(D) {
  const B = D.beats, C = D.C, R = D.R, c0 = [960, 540];
  const SC = {};
  // 场内节拍名（pull0、run0 等）各场同名，按 sceneKeys 换成本场的值
  const BB = (name) => ({ ...D.beats, ...Object.fromEntries(Object.entries(D.sceneKeys[name] || {}).map(([k, v]) => [k, D.beats[v]])) });

  // 开场 / 结尾：手心的种子
  const SEED = [960, 598], SEED_R = 24, SUN0 = [1240, 300], SUN_R0 = 90;
  SC.palm = {
    c0, layers: { hand: 1 },
    seed(t) {
      const t0 = t >= B.palm2 ? B.palm2 : B.seed0, u = clamp((t - t0) / 0.45);
      let y = lerp(170, SEED[1], u * u);
      if (t > t0 + 0.45) y = SEED[1] - 18 * Math.sin(Math.PI * clamp((t - t0 - 0.45) / 0.28));
      return { w: [SEED[0], y], spin: (1 - u) * 2.2, morph: t >= B.palm2 ? 0 : seg(t, B.push0 + 0.6, B.push1) };
    },
    cam(t) {
      if (t >= B.palm2) return [960, 540, 1];
      const k = seg(t, B.push0, B.push1);
      return aim(c0, 1, SEED, SEED_R, mix(SEED, SUN0, k), SEED_R * (SUN_R0 / SEED_R) ** k);
    },
    hero(t) { return { layer: "hand", w: this.seed(t).w, r: SEED_R }; },
  };

  // 春·阳台（从屋里看向栏杆，右侧为隔墙，墙后是邻居）
  const SUN = [1240, 120];
  SC.spring = {
    c0, layers: { sky: 0.3, city: 0.55, bal: 1, near: 1.35 },
    hero() { return { layer: "sky", w: SUN, r: SUN_R0 }; },
    cam(t) {
      return kf([[0, [960, -60, 1]], [B.tilt0, [960, -60, 1]], [B.tilt1, [1060, 700, 1.25]], [B.tiltUp0, [1100, 715, 1.32], "sine"],
        [B.cut1 - 0.3, aim(c0, 0.3, SUN, SUN_R0, C, R)]], t);
    },
    POT: [1205, 875], CAN: [1152, 943],
    can(t) {  // 小水壶：提手位置、倾角
      const held = t >= B.canUp && t < B.canDown + 0.25;
      const pour = seg(t, B.pour0, B.pour0 + 0.3) * (1 - seg(t, B.pour1, B.pour1 + 0.2));
      return { held, tilt: 0.6 * pour, pour: t > B.pour0 + 0.25 && t < B.pour1 };
    },
    cast(t) {
      const H = 350, g = gait([[B.run0, 1100], [B.run0 + 0.6, 920, "in2"], [B.run1, -140, "lin"]], t, H, 1);
      const stand = seg(t, B.stand0, B.stand0 + 0.35);
      const G = { kind: "kid", H, x: g.x, y: 1000, face: t >= B.run0 ? -1 : 1, amp: g.amp, ph: g.ph, run: 1, crouch: 1 - stand, blink: blinkAt(t, 1) };
      const rim = [1170, 878], rimF = [1160, 886];
      if (t < B.stand0) {
        const poke = pulse(t, B.poke, 0.15, 0.1, 0.15), drop = seg(t, B.poke + 0.3, B.drop) * (1 - seg(t, B.drop + 0.25, B.pat1 - 0.2));
        const pat = (a) => pulse(t, a - 0.12, 0.12, 0.02, 0.1);
        const patK = seg(t, B.pat1 - 0.35, B.pat1 - 0.15) * (1 - seg(t, B.pat2 + 0.15, B.pat2 + 0.35)), py = 856 + 18 * Math.max(pat(B.pat1), pat(B.pat2));
        let hN = mix(rim, [1205, 890], poke);
        hN = mix(hN, [1205, 858], drop);
        hN = mix(hN, [1196, py], patK);
        let hF = mix(rimF, [1218, py], patK);
        // 取壶、浇水、放回
        const toCan = seg(t, B.canUp - 0.3, B.canUp), lift = seg(t, B.canUp, B.pour0), back = seg(t, B.pour1 + 0.15, B.canDown), off = seg(t, B.canDown, B.canDown + 0.3);
        const handle = [this.CAN[0], this.CAN[1] - 44], pourH = [1158, 838];
        hN = mix(hN, handle, toCan * (1 - off));
        hN = mix(hN, pourH, lift * (1 - back));
        G.hN = mix(hN, rim, off); G.hF = hF;
        G.tilt = 0.35 - 0.1 * lift * (1 - back);
      } else {
        const wave = seg(t, B.wave0, B.wave0 + 0.25) * (1 - seg(t, B.wave1, B.wave1 + 0.25)), w = Math.sin(2 * Math.PI * 2.6 * (t - B.wave0));
        const k = seg(t, B.stand0, B.stand0 + 0.35);
        if (t < B.run0) {
          G.hNrel = mix(mix([0.137, 0.157], [0.03, 0.32], k), [0.12 + 0.05 * w, -0.27], wave);
          G.hFrel = mix([0.11, 0.18], [0.0, 0.33], k);
          G.tilt = lerp(0.35, -0.28, seg(t, B.girlLook, B.girlLook + 0.3)) * (1 - seg(t, B.run0 - 0.3, B.run0));
          G.smile = seg(t, B.girlLook + 0.2, B.girlLook + 0.5);
        }
        G.sway = Math.sin(g.ph) * 0.25 * g.amp;
      }
      const N = { kind: "adult", H: 430, x: 1470, y: 1000, face: 1, blink: blinkAt(t, 2), lean: 0.08 + 0.01 * Math.sin(t * 1.9) };
      const look = seg(t, B.nbLook, B.nbLook + 0.2) * (1 - seg(t, B.nbBack, B.nbBack + 0.2));
      N.headFace = look > 0.5 ? -1 : 1;
      const nod = pulse(t, B.nod, 0.2, 0.15, 0.25);
      N.tilt = 0.12 + 0.2 * nod - 0.1 * look;
      N.smile = look;
      N.hN = [1590, 676 - 22 * nod]; N.hF = [1528, 690];
      return { girl: G, nb: N };
    },
    nbCan(t) {
      const look = seg(t, B.nbLook - 0.2, B.nbLook + 0.1) * (1 - seg(t, B.nbBack, B.nbBack + 0.3));
      return { tilt: 0.55 * (1 - look), pour: look < 0.5 };
    },
  };

  // 夏·海边：西瓜泡在水桶里 → 海边玩水 → 跑回来把西瓜举过头顶
  const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  { const B = BB("summer");
  const BUCKET = [1520, 846], MELON_UP = [1396, 790], MR = 40;  // 抱出水桶，退一步抱在胸前
  const burst = (r, t0, x0, y0, n, dir, spd) => [...Array(n)].map(() => ({ t0, x0, y0, vx: dir * spd * (0.3 + r()) + (r() - 0.5) * 120, vy: -spd * (0.6 + 0.6 * r()), s: 4 + 5 * r() }));
  SC.summer = {
    c0, layers: { sky: 0.2, sea: 0.5, beach: 1, near: 1.4 },
    melon(t) {
      if (t < B.lift0) return [BUCKET[0], BUCKET[1] + 3 * Math.sin(2 * Math.PI * 0.7 * (t - B.pull0)) * seg(t, B.pull0, B.pull0 + 0.8)];
      const k = seg(t, B.lift0, B.lift1, E.io2);
      return [lerp(BUCKET[0], MELON_UP[0], k), lerp(BUCKET[1], MELON_UP[1], k) - 40 * Math.sin(Math.PI * k)];
    },
    hero(t) { return { layer: "beach", w: this.melon(t), r: MR }; },
    cam(t) {
      const a = aim(c0, 1, BUCKET, MR, C, R), b = aim(c0, 1, MELON_UP, MR, C, R);
      return kf([[0, a], [B.pull0, a], [B.pull1, [1300, 560, 1]], [B.pan1, [620, 560, 1]], [B.run0 + 0.1, [620, 560, 1]],
        [B.run1 + 0.2, [1330, 560, 1]], [B.push0, [1360, 555, 1.03], "sine"], [B.cut2 - 0.3, b]], t);
    },
    cast(t) {
      const H = 300, xs = [[0, 470], [B.run0, 470], [B.run1, 1470, "io2"], [B.lift0 - 0.1, 1470], [B.lift1, 1372, "io2"]];
      const g = gait(xs, t, H, 1), dy = seg(t, B.run0, B.run1, E.io2);
      const G = { kind: "kid", H, x: g.x, y: lerp(810, 940, dy), face: 1, amp: g.amp, ph: g.ph, run: 1, blink: blinkAt(t, 3), sway: Math.sin(g.ph) * 0.3 * g.amp };
      const hop = clamp((t - B.hop) / 0.42);
      G.jump = 48 * Math.sin(Math.PI * hop);
      const cheer = pulse(t, B.hop - 0.15, 0.2, 0.35, 0.3) + pulse(t, B.kickG - 0.1, 0.15, 0.3, 0.3);
      if (cheer > 0 && t < B.run0) { G.hNrel = mix([0.03, 0.32], [0.1, -0.26], clamp(cheer)); G.hFrel = mix([0, 0.33], [-0.06, -0.27], clamp(cheer)); }
      const kick = pulse(t, B.kickG - 0.12, 0.12, 0.05, 0.2);
      if (kick > 0) G.fN = [G.x + 15 + 55 * kick, G.y - 35 * kick];
      G.smile = 1 - 0.6 * seg(t, B.run1, B.crouch);
      // 蹲下抱瓜、举起
      G.crouch = seg(t, B.crouch - 0.15, B.crouch + 0.25) * (1 - seg(t, B.lift0, B.lift1, E.io2));
      if (t >= B.crouch - 0.25) {
        const m = this.melon(t);
        const up = seg(t, B.lift0, B.lift1);  // 从桶里两侧捧起 → 抱在胸前，手托住下半边
        G.hN = [m[0] + lerp(37, 30, up), m[1] + lerp(4, 18, up)]; G.hF = [m[0] - lerp(37, 30, up), m[1] + lerp(6, 20, up)];
        G.hNrel = [0.03, 0.32]; G.hFrel = [0, 0.33]; G.kN = G.kF = seg(t, B.crouch, B.lift0 - 0.05);
        G.tilt = lerp(0.3, -0.12, seg(t, B.lift0, B.lift1));
        G.smile = seg(t, B.lift1 - 0.2, B.lift1 + 0.2);
      }
      const fH = 290, fxs = [[0, 610], [B.run0 + 0.45, 610], [B.run1 + 0.35, 1640, "io2"]];
      const fg = gait(fxs, t, fH, 1), fdy = seg(t, B.run0 + 0.45, B.run1 + 0.35, E.io2);
      const F = { kind: "kid", H: fH, x: fg.x, y: lerp(825, 962, fdy), face: t < B.point - 0.1 ? -1 : 1, amp: fg.amp, ph: fg.ph, run: 1, blink: blinkAt(t, 4), smile: 1 };
      const fk = pulse(t, B.kickF - 0.12, 0.12, 0.05, 0.2);
      if (fk > 0) F.fN = [F.x - 15 - 55 * fk, F.y - 35 * fk];
      const point = pulse(t, B.point, 0.2, 0.45, 0.25);
      if (point > 0) { F.hNrel = mix([0.03, 0.32], [0.28, -0.1], point); }
      const clap = seg(t, B.clap0, B.clap0 + 0.2) * (1 - seg(t, B.clap0 + 1.1, B.clap0 + 1.3));
      if (clap > 0) {
        const c = Math.abs(Math.sin(Math.PI * (t - B.clap0) / 0.3));
        F.hNrel = mix([0.03, 0.32], [0.19 + 0.05 * c, 0.1], clap); F.hFrel = mix([0, 0.33], [0.17 - 0.05 * c, 0.11], clap);
      }
      return { girl: G, friend: F };
    },
    // 溅起的水花、西瓜上滴下的水：固定种子
    drops: (() => {
      const r = rng(17), out = [];
      out.push(...burst(r, B.hop + 0.42, 470, 815, 10, 1, 260), ...burst(r, B.kickF, 560, 790, 14, -1, 380), ...burst(r, B.kickG, 530, 790, 14, 1, 380));
      return out;
    })(),
    drips(t) {
      const out = [], m = this.melon(t);
      if (t < B.lift0 + 0.3) return out;
      for (let k = 0; k < 9; k++) {
        const t0 = B.lift0 + 0.3 + 0.14 * k, u = t - t0;
        if (u > 0 && u < 0.6) out.push([m[0] + 22 * Math.sin(k * 2.3), m[1] + MR - 4 + 900 * u * u, 4.5]);
      }
      return out;
    },
  };
  }

  // 秋·街道：提灯笼走过中秋傍晚的街；镜头跟着灯笼，街景横移
  { const B = BB("autumn");
  const AH = 330, AY = 900, LR = 40, STICK = 0.6 * AH, STRING = 18;
  const ax = (() => {
    const x1 = 650 + 115, x2 = x1 + 230 * (B.stop0 - B.pull0 - 1.0);
    return [[0, 650], [B.pull0, 650], [B.pull0 + 1.0, x1, "in2"], [B.stop0, x2, "lin"], [B.stop1, x2 + 46, "out"]];
  })();
  SC.autumn = {
    c0, layers: { sky: 0.15, far: 0.4, mid: 1, near: 1.5 },
    girlP(t, still) {
      const g = gait(ax, t, AH, 0), raise = seg(t, B.raise0, B.raise1);
      return { kind: "kid", H: AH, x: g.x, y: AY, face: 1, amp: still ? 0 : g.amp, ph: still ? 0 : g.ph, blink: blinkAt(t, 5),
        hNrel: mix([0.16, 0.15], [0.2, -0.1], raise), tilt: lerp(0.05, -0.35, raise), smile: 0.6 + 0.4 * raise, sway: Math.sin(g.ph) * 0.2 * g.amp, raise };
    },
    lantern(t, still) {
      const P = this.girlP(t, still), J = solve(P), th = (lerp(50, 70, P.raise) * Math.PI) / 180;
      const tip = [J.handN[0] + STICK * Math.cos(th), J.handN[1] - STICK * Math.sin(th)];
      const u = t - B.raise0;
      const sw = still ? 0 : 0.16 * P.amp * Math.sin(P.ph + 0.8) + (u > 0 ? 0.12 * Math.sin(2 * Math.PI * 1.3 * u) * Math.exp(-u * 3) : 0);
      const Lr = STRING + LR;
      return { hand: J.handN, tip, w: [tip[0] + Lr * Math.sin(sw), tip[1] + Lr * Math.cos(sw)], sw };
    },
    hero(t) { return { layer: "mid", w: this.lantern(t).w, r: LR }; },
    cam(t) {
      const T1 = [900, 600], T2 = [860, 600];
      const track = (tt) => {
        const k = seg(tt, B.pull0, B.pull1), P = mix(mix(C, T1, k), T2, seg(tt, B.raise0, B.raise1));
        return aim(c0, 1, this.lantern(tt, true).w, LR, P, LR * 3 ** (1 - k));
      };
      if (t < B.push0) return track(t);
      return mix(track(B.push0), aim(c0, 1, this.lantern(B.cut3 - 0.3).w, LR, C, R), seg(t, B.push0, B.cut3 - 0.3));
    },
    cast(t) {
      const P = this.girlP(t);
      // 迎面走来的母女，小女孩提兔子灯
      const px = [[B.cut2 - 0.5, 2900], [B.cut3, 2900 - 175 * (B.cut3 - B.cut2 + 0.5), "lin"]];
      const mg = gait(px, t, 420), kg = gait(px, t, 270);
      const mom = { kind: "adult", H: 420, x: mg.x - 60, y: 880, face: -1, amp: mg.amp, ph: mg.ph, blink: blinkAt(t, 6), hFrel: [0.05, 0.36] };
      const kid = { kind: "kid", H: 270, x: kg.x + 20, y: 884, face: -1, amp: kg.amp, ph: kg.ph + 1, blink: blinkAt(t, 7), hNrel: [0.18, 0.1], smile: 1, sway: Math.sin(kg.ph) * 0.3 };
      return { girl: P, mom, kid };
    },
  };
  }

  // 冬·车站：雪球砸中搬箱子的爸爸 → 列车进站 → 一家人上车 → 车开走，女孩在车窗里
  { const B = BB("winter");
  const WY = 930, BALL_R = 16, CAR = 960, GAP = 26, MOON = [1350, -200], MOON_R = 100;
  const frontX = (t) => (t < B.depart ? lerp(2500, -200, seg(t, B.train0, B.trainStop, E.out)) : -200 - 3600 * seg(t, B.depart, B.departEnd, E.in));
  SC.winter = {
    c0, layers: { sky: 0.2, far: 0.45, plat: 1, near: 1.4 },
    frontX, CAR, GAP, MOON, MOON_R,
    winOff: 960 - frontX(B.winPass),
    girlP(t) {
      const H = 370, g = gait([[0, 980], [B.board0 + 0.25, 980], [B.board0 + 0.65, 1040, "in2"], [B.board1, 2150, "lin"]], t, H, 1);
      const P = { kind: "kid", H, x: g.x, y: WY, face: 1, amp: g.amp, ph: g.ph, run: 1, blink: blinkAt(t, 8), sway: Math.sin(g.ph) * 0.3 * g.amp };
      const wind = seg(t, B.wind, B.throw - 0.05), thr = seg(t, B.throw - 0.05, B.throw + 0.1, E.out), rec = seg(t, B.throw + 0.2, B.throw + 0.7);
      if (t < B.board0 + 0.25) P.hNrel = mix(mix(mix([0.15, 0.12], [-0.12, -0.24], wind), [0.26, -0.08], thr), [0.03, 0.32], rec);
      P.hFrel = t < B.board0 + 0.25 ? [0.02, 0.32] : undefined;
      P.lean = 0.12 * thr * (1 - rec) - 0.08 * wind * (1 - thr);
      const laugh = seg(t, B.hit + 0.2, B.hit + 0.5);
      P.smile = 0.5 + 0.5 * laugh;
      P.dip = laugh * (1 - seg(t, B.train0, B.train0 + 0.4)) * 0.006 * Math.sin(2 * Math.PI * 4 * t);
      P.tilt = -0.15 * seg(t, B.train0 + 0.6, B.train0 + 1.2) * (1 - seg(t, B.board0, B.board0 + 0.3));
      return P;
    },
    ball(t) {
      const J = solve(this.girlP(Math.min(t, B.throw))), rel = [J.handN[0] + 4, J.handN[1] - 20];
      if (t < B.throw) return { w: rel, on: true };
      const u = clamp((t - B.throw) / (B.hit - B.throw)), hit = this.hitPt;
      return { w: [lerp(rel[0], hit[0], u), lerp(rel[1], hit[1], u) - 90 * Math.sin(Math.PI * u)], on: u < 1 };
    },
    hitPt: [1300 - 0.05 * 470, WY - 0.62 * 470],
    hero(t) { return { layer: "plat", w: this.ball(Math.min(t, B.pull0)).w, r: BALL_R }; },
    cam(t) {
      const a = aim(c0, 1, this.ball(0).w, BALL_R, C, R);
      return kf([[0, a], [B.pull0, a], [B.pull1, [1080, 540, 1]], [B.board0, [1080, 540, 1]], [B.board1, [1160, 540, 1], "sine"],
        [B.tiltUp0, [1120, 540, 1], "sine"], [B.cut4 - 0.3, aim(c0, 0.2, MOON, MOON_R, C, R)]], t);
    },
    cast(t) {
      const G = this.girlP(t);
      const dg = gait([[0, 1300], [B.board0 + 0.1, 1300], [B.board0 + 0.5, 1340, "in2"], [B.board1 - 0.2, 2250, "lin"]], t, 470);
      const box = [dg.x + 0.17 * 470, WY - 0.56 * 470 + (dg.amp ? 4 * Math.abs(Math.cos(dg.ph)) : 0)];
      const flinch = pulse(t, B.hit, 0.08, 0.1, 0.3), turn = seg(t, B.turn, B.turn + 0.15) * (1 - seg(t, B.turn + 1.2, B.turn + 1.35));
      const dad = { kind: "adult", H: 470, x: dg.x, y: WY, face: 1, amp: dg.amp, ph: dg.ph, blink: blinkAt(t, 9), hN: [box[0] + 0.03 * 470, box[1] + 0.07 * 470], hF: [box[0] - 0.06 * 470, box[1] + 0.08 * 470],
        lean: 0.05 + 0.18 * flinch, headFace: turn > 0.5 ? -1 : 1, smile: seg(t, B.turn, B.turn + 0.3), dip: 0.006 * Math.sin(2 * Math.PI * 4.5 * t) * turn };
      const mx = [[0, 1520], [B.board0 - 0.1, 1520], [B.board0 + 0.3, 1560, "in2"], [B.board1 - 0.5, 2300, "lin"]], mg = gait(mx, t, 450);
      const mFace = t < B.board0 - 0.1 ? -1 : 1, suit = [mg.x + (mFace < 0 ? 45 : -40), WY];
      const mom = { kind: "adult", H: 450, x: mg.x, y: WY + 5, face: mFace, amp: mg.amp, ph: mg.ph, blink: blinkAt(t, 10), hN: [suit[0], WY + 5 - (mFace < 0 ? 0.45 : 0.47) * 450], smile: seg(t, B.hit + 0.1, B.hit + 0.4), hFrel: [0.02, 0.36] };
      return { girl: G, dad, mom, box, suit, suitTilt: mFace < 0 ? 0 : 0.35 * mg.amp };
    },
    puff(t) {
      const u = t - B.hit;
      if (u < 0 || u > 0.6) return [];
      const r = rng(5);
      return [...Array(14)].map(() => { const a = r() * 6.28, v = 90 + 160 * r(); return [this.hitPt[0] + Math.cos(a) * v * u, this.hitPt[1] + Math.sin(a) * v * u + 200 * u * u, (5 + 6 * r()) * (1 - u / 0.6)]; });
    },
  };
  }

  // 新家：看完照片，把手机放到窗台，从种子袋里倒出一颗种子
  SC.room = {
    c0, layers: { out: 0.4, room: 1 },
    cam(t) { return kf([[B.room, [1060, 610, 1.45]], [B.palm2, [1075, 615, 1.5], "sine"]], t); },
    PHONE_SILL: [1000, 790], PACKET: [1030, 788],
    phone(t) {
      const down = seg(t, B.rPhoneDown, B.rPhoneDown + 0.35);
      return { w: mix([1000, 700], this.PHONE_SILL, down), rot: lerp(-0.25, -1.45, down) };
    },
    packet(t) {
      const take = seg(t, B.rTake, B.rTake + 0.35), bring = seg(t, B.rTake + 0.35, B.rTake + 0.7), tip = seg(t, B.rTake + 0.7, B.rTake + 1.0);
      return { w: mix(this.PACKET, [985, 712], bring), rot: lerp(0, 0.9, tip), held: take >= 1, tip };
    },
    cast(t) {
      const H = 640, ph = this.phone(t), pk = this.packet(t);
      const G = { kind: "kid", H, x: 870, y: 1160, face: 1, blink: blinkAt(t, 11), lean: 0.04 + 0.01 * Math.sin(t * 2), sway: 0 };
      const onPhone = t < B.rPhoneDown + 0.35, reach = seg(t, B.rTake - 0.05, B.rTake + 0.3);
      G.hN = onPhone ? [ph.w[0] + 14, ph.w[1] + 18] : pk.held ? [pk.w[0] + 6, pk.w[1] + 12] : mix([ph.w[0] + 14, ph.w[1] + 4], this.PACKET, reach);
      G.hF = onPhone ? [ph.w[0] - 18, ph.w[1] + 22] : undefined;
      G.hFrel = onPhone ? undefined : mix([0.08, 0.3], [0.19, 0.14], seg(t, B.rTake, B.rTake + 0.5));
      G.tilt = lerp(0.42, -0.08, seg(t, B.rLook, B.rLook + 0.4)) + 0.3 * seg(t, B.rTake + 0.5, B.rTake + 0.8);
      G.smile = seg(t, B.rSmile, B.rSmile + 0.4);
      return { girl: G };
    },
  };
  return SC;
}

// 各场显隐：入场按时刻淡入（硬切时 a = b），出场硬切
export function sceneAlpha(B) {
  const w = (t, a, b, end) => (t < a || t >= end ? 0 : b > a ? seg(t, a, b, E.lin) : 1);
  return (t) => ({
    palm: t < B.push1 + 0.6 ? 1 : t >= B.palm2 ? 1 : 0,
    spring: w(t, B.push1, B.push1 + 0.6, B.cut1 + 0.3),
    summer: w(t, B.cut1 - 0.3, B.cut1 + 0.3, B.cut2 + 0.3),
    autumn: w(t, B.cut2 - 0.3, B.cut2 + 0.3, B.cut3 + 0.3),
    winter: w(t, B.cut3 - 0.3, B.cut3 + 0.3, B.cut4 + 0.3),
    gl: w(t, B.cut4 - 0.3, B.cut4 + 0.3, B.room),
    phone: w(t, B.phone0, B.phone0 + 0.8, B.room),
    room: w(t, B.room, B.room, B.palm2),
  });
}

// ---- 3D 匹配剪辑：镜头在 P0 朝 dir（世界上方 +y），求太阳圆盘的位置与半径，使其投影落在屏幕 C、半径 R ----
const v3 = { sub: (a, b) => a.map((v, i) => v - b[i]), dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); } };
export function camBasis(dir) {
  const f = v3.norm(dir), r = v3.norm(v3.cross(f, [0, 1, 0])), u = v3.cross(r, f);
  return { f, r, u };
}
export function sunPlace(P0, dir, C, R, fovDeg, depth) {
  const { f, r, u } = camBasis(dir), fpx = 540 / Math.tan((fovDeg * Math.PI) / 360);
  const dx = (C[0] - 960) / fpx, dy = (540 - C[1]) / fpx;
  return { pos: [0, 1, 2].map((i) => P0[i] + depth * (f[i] + r[i] * dx + u[i] * dy)), radius: (R * depth) / fpx };
}
// 针孔投影（与 three.js PerspectiveCamera.lookAt 同一约定）：返回屏幕 [x, y] 与深度
export function project(P0, dir, fovDeg, p) {
  const { f, r, u } = camBasis(dir), fpx = 540 / Math.tan((fovDeg * Math.PI) / 360), q = v3.sub(p, P0), z = v3.dot(q, f);
  return [960 + (fpx * v3.dot(q, r)) / z, 540 - (fpx * v3.dot(q, u)) / z, z];
}
