// N5 世界：边界 h(x,t)、镜头、两个角色的关节、铲子、种子、树与果子。纯函数，无 DOM、无 import，浏览器与 node 共用
export const clamp01 = (u) => Math.min(1, Math.max(0, u));
export const lerp = (a, b, u) => a + (b - a) * u;
export const E = { lin: (u) => u, io2: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2), o3: (u) => 1 - (1 - u) ** 3,
  i2: (u) => u * u, sine: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u) };
export const seg = (t, a, b, e = E.io2) => e(clamp01((t - a) / (b - a)));
const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const norm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const rot = (v, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
const mix = (p, q, u) => [lerp(p[0], q[0], u), lerp(p[1], q[1], u)];
const dirOf = (deg) => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];

// 身体比例（身高 = 1）
export const BODY = { thigh: 0.2, shin: 0.19, torso: 0.26, upper: 0.15, fore: 0.14, neck: 0.15, headR: 0.16, hipH: 0.36,
  legW: 0.085, armW: 0.065, torsoW: 0.2 };

function ik(a, t, l1, l2, bend) {
  const v = sub(t, a), d = Math.min(Math.max(len(v), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const ang = Math.atan2(v[1], v[0]), k = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  return add(a, [Math.cos(ang + bend * k), Math.sin(ang + bend * k)], l1);
}
const lerpPose = (p, q, u) => {
  if (u <= 0) return p;
  const o = { ...p };
  for (const k of Object.keys(q)) o[k] = Array.isArray(p[k]) ? (Array.isArray(p[k][0]) ? p[k].map((v, i) => mix(v, q[k][i], u)) : mix(p[k], q[k], u)) : lerp(p[k], q[k], u);
  return o;
};
// 敲、拍：抬手 → 落下（t = tk 时着地）→ 小弹起
const tapLift = (ts, t) => {
  let l = 0;
  for (const tk of ts) {
    if (t >= tk - 0.16 && t < tk) l = Math.max(l, Math.sin((Math.PI * (tk - t)) / 0.16));
    else if (t >= tk && t < tk + 0.1) l = Math.max(l, 0.25 * Math.sin((Math.PI * (t - tk)) / 0.1));
  }
  return l;
};

export function makeWorld(D) {
  const B = D.beats, L = D.lay, PH = D.ph, DIG = D.dig, T = D.tree;
  const g2 = (x, c, s) => Math.exp(-((x - c) ** 2) / (2 * s * s));
  function pitA(t) {
    let a = 0;
    for (const [t0, t1, A] of D.pit) { const u = seg(t, t0, t1, E.o3); a = lerp(a, A, u); if (u < 1) break; }
    return a;
  }
  function dimple(x, t) {
    let s = 0;
    for (const [ti, xi, amp] of D.dimples) {
      const tau = t - ti;
      if (tau >= 0 && tau < 0.9) s += amp * g2(x, xi, 0.1) * Math.exp(-tau / 0.14) * Math.min(1, tau / 0.03);
    }
    return s;
  }
  const h = (x, t) => pitA(t) * g2(x, L.pit.x, L.pit.sig) - L.mound.d * g2(x, L.mound.x, L.mound.sig) + dimple(x, t);

  function cam(t) {
    const s = JSON.parse(JSON.stringify(D.master));
    for (const [t0, t1, tgt] of D.cam) {
      if (t <= t0) break;
      const u = seg(t, t0, t1);
      for (const [k, v] of Object.entries(tgt)) // 缩放按对数插值，推拉的观感匀速
        s[k] = Array.isArray(v) ? v.map((x, i) => lerp(s[k][i], x, u)) : k === "s" ? s[k] * (v / s[k]) ** u : lerp(s[k], v, u);
    }
    return s;
  }
  // 鲁宾杯：杯身半宽 w(y)，三次 Hermite 插值（有限差分切线）；杯口 |x| < V[0][1] 处由 h(x) 给出
  const V = D.vase;
  function vaseW(y) {
    if (y >= V[0][0]) return V[0][1];
    let i = 0; while (i < V.length - 2 && y < V[i + 1][0]) i++;
    const [y0, w0] = V[i], [y1, w1] = V[i + 1], m = (k) => { const a = V[Math.max(0, k - 1)], b = V[Math.min(V.length - 1, k + 1)]; return (b[1] - a[1]) / (b[0] - a[0]); };
    const dy = y1 - y0, u = clamp01((y - y0) / dy), u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * w0 + (u3 - 2 * u2 + u) * dy * m(i) + (-2 * u3 + 3 * u2) * w1 + (u3 - u2) * dy * m(i + 1);
  }
  // 墨色区域的轮廓（逆时针）：杯口沿 h(x)，两侧沿杯身向下
  function inkOutline(t, step, yMin) {
    const R = V[0][1], pts = [], n = Math.ceil((2 * R) / step);
    for (let i = 0; i <= n; i++) { const x = -R + (2 * R * i) / n; pts.push([x, h(x, t)]); }
    const ys = []; for (let y = V[0][0]; y > yMin; y -= step) ys.push(y); ys.push(yMin);
    for (const y of ys) pts.push([vaseW(y), y]);
    for (const y of ys.reverse()) pts.push([-vaseW(y), y]);
    return pts;
  }
  const actW = (who, name, t) => {
    let w = 0;
    for (const [w0, n, t0, t1, fi, fo] of D.acts) if (w0 === who && n === name && t >= t0 && t <= t1)
      w = Math.max(w, Math.min(seg(t, t0, t0 + fi), 1 - seg(t, t1 - fo, t1)));
    return w;
  };
  const actOf = (who, name, t) => D.acts.find(([w0, n, t0, t1]) => w0 === who && n === name && t >= t0 && t <= t1);
  function face(who, t) {
    let f = D.face[who][0];
    for (const [t0, t1, ft] of D.face[who][1]) { if (t <= t0) break; f = lerp(f, ft, seg(t, t0, t1)); }
    return f;
  }
  function at(who, t) {
    const tr = D.track[who];
    for (let i = 1; i < tr.length; i++) {
      const [t0, x0] = tr[i - 1], [t1, x1] = tr[i];
      if (t >= t1) continue;
      const u = clamp01((t - t0) / (t1 - t0)), walk = Math.abs(x1 - x0) > 1e-9 && !D.slide[who].some((s) => Math.abs(s - t0) < 1e-6);
      return { x: lerp(x0, x1, u), walk, d: Math.abs(x1 - x0) * u, xs: x0, dir: Math.sign(x1 - x0), t0, t1 };
    }
    const l = tr[tr.length - 1][1];
    return { x: l, walk: false, d: 0, xs: l, dir: 0, t0: 0, t1: 1 };
  }
  // 局部框架：f 朝向（转身时在 ±1 间连续变化），g 重力方向；depth 为陷在地下的深度
  const frame = (rx, f, g, t, depth = 0) => {
    const ry = h(rx, t), fs = f >= 0 ? 1 : -1;
    return { rx, ry, f, fs, g, gl: (lx) => g * (h(rx + fs * lx, t) - ry), toW: (q) => [rx + f * q[0], ry + g * (q[1] - depth)],
      toL: (x, y) => [fs * (x - rx), g * (y - ry)], dirW: (v) => [f * v[0], g * v[1]] };
  };

  // 关节：pose 在局部坐标（前 = +x，上 = +y，原点为根部所在地面）
  function solve(pose, F) {
    const K = BODY, sh = add(pose.hip, dirOf(pose.beta), K.torso), head = add(sh, dirOf(pose.gamma), K.neck);
    const knees = pose.foot.map((ft) => ik(pose.hip, ft, K.thigh, K.shin, 1));
    const elbows = pose.hand.map((hd) => ik(sh, hd, K.upper, K.fore, -1));
    const hands = pose.hand.map((hd, i) => { const v = sub(hd, elbows[i]), l = len(v); return l > K.fore ? add(elbows[i], v, K.fore / l) : hd; });
    const W = F.toW;
    return { hip: W(pose.hip), sh: W(sh), head: W(head), headLocal: head, knees: knees.map(W), feet: pose.foot.map(W),
      elbows: elbows.map(W), hands: hands.map(W), targets: pose.hand.map(W), eyeDir: pose.gamma, blink: pose.blink || 0 };
  }

  // 纸的铲子：每铲 = 铲入 → 撬起（墨那边的山一跳）→ 抬起 → 甩土过肩；drop 后松手，铲子绕铲尖倒在身后
  const DK = [[0, "rdy"], [PH.plunge, "P"], [PH.pry0 + 0.04, "P"], [PH.lift, "lift"], [PH.toss, "toss"], [1, "rdy"]];
  const DV = { rdy: { tip: [0.38, 0.12], a: -10, beta: 12, drop: 0 }, P: { a: -6, beta: 62, drop: 0.09 },
    lift: { tip: [0.35, 0.3], a: 0, beta: 30, drop: 0.04 }, toss: { tip: [-0.38, 0.92], a: 0, beta: -8, drop: 0 } };
  function shovelPose(t, F, base) {
    const K = BODY, Ls = L.shovel, gl = F.gl;
    const P = [F.fs * (L.digX - F.rx), F.g * (h(L.digX, t) - F.ry) - 0.04];
    let phi = 0, wd = 0, live = false;
    for (const [t0] of D.digs) {
      if (t >= t0 && t < t0 + DIG) { phi = (t - t0) / DIG; live = true; }
      if (t >= t0 - 0.2 && t <= t0 + DIG + 0.2) wd = Math.max(wd, Math.min(seg(t, t0 - 0.2, t0), 1 - seg(t, t0 + DIG, t0 + DIG + 0.2)));
    }
    let i = 1; while (i < DK.length - 1 && phi >= DK[i][0]) i++;
    const ka = DV[DK[i - 1][1]], kb = DV[DK[i][1]], u = E.sine(clamp01((phi - DK[i - 1][0]) / (DK[i][0] - DK[i - 1][0])));
    const tip = mix(DK[i - 1][1] === "P" ? P : ka.tip, DK[i][1] === "P" ? P : kb.tip, u);
    const beta = lerp(ka.beta, kb.beta, u), hip = [0, base.hip[1] - lerp(ka.drop, kb.drop, u)], sh = add(hip, dirOf(beta), K.torso);
    const dir = rot(norm(sub(sh, tip)), lerp(ka.a, kb.a, u)), dsh = len(sub(sh, tip));
    const dN = Math.min(Math.max(dsh - 0.22, 0.3), Ls - 0.05), dF = Math.min(dN + 0.2, Ls);
    const dig = { hip, beta, gamma: beta * 0.6 + 5, hand: [add(tip, dir, dN), add(tip, dir, dF)], tip, dir };
    const iTip = [0.2, gl(0.2) - 0.03], iDir = norm([0.06, 1]), iSh = add(base.hip, dirOf(4), K.torso);
    const idle = { hip: base.hip, beta: 4, gamma: 4, hand: [add(iTip, iDir, 0.6), add(iSh, [0.03, -0.27])], tip: iTip, dir: iDir };
    const sp = lerpPose(idle, dig, wd);
    return { sp: { ...sp, dir: norm(sp.dir) }, sway: live ? 0.5 * Math.sin(2 * Math.PI * phi) : 0 };
  }

  function actor(who, t) {
    const K = BODY, g = D.g[who], f = face(who, t), p = at(who, t), S = D.stride;
    const depth = who === "mo" ? D.emerge[2] * (1 - seg(t, D.emerge[0], D.emerge[1], E.o3)) : 0;
    const F = frame(p.x, f, g, t, depth), gl = F.gl, fs = F.fs;
    const tw = p.walk ? Math.min(seg(t, p.t0, p.t0 + 0.15), 1 - seg(t, p.t1 - 0.15, p.t1)) : 0;
    const gait = [0, 1].map((i) => {
      const u = p.d / S + i * 0.5, k = Math.floor(u), c = u - k, plant = (kk) => p.xs + p.dir * (kk + 0.25 - 0.5 * i) * S;
      if (c < 0.5) return [fs * (plant(k) - p.x), 0];
      const q = E.sine((c - 0.5) / 0.5);
      return [fs * (lerp(plant(k), plant(k + 1), q) - p.x), 0.08 * Math.sin(Math.PI * q)];
    });
    const fx = [0.05, -0.05].map((s, i) => lerp(s, gait[i][0], tw)), lift = [gait[0][1] * tw, gait[1][1] * tw];
    let dip = (0.012 * tw * (1 + Math.cos((4 * Math.PI * p.d) / S))) / 2;
    for (const ts of D.stomps[who]) { // 前脚抬起、猛踩，落地后身子一沉
      const u = (t - (ts - 0.32)) / 0.32;
      if (u >= 0 && u < 1) lift[0] += 0.17 * (u < 0.7 ? Math.sin(((u / 0.7) * Math.PI) / 2) : Math.cos((((u - 0.7) / 0.3) * Math.PI) / 2));
      if (t >= ts && t < ts + 0.14) dip += 0.03 * Math.sin((Math.PI * (t - ts)) / 0.14);
    }
    const foot = fx.map((x, i) => [x, gl(x) + lift[i]]);
    const hip = [0, K.hipH + (gl(fx[0]) + gl(fx[1])) / 2 - dip], beta = 4 + 4 * tw;
    const sh = add(hip, dirOf(beta), K.torso), sw = tw * Math.sin((2 * Math.PI * p.d) / S), raise = lift[0] > 0.02 && tw < 0.5 ? 0.06 : 0;
    let pose = { hip, beta, gamma: 4, foot, hand: [add(sh, [0.03 + 0.07 * sw, -0.27 + raise]), add(sh, [0.03 - 0.07 * sw, -0.27 + raise])] };
    let shovel = null, sway = 0;
    if (who === "zhi") {
      const z = shovelPose(t, F, pose), hold = 1 - seg(t, B.drop, B.drop + 0.3);
      sway = z.sway;
      pose = lerpPose(pose, { hip: z.sp.hip, beta: z.sp.beta, gamma: z.sp.gamma, hand: z.sp.hand }, hold);
      if (t < B.drop) shovel = { tip: F.toW(z.sp.tip), dir: F.dirW(z.sp.dir) };
      else { // 松手时的姿态冻结在 drop 时刻的框架里，之后铲子不随人动
        const F0 = frame(at(who, B.drop).x, face(who, B.drop), g, B.drop), z0 = shovelPose(B.drop, F0, { hip: [0, K.hipH] });
        const tip = F0.toW(z0.sp.tip), d0 = F0.dirW(z0.sp.dir), a0 = Math.atan2(d0[1], d0[0]);
        let xe = tip[0]; while (Math.hypot(xe - tip[0], h(xe, B.drop) - tip[1]) < L.shovel) xe += 0.01; // 倒下后铲柄另一端落在身后的地面上
        const a1 = Math.atan2(h(xe, B.drop) - tip[1], xe - tip[0]);
        const u = seg(t, B.drop, B.drop + 0.45, E.i2), a = lerp(a0, a1, u) + 0.06 * Math.sin(Math.PI * seg(t, B.drop + 0.45, B.drop + 0.65, E.lin));
        shovel = { tip, dir: [Math.cos(a), Math.sin(a)] };
      }
    }

    // ---- 动作层：按固定顺序叠加 ----
    const w = (n) => actW(who, n, t);
    if (w("stretch") > 0) {
      const s2 = add(pose.hip, dirOf(-6), K.torso);
      pose = lerpPose(pose, { beta: -6, gamma: -16, hand: [add(s2, [0.07, 0.27]), add(s2, [-0.03, 0.27])] }, w("stretch"));
    }
    if (w("sit") > 0) pose = lerpPose(pose, { hip: [-0.12, gl(-0.12) + 0.11], beta: -22, gamma: -8, foot: [[0.3, gl(0.3)], [0.24, gl(0.24)]],
      hand: [[-0.28, gl(-0.28) + 0.06], [-0.24, gl(-0.24) + 0.06]] }, w("sit"));
    const fl = actOf(who, "flinch", t);
    if (fl) { // 被脚下一跳吓到：跳一下、身子后仰
      const u = clamp01((t - fl[2]) / (fl[3] - fl[2])), hop = 0.07 * Math.sin(Math.PI * u);
      pose = { ...pose, hip: add(pose.hip, [0, hop]), beta: pose.beta - 14 * Math.sin(Math.PI * u), foot: pose.foot.map((q) => add(q, [-0.04 * u, hop * 0.6])),
        hand: pose.hand.map((q) => add(q, [0.02, hop + 0.1 * Math.sin(Math.PI * u)])) };
    }
    if (w("kneelEar") > 0) { // 头侧贴地：β 取头刚好碰到地面（山坡）的角度
      const kh = [-0.1, gl(-0.1) + 0.22], headAt = (bb) => add(add(kh, dirOf(bb), K.torso), dirOf(bb + 10), K.neck);
      let lo = 40, hi = 115;
      for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2, hd = headAt(m); if (hd[1] - (gl(hd[0]) + K.headR * 0.95) > 0) lo = m; else hi = m; }
      pose = lerpPose(pose, { hip: kh, beta: hi, gamma: hi + 10, foot: [[-0.38, gl(-0.38) + 0.03], [-0.33, gl(-0.33) + 0.03]],
        hand: [[0.13, gl(0.13)], [0.2, gl(0.2)]] }, w("kneelEar"));
    }
    if (w("kneelK") > 0) { // 跪坐；敲击时前倾，手抬起落下
      let kw = 0;
      for (const tk of D.knocks[who]) kw = Math.max(kw, Math.min(seg(t, tk - 0.45, tk - 0.25), 1 - seg(t, tk + 0.2, tk + 0.4)));
      const kl = tapLift(D.knocks[who], t);
      const wr = actW(who, "reach", t), lean = Math.max(kw, wr);
      const hy = Math.min(gl(-0.05), gl(0.25)) + 0.2 - 0.04 * lean, fy = (x) => Math.min(gl(x) + 0.03, hy - 0.08); // 坡上跪：臀随低处，脚背贴坡
      const kp = { hip: [-0.05, hy], beta: lerp(20, 60, lean), gamma: lerp(18, 45, lean), foot: [[-0.36, fy(-0.36)], [-0.3, fy(-0.3)]],
        hand: [mix([0.13, hy - 0.03], [0.2, gl(0.2) + 0.13 * kl], kw), [0.07, hy - 0.01]] };
      pose = lerpPose(pose, kp, w("kneelK"));
    }
    if (w("crouch") > 0) pose = lerpPose(pose, { hip: [0, gl(0) + 0.2], beta: 60, gamma: 50 }, w("crouch"));
    const ra = actOf(who, "reach", t);
    if (ra) {
      const P = ra[6], lx = fs * (P.x - p.x), tgt = [lx, gl(lx) + P.dy + 0.1 * tapLift(D.pats[who], t)], wr = w("reach");
      pose.hand = pose.hand.map((q, i) => (i === P.h ? mix(q, tgt, wr) : q));
      pose.beta = lerp(pose.beta, Math.max(pose.beta, 60), wr); pose.gamma = lerp(pose.gamma, Math.max(pose.gamma, 50), wr);
    }
    if (w("wipe") > 0) {
      const a = actOf(who, "wipe", t), uw = clamp01((t - a[2]) / (a[3] - a[2]));
      const hd = add(add(pose.hip, dirOf(pose.beta), K.torso), dirOf(-6), K.neck);
      pose.gamma = lerp(pose.gamma, -6, w("wipe"));
      pose.hand[1] = mix(pose.hand[1], add(hd, [0.13 - 0.24 * E.sine(clamp01((uw - 0.25) / 0.5)), 0.04]), w("wipe"));
    }
    pose.gamma += 25 * w("lookDown") - 30 * w("lookUp");
    pose.blink = D.blinks[who].some((tb) => (t >= tb && t < tb + 0.08) || (t >= tb + 0.16 && t < tb + 0.24)) ? 1 : 0;
    return { J: solve(pose, F), F, shovel, sway, f };
  }

  // 土块：撬起后随铲面抬起，甩土时抛出，落回纸身后的地里
  function clods(t) {
    const out = [];
    for (const [t0] of D.digs) {
      const tq = t0 + PH.pry1 * DIG, ts = t0 + PH.toss * DIG;
      if (t < tq || t >= ts + 1.0) continue;
      const on = (z) => { const up = [-z.shovel.dir[1], z.shovel.dir[0]], n = up[1] > 0 ? [-up[0], -up[1]] : up; return add(add(z.shovel.tip, z.shovel.dir, 0.1), n, 0.05); };
      if (t < ts) { out.push(on(actor("zhi", t))); continue; }
      const p0 = on(actor("zhi", ts)), tt = t - ts;
      out.push([p0[0] + 1.6 * tt, p0[1] - 2.2 * tt + 3.5 * tt * tt]);
    }
    return out;
  }

  // 种子：土丘上 → 纸手里 → 按进线里、穿到墨那边 → 墨手里 → 种下 → 长进树里
  function seed(t) {
    const R = L.seedR; let st = D.seed[0][1];
    for (const [ts, s] of D.seed) if (t >= ts) st = s;
    if (st === "ground") return { p: [L.seed0, h(L.seed0, t) - R], r: R };
    if (st === "zhi") return { p: actor("zhi", t).J.hands[0], r: R };
    if (st === "push") {
      const [a, b1, c] = D.seedPush, m = [L.M, h(L.M, t)];
      if (t < b1) return { p: mix(actor("zhi", a).J.hands[0], [m[0], m[1] - R], seg(t, a, b1)), r: R };
      return { p: [m[0], m[1] + lerp(-R, R + 0.01, seg(t, b1, c))], r: R };
    }
    if (st === "mo") return { p: actor("mo", t).J.hands[0], r: R };
    return { p: [L.treeX, h(L.treeX, t)], r: R * (1 - seg(t, B.grow0, B.grow0 + 0.6)) };
  }

  // 果子：挂在墨的树右主枝末端；落下后在线两侧都被拉回线上，每次穿线振幅乘 r，最后停在线上
  function fruit(t) {
    const R = L.fruitR, Fd = D.fruit, tip = [L.treeX + T.tip[0], h(L.treeX, t) + T.tip[1]];
    if (t < B.fruit0) return null;
    if (t < B.fall) {
      const r = R * seg(t, B.fruit0, B.fruit1, E.o3), sw = 0.012 * Math.sin(2.3 * t) * (1 - seg(t, B.fall - 0.6, B.fall));
      return { p: [tip[0] + sw, tip[1] - T.stem - r], r, stem: tip };
    }
    let y = 0;
    const tau = t - B.fall;
    if (t < Fd.cross[0]) y = Fd.y0 - 0.5 * Fd.a * tau * tau;
    else {
      let amp = Fd.y0 * Fd.r, side = -1;
      for (let k = 0; k < Fd.cross.length - 1; k++) {
        if (t >= Fd.cross[k] && t < Fd.cross[k + 1]) { const v = Math.sqrt(2 * Fd.a * amp), u = t - Fd.cross[k]; y = side * (v * u - 0.5 * Fd.a * u * u); break; }
        amp *= Fd.r; side = -side;
      }
    }
    return { p: [L.M, h(L.M, t) + y], r: R };
  }
  const grow = (t) => seg(t, B.grow0, B.grow1, E.sine);

  // 镜头的屏幕变换（与 n5.js 的 setTransform 同式）及其逆变换
  function camMat(c) {
    const a = (c.rot * Math.PI) / 180, s = c.s, A = s * Math.cos(a), Bb = s * Math.sin(a), C = s * Math.sin(a), Dd = -s * Math.cos(a);
    return { A, B: Bb, C, D: Dd, e: 960 - (A * c.c[0] + C * c.c[1]), f: 540 - (Bb * c.c[0] + Dd * c.c[1]) };
  }
  const toScr = (m, p) => [m.A * p[0] + m.C * p[1] + m.e, m.B * p[0] + m.D * p[1] + m.f];
  const fromScr = (m, x, y) => { const det = m.A * m.D - m.B * m.C, u = x - m.e, v = y - m.f; return [(m.D * u - m.C * v) / det, (-m.B * u + m.A * v) / det]; };
  // 镜头运动时画面内容的最大每帧位移（px）：用于决定运动模糊的子帧数
  function camSpeed(t) {
    const m0 = camMat(cam(t)), m1 = camMat(cam(t + 1 / 60));
    let mx = 0;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {
      const q = toScr(m1, fromScr(m0, 480 * i, 540 * j)); mx = Math.max(mx, Math.hypot(q[0] - 480 * i, q[1] - 540 * j));
    }
    return mx;
  }

  return { h, pitA, cam, camMat, toScr, fromScr, camSpeed, vaseW, inkOutline, at, face, actor, clods, seed, fruit, grow, tree: T };
}
