import * as THREE from "three";
import { build, mulberry32, M, mesh } from "./world.js";
import { buildings, fields, plants, streetProps } from "./props.js";
import { bike, bird, deer, dog, duck, flap, person, pose } from "./assets/shared/js/creatures.js";

// N2 三维世界的逐帧驱动：画面只取决于时刻 t
const D = window.N2, B = D.beats, WW = 1920, HH = 1080;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WW, HH, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const W = build(D), scene = W.scene, rnd = mulberry32(11);
buildings(W, D); streetProps(W, D); plants(W, D, rnd); fields(W, D, rnd);
const cam = new THREE.PerspectiveCamera(38, WW / HH, 0.1, 300);
scene.fog = new THREE.Fog(0xbfe3f5, 45, 120);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7f74, 1.1);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(14, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
sun.shadow.bias = -0.0008;
scene.add(hemi, sun);

// 角色
const girl = person(scene, { coat: 0xf2a65a, pants: 0x5f86b8, hair: 0x4a2f22, skirt: true, scale: 0.78, scarf: 0xd8443a });
const postman = person(scene, { coat: 0x3e6fa3, pants: 0x2f3b4d, hat: 0x2f4f7a, bag: 0x9a6b45 });
const baker = person(scene, { coat: 0xffffff, pants: 0x8a7f74, hat: 0xffffff, scale: 1.05 });
const fisher = person(scene, { coat: 0x7a8c5a, pants: 0x5a4a3a, hair: 0xd8d8d8, hat: 0xb08a5a, scale: 0.95 });
const bk = bike(scene), pup = dog(scene);
const rod = mesh(new THREE.CylinderGeometry(0.015, 0.02, 2.2, 4), M(0x6e4a30), fisher.armR, [0, -0.62, 0.9], false);
rod.rotation.x = 1.15;
const env = (parent) => mesh(new THREE.BoxGeometry(0.22, 0.02, 0.15), M(0xfaf3e3), parent, [0, -0.62, 0.06], false);
const envPost = env(postman.armR), envGirl = env(girl.armR);
const splash = mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), scene, [0, 0.05, 0], false);
splash.rotation.x = Math.PI / 2;

// 人群：夏天集市 16 人，春天街上 5 人；绕广场椭圆行走
const COATS = [0xe86f5a, 0x6aa9d8, 0xf2c14e, 0x8cc084, 0xb07cc6, 0xf3e6d0, 0x5a7d9a, 0xd98b6a];
const crowd = [];
for (let k = 0; k < D.market.n + D.market.idle.length; k++) {
  const p = person(scene, { coat: COATS[k % 8], pants: [0x3d4a5c, 0x6b5a4a, 0x2f3b4d][k % 3], hair: [0x3b2a20, 0x7a5a3a, 0x1f1f1f, 0xc9a06a][k % 4], scale: 0.85 + 0.25 * rnd(), skirt: k % 3 === 0, hat: k % 5 === 0 ? 0xe2cfa6 : undefined });
  crowd.push({ p, idle: k >= D.market.n ? D.market.idle[k - D.market.n] : null, s0: (k * D.market.P) / D.market.n });
}
const ducks = [...Array(6)].map((_, k) => ({ m: duck(scene, k % 3 === 0), ph: rnd() * 6.28, off: k * 1.1 }));
const pigeons = [...Array(14)].map(() => ({ b: bird(scene, 0xd8dde3, 0.9), a: rnd() * 6.28, r: 0.5 + rnd(), up: 0.7 + 0.6 * rnd(), ph: rnd() * 6.28 }));
const geese = [...Array(9)].map(() => bird(scene, 0x6b625a, 1.5));
const deers = [deer(scene), deer(scene)];
deers[1].root.scale.setScalar(0.8);

// 落英 / 落叶 / 雪：位置是 t 的函数
const petalGeo = new THREE.PlaneGeometry(0.12, 0.08);
const petals = [...Array(60)].map(() => {
  const m = mesh(petalGeo, new THREE.MeshStandardMaterial({ color: 0xf4b6c8, side: THREE.DoubleSide, transparent: true }), scene, [0, 0, 0], false);
  return { m, x: rnd(), z: rnd(), ph: rnd() * 6.28, sp: 0.4 + 0.4 * rnd() };
});
const SNOW_N = 2500, snowPos = new Float32Array(SNOW_N * 3), snowSeed = [...Array(SNOW_N)].map(() => [rnd() * 44 - 22, rnd() * 44 - 22, rnd(), rnd() * 6.28]);
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, depthWrite: false }));
scene.add(snow);

// 2D 层：对白气泡跟随 3D 人物头顶（透明度归 GSAP，位置归这里）
const anchors = [["ask", girl], ["reply", postman]].map(([id, p]) => ({ el: document.getElementById(`${id}Pos`), p }));
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const E = { sine: (k) => -(Math.cos(Math.PI * k) - 1) / 2, in2: (k) => k ** 3, io2: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2), lin: (k) => k };
const lerp = (a, b, k) => a + (b - a) * k;
const V = (a) => new THREE.Vector3(...a);
const inAny = (wins, t) => wins.some(([a, b2]) => t >= a && t < b2);

// ---- 镜头 ----
function evalCam(t) {
  let st = null;
  for (const s of D.shots) {
    if (s.t0 > t) break;
    if (s.k === "cut") { st = { p: V(s.p), l: V(s.l), fov: s.fov ?? (st ? st.fov : 38) }; continue; }
    if (s.k === "orbit") {
      const k = E[s.e](clamp((t - s.t0) / (s.t1 - s.t0))), a = THREE.MathUtils.degToRad(lerp(s.a[0], s.a[1], k));
      const r = lerp(s.r[0], s.r[1], k), c = V(s.c);
      st = { p: c.clone().add(new THREE.Vector3(r * Math.cos(a), lerp(s.h[0], s.h[1], k), r * Math.sin(a))), l: c, fov: s.fov };
      continue;
    }
    if (s.k === "move") {
      const k = E[s.e](clamp((t - s.t0) / (s.t1 - s.t0)));
      st = { p: st.p.clone().lerp(V(s.p1), k), l: st.l.clone().lerp(V(s.l1), k), fov: lerp(st.fov, s.fov, k) };
      continue;
    }
    if (s.k === "follow") {
      const a = actorAt(s.who, Math.min(t, s.t1)), tgt = new THREE.Vector3(a.x, 0, a.z);
      const k = E.io2(clamp((t - s.t0) / s.blend));
      st = { p: st.p.clone().lerp(tgt.clone().add(V(s.off)), k), l: st.l.clone().lerp(tgt.clone().add(new THREE.Vector3(0, s.lu, 0)), k), fov: st.fov };
    }
  }
  return st;
}

// ---- 路径：段内 smoothstep，与 build.py 的 path_at 相同；返回位置、朝向、累计路程 ----
const ss = (k) => k * k * (3 - 2 * k);
function pathAt(p, t) {
  let dist = 0, head = null;
  for (let i = 0; i < p.length - 1; i++) {
    const [t0, x0, z0] = p[i], [t1, x1, z1] = p[i + 1], len = Math.hypot(x1 - x0, z1 - z0);
    if (len > 1e-6 && t >= t0 - 1e-9) head = Math.atan2(x1 - x0, z1 - z0);
    if (t < t1) {
      const k = t <= t0 ? 0 : ss((t - t0) / (t1 - t0));
      return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, head: head ?? 0, dist: dist + len * k, moving: t > t0 && len > 1e-6 };
    }
    dist += len;
  }
  const l = p[p.length - 1];
  return { x: l[1], z: l[2], head: head ?? 0, dist, moving: false };
}
const actorAt = (who, t) => pathAt(D.act[who].path, t);

// ---- 季节与昼夜 ----
const keyAt = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) if (t < keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], E.io2((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0])));
  return keys[keys.length - 1][1];
};
const PAL = {  // 春 夏 秋 冬
  grass: [0x9fd68a, 0x6fbf5a, 0xc9b25a, 0xe8eef4], leaf: [0xf6b8cc, 0x5fae4f, 0xe8833a, 0x8a6a4a],
  sky: [0xbfe3f5, 0x8fd0f0, 0xf3d3a4, 0xc9d6e4], water: [0x7cc4e4, 0x4fb0d8, 0x6aa3bf, 0xc4dde8],
  wheat: [0x9bd27a, 0xc7d66a, 0xe9c25a, 0xd8cfb8], pine: [0x4f8a5c, 0x3f7f4c, 0x5a7a4c, 0x3d5a4a],
};
const NIGHT_SKY = new THREE.Color(0x1d2840), DUSK = new THREE.Color(0xf0a07a);
const cA = new THREE.Color(), cB = new THREE.Color();
function pal(name, s) {
  const a = Math.floor(s), k = s - a, arr = PAL[name];
  cA.setHex(arr[a % 4]); cB.setHex(arr[(a + 1) % 4]);
  return cA.clone().lerp(cB, E.io2(k));
}
function seasonAt(t) {
  const s = keyAt(D.season, t), n = keyAt(D.night, t);
  const sky = pal("sky", s);
  const dusk = Math.sin(Math.PI * clamp(n * 1.4));  // 黄昏与黎明的暖色
  sky.lerp(DUSK, 0.45 * dusk).lerp(NIGHT_SKY, clamp(n * 1.2 - 0.2));
  scene.background = sky; scene.fog.color.copy(sky);
  W.mats.grass.color.copy(pal("grass", s)); W.mats.leaf.color.copy(pal("leaf", s));
  W.mats.water.color.copy(pal("water", s)); W.mats.pine.color.copy(pal("pine", s));
  const az = THREE.MathUtils.degToRad(keyAt(D.sun, t));  // 延时段太阳转过半圈，影子扫过地面
  sun.position.set(26 * Math.cos(az), 22, 26 * Math.sin(az));
  hemi.intensity = lerp(1.1, 0.25, n); sun.intensity = lerp(2.2, 0.15, n);
  sun.color.setHex(0xfff1dc).lerp(DUSK, 0.6 * dusk);
  W.mats.window.emissiveIntensity = 1.8 * clamp(n * 1.3);
  W.lamp.material.emissiveIntensity = 0.2 + 2.5 * n;
  W.beam.material.opacity = 0.22 * n;
  W.beam.rotation.y = t * 0.9;
  W.lampLight.intensity = 30 * n;
  const winter = clamp((s - 2.7) / 0.3) * (1 - clamp((s - 3.35) / 0.25));
  W.snowCaps.forEach((c) => (c.visible = winter > 0.5));
  return { s, n, winter };
}

// ---- 角色逐帧 ----
const STRIDE = D.stride;
function placeWalker(p, who, t, o = {}) {
  const a = actorAt(who, t), show = inAny(D.act[who].show, t);
  p.root.visible = show;
  if (!show) return a;
  p.root.position.set(a.x, o.y ?? 0, a.z);
  p.root.rotation.y = o.face ?? a.head;
  pose(p, { phase: (Math.PI * a.dist) / STRIDE, amp: a.moving ? 1 : 0, ...o.pose });
  return a;
}

function actors(t) {
  // 女孩：春天走去投信，夏天在集市，秋天坐在码头
  const gSit = t >= D.act.girl.sitAt ? clamp((t - D.act.girl.sitAt - 4.2) / 0.6) : 0;
  const gWave = clamp((t - B.ask) / 0.3) * (1 - clamp((t - B.ask - 1.4) / 0.3));
  const gPost = clamp((t - B.post + 0.4) / 0.4) * (1 - clamp((t - B.post - 0.3) / 0.3));
  // 投信：走到邮筒旁转身面对它，再平伸右手
  const g0 = actorAt("girl", t), mb = D.lay.mailbox, toMb = Math.atan2(mb[0] - g0.x, mb[1] - g0.z);
  const turn = t < B.summer ? clamp((t - B.post + 0.7) / 0.4) : 0, dA = ((toMb - g0.head + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const gFace = t >= D.act.girl.sitAt ? Math.PI / 2 : turn > 0 ? g0.head + dA * E.io2(turn) : undefined;
  const ga = placeWalker(girl, "girl", t, { pose: { sit: gSit, wave: gWave, armUp: gPost }, face: gFace });
  if (t >= D.act.girl.sitAt) girl.root.position.y = 0.05 * gSit;
  envGirl.visible = t < B.post + 0.1;

  // 邮差：春夏骑车，冬天步行；捡信、送信
  const onBike = inAny(D.act.postman.bike, t);
  const pa = placeWalker(postman, "postman", t, { pose: { sit: onBike ? 0.55 : 0, amp: onBike ? 0 : undefined } });
  bk.visible = postman.root.visible && onBike;
  if (bk.visible) {
    bk.position.set(pa.x, 0, pa.z); bk.rotation.y = pa.head;
    postman.root.position.y = 0.35;
    const pedal = (Math.PI * pa.dist) / 1.1;
    postman.legL.rotation.x = -0.9 + 0.5 * Math.sin(pedal); postman.legR.rotation.x = -0.9 - 0.5 * Math.sin(pedal);
    postman.armL.rotation.x = postman.armR.rotation.x = -1.0;
  }
  envPost.visible = t >= B.pickUp && t < B.boat - 0.4 || t >= B.boatDock && t < B.knock + 0.3;
  if (t >= B.knock - 0.4 && t < B.inB) postman.armR.rotation.x = -1.6 + 0.25 * Math.sin((t - B.knock) * 28) * clamp((B.knock + 0.7 - t) * 3);

  // 小狗：紧跟在邮差正后方 1m
  const da = actorAt("postman", t);
  pup.root.visible = postman.root.visible;
  if (pup.root.visible) {
    const back = 1.0;
    pup.root.position.set(da.x - Math.sin(da.head) * back, 0, da.z - Math.cos(da.head) * back);
    pup.root.rotation.y = da.head;
    const ph = (Math.PI * da.dist) / 0.35, mv = da.moving ? 1 : 0;
    pup.legs.forEach((l, i) => (l.rotation.x = 0.6 * mv * Math.sin(ph + (i % 3 ? Math.PI : 0))));
    pup.tail.rotation.z = 0.5 * Math.sin(t * 14);
    pup.root.position.y = 0.04 * mv * Math.abs(Math.sin(ph));
  }

  // 面包店老板挥手；老人钓鱼，鱼竿抬起后溅水
  placeWalker(baker, "baker", t, { face: Math.PI * 0.15, pose: { wave: 0.6 + 0.4 * Math.sin(t * 2) } });
  const fa = placeWalker(fisher, "fisher", t, { face: Math.PI / 2, y: 0.3, pose: { sit: 1 } });
  const lift = clamp((t - B.fish) / 0.5) * (1 - clamp((t - B.fish - 1.6) / 0.6));
  fisher.armR.rotation.x = -0.5 - 0.9 * lift;
  const sk = clamp((t - B.fish - 0.8) / 0.7);
  splash.visible = fisher.root.visible && sk > 0 && sk < 1;
  splash.position.set(fa.x + 2.0, 0.05, fa.z);
  splash.scale.setScalar(0.3 + 1.6 * sk);
  splash.material.opacity = 1 - sk;

  // 船
  const ba = pathAt(D.boat, t);
  W.boat.position.set(ba.x, 0.05 + 0.06 * Math.sin(t * 1.7), ba.z);
  W.boat.rotation.set(0.03 * Math.sin(t * 1.3), ba.head - Math.PI / 2, 0.04 * Math.sin(t * 1.1));
  W.boatWin.material = W.mats.window;
}


// 集市环线（与 layout.py 的 stadium 同一公式）、河道中线
function stadium(sv) {
  const m = D.market, L = m.x1 - m.x0, r = m.r, P = m.P;
  const s = ((sv % P) + P) % P;
  if (s < L) return [m.x0 + s, m.z0, Math.PI / 2];
  if (s < L + Math.PI * r) { const th = (s - L) / r; return [m.x1 + r * Math.sin(th), m.z0 + r - r * Math.cos(th), Math.atan2(Math.cos(th), Math.sin(th))]; }
  if (s < 2 * L + Math.PI * r) return [m.x1 - (s - L - Math.PI * r), m.z0 + 2 * r, -Math.PI / 2];
  const th = (s - 2 * L - Math.PI * r) / r;
  return [m.x0 - r * Math.sin(th), m.z0 + r + r * Math.cos(th), Math.atan2(-Math.cos(th), -Math.sin(th))];
}
function riverZ(x) {
  const r = D.lay.river;
  for (let i = 0; i < r.length - 1; i++) if (x <= r[i + 1][0]) return lerp(r[i][1], r[i + 1][1], clamp((x - r[i][0]) / (r[i + 1][0] - r[i][0])));
  return r[r.length - 1][1];
}

// ---- 人群、动物、天气 ----
function life(t, S) {
  const summer = t >= B.lapse1End && t < B.summerEnd, spring = t >= B.spring && t < B.lapse1;
  W.stalls.visible = S.s > 0.6 && S.s < 1.6;
  const M_ = D.market;
  crowd.forEach((c, k) => {
    const show = summer ? true : spring && k < M_.spring;
    c.p.root.visible = show;
    if (!show) return;
    if (c.idle) {  // 摊前驻足：原地看货、偶尔摆手
      c.p.root.position.set(c.idle[0], 0, c.idle[1]); c.p.root.rotation.y = c.idle[2];
      pose(c.p, { wave: 0.3 + 0.3 * Math.sin(t * 2 + k) });
      return;
    }
    const [x, z, h] = stadium(c.s0 + M_.v * t);
    c.p.root.position.set(x, 0, z); c.p.root.rotation.y = h;
    pose(c.p, { phase: (Math.PI * M_.v * t) / 0.55, amp: 1 });
  });

  // 鸭群：春夏在河上，沿河漂，轻轻起伏
  // 鸭群：各自在河中段绕椭圆慢游，不越出河道
  ducks.forEach((d, k) => {
    d.m.visible = S.s < 1.7;
    const q = D.ducks[k], a = q.w * t + q.ph, x = q.cx + q.ax * Math.sin(a), dx = q.ax * Math.cos(a), dz = -q.az * Math.sin(a);
    const z = riverZ(x) + q.az * Math.cos(a), slope = (riverZ(x + 0.05) - riverZ(x - 0.05)) / 0.1;
    d.m.position.set(x, 0.04 + 0.03 * Math.sin(t * 2.4 + d.ph), z);
    d.m.rotation.set(0.06 * Math.sin(t * 2 + d.ph), Math.atan2(dx, dz + slope * dx), 0);
  });

  // 鸽群：钟响后从钟楼盘旋飞出
  const [tx, tz] = D.lay.tower;
  pigeons.forEach((p) => {
    const u = t - B.pigeons;
    p.b.root.visible = u > 0 && u < 9;
    if (!p.b.root.visible) return;
    const a = p.a + u * 0.55, r = 1 + u * 2.2 * p.r;
    p.b.root.position.set(tx + r * Math.cos(a), 6.5 + u * p.up * 1.4, tz + r * Math.sin(a));
    p.b.root.rotation.set(0, -a, 0.35);
    flap(p.b, t * 22 + p.ph);
  });

  // 雁阵：秋天由北向南横穿
  const gu = t - B.geese;
  geese.forEach((g, i) => {
    g.root.visible = gu > 0 && gu < 9;
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    g.root.position.set(-24 + gu * 4.2 - row * 1.2, 9 + 0.15 * Math.sin(t * 2 + i), -14 + gu * 1.4 + side * row * 1.1);
    g.root.rotation.y = Math.atan2(4.2, 1.4);
    flap(g, t * 9 + i);
  });

  // 鹿：冬天在大树附近慢走、低头
  deers.forEach((d, i) => {
    d.root.visible = S.winter > 0.5;
    const u = Math.max(0, t - B.winter), x = D.deer[i][0] + 0.06 * u, z = D.deer[i][1];
    d.root.position.set(x, 0, z); d.root.rotation.y = Math.PI / 2 - 0.2 * i;
    const ph = u * 2.4 + i;
    d.legs.forEach((l, j) => (l.rotation.x = 0.35 * Math.sin(ph + (j % 3 ? Math.PI : 0))));
    d.neck.rotation.x = 0.9 * clamp(Math.sin(u * 0.6 + i * 2));
  });

  // 落英（春）、雪（冬）
  const pk = S.s < 0.9 ? 1 - clamp((S.s - 0.6) / 0.3) : 0;
  petals.forEach((p) => {
    p.m.visible = pk > 0;
    const fall = (p.sp * t + p.ph) % 6;
    p.m.position.set(D.lay.tree[0] + (p.x - 0.5) * 9 + 0.6 * Math.sin(t + p.ph), 5.5 - fall, D.lay.tree[1] + (p.z - 0.5) * 9 + fall * 0.8);
    p.m.rotation.set(t * 2 + p.ph, t * 1.3, p.ph);
    p.m.material.opacity = pk;
  });
  snow.visible = S.winter > 0.01;
  snow.material.opacity = S.winter;
  for (let i = 0; i < SNOW_N; i++) {
    const [x, z, h, ph] = snowSeed[i], y = 18 - ((h * 18 + t * 1.1) % 18);
    snowPos[3 * i] = x + 0.4 * Math.sin(t * 0.8 + ph); snowPos[3 * i + 1] = y - 1; snowPos[3 * i + 2] = z + 0.3 * Math.cos(t * 0.6 + ph);
  }
  snowGeo.attributes.position.needsUpdate = true;
}

// ---- 植物随季节 ----
const mat4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc4 = new THREE.Vector3(), p4 = new THREE.Vector3();
function flora(t, S) {
  const fall = clamp((S.s - 2.3) / 0.6);  // 秋末到冬落叶
  const regrow = clamp((S.s - 3.25) / 0.3);
  W.leaves.forEach((l) => l.scale.setScalar(Math.max(1e-3, l.userData.s * (1 - clamp((fall - l.userData.k * 0.5) * 2)))));
  W.buds.forEach((b) => b.scale.setScalar(Math.max(1e-3, 1.4 * clamp((regrow - b.userData.k * 0.6) * 2.5))));
  W.flowers.visible = S.s < 1.4 || S.s > 3.4;
  const wc = pal("wheat", S.s), grow = clamp(S.s / 1.6) * (1 - clamp((S.s - 2.45) / 0.15)), wind = 0.18 + 0.12 * Math.sin(t * 0.7);
  W.wheat.material.color.copy(wc);
  W.wheatBase.forEach((w, i) => {
    q4.setFromEuler(new THREE.Euler(wind * Math.sin(t * 1.6 + w.ph + w.x * 0.4), 0, 0.5 * wind * Math.cos(t * 1.3 + w.ph)));
    sc4.set(1, Math.max(0.05, w.s * (0.35 + 0.65 * grow)), 1);
    W.wheat.setMatrixAt(i, mat4.compose(p4.set(w.x, 0, w.z), q4, sc4));
  });
  W.wheat.instanceMatrix.needsUpdate = true;
  W.hay.forEach((h) => (h.visible = S.s >= 2.45 && S.s < 2.95));
  W.hand.rotation.z = -t * 0.6;
  W.bell.rotation.z = 0.35 * Math.sin((t - B.bell) * 6) * clamp(1 - (t - B.bell) / 3.6) * (t > B.bell ? 1 : 0);
  W.cloudRing.rotation.y = t * 0.012;
  W.mailFlag.rotation.z = t > B.post ? -1.2 * clamp((t - B.post) / 0.3) : 0;
}

const v3 = new THREE.Vector3();
function renderAt(t) {
  const S = seasonAt(t);
  actors(t); life(t, S); flora(t, S);
  const c = evalCam(t);
  cam.position.copy(c.p); cam.lookAt(c.l); cam.fov = c.fov; cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  anchors.forEach(({ el, p }) => {
    p.head.getWorldPosition(v3); v3.y += 0.55; v3.project(cam);
    el.style.transform = `translate(${((v3.x * 0.5 + 0.5) * WW).toFixed(1)}px, ${((-v3.y * 0.5 + 0.5) * HH).toFixed(1)}px)`;
  });
}
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
