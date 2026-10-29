// 邻居线（3D）：一年的延时。阳台、花盆里的树、邻居浇水与撑伞，画面只取决于 t
import * as THREE from "three";
import { M, mesh, mulberry32 } from "./assets/shared/js/lowpoly.js";
import { sunPlace } from "./acts.js";
import { person } from "./assets/shared/js/creatures.js";

const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const lerp = (a, b, k) => a + (b - a) * k;
const io = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const seg = (t, a, b) => io(clamp((t - a) / (b - a)));
const V = (a) => new THREE.Vector3(...a);

function buildWorld(canvas, D) {
  const B = D.beats, L = D.lay3, rnd = mulberry32(9), WW = 1920, HH = 1080;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(WW, HH, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, WW / HH, 0.05, 400);
  scene.fog = new THREE.Fog(0xcfe6ef, 25, 140);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8b8a0, 2.0), sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 40 });
  sun.shadow.bias = -0.0006; scene.add(hemi, sun, sun.target);

  // 阳台：地面、栏杆、隔墙、邻居一侧
  const mats = { floor: M(0xd9c4a6), rail: M(0x6a767e), wall: M(0xefd2b8), cap: M(0xe2c2a6), wood: M(0xb4825a), pot: M(0xd9825a), soil: M(0x6e4a30), snow: M(0xf4f7fa) };
  mesh(new THREE.BoxGeometry(3.4, 0.1, 2.8), mats.floor, scene, [-0.7, -0.05, 0.1]);
  mesh(new THREE.BoxGeometry(2.6, 0.1, 2.8), mats.floor, scene, [2.36, -0.05, 0.1]);
  const railX0 = L.balX0, railX1 = L.nbX1;
  for (let x = railX0; x < railX1; x += 0.12) if (Math.abs(x - L.divX) > 0.08) mesh(new THREE.BoxGeometry(0.025, L.railH, 0.025), mats.rail, scene, [x, L.railH / 2, L.railZ]);
  mesh(new THREE.BoxGeometry(railX1 - railX0, 0.05, 0.06), mats.rail, scene, [(railX0 + railX1) / 2, L.railH, L.railZ]);
  mesh(new THREE.BoxGeometry(railX1 - railX0, 0.08, 0.1), mats.cap, scene, [(railX0 + railX1) / 2, 0.04, L.railZ]);
  mesh(new THREE.BoxGeometry(L.divT, L.divH, L.wallZ - L.railZ), mats.wall, scene, [L.divX, L.divH / 2, (L.wallZ + L.railZ) / 2]);
  mesh(new THREE.BoxGeometry(railX1 - railX0, 2.8, 0.2), mats.wall, scene, [(railX0 + railX1) / 2, 1.4, L.wallZ + 0.1]);
  const caps = [mesh(new THREE.BoxGeometry(railX1 - railX0, 0.04, 0.1), mats.snow, scene, [(railX0 + railX1) / 2, L.railH + 0.04, L.railZ], false),
    mesh(new THREE.BoxGeometry(L.divT + 0.02, 0.05, L.wallZ - L.railZ), mats.snow, scene, [L.divX, L.divH + 0.03, (L.wallZ + L.railZ) / 2], false)];
  // 邻居的花架与天竺葵
  const geran = [];
  for (let k = 0; k < 4; k++) {
    const x = 1.6 + k * 0.42;
    mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3), mats.wood, scene, [x, 0.25, -1.05]);
    mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.2, 8), mats.pot, scene, [x, 0.6, -1.05]);
    const f = mesh(new THREE.IcosahedronGeometry(0.16, 0), M(0x6f9a5a), scene, [x, 0.8, -1.05]);
    const fl = mesh(new THREE.IcosahedronGeometry(0.07, 0), M(0xd9483b), scene, [x + 0.04, 0.92, -1.0]);
    geran.push(f, fl);
  }
  // 凳子、花盆、女孩留下的小水壶
  const [px, pz] = L.pot, soilY = L.pot[2] + L.pot[3];
  mesh(new THREE.BoxGeometry(0.6, 0.04, 0.32), mats.wood, scene, [L.stool[0] - 0.1, L.stool[2] - 0.02, L.stool[1]]);
  for (const dx of [-0.36, 0.16]) for (const dz of [-0.12, 0.12]) mesh(new THREE.BoxGeometry(0.04, L.stool[2] - 0.04, 0.04), mats.wood, scene, [L.stool[0] + dx, (L.stool[2] - 0.04) / 2, L.stool[1] + dz]);
  const pot = mesh(new THREE.CylinderGeometry(L.pot[4], L.pot[5], L.pot[3], 12), mats.pot, scene, [px, L.pot[2] + L.pot[3] / 2, pz]);
  mesh(new THREE.CylinderGeometry(L.pot[4] - 0.015, L.pot[4] - 0.015, 0.01, 12), mats.soil, scene, [px, soilY - 0.02, pz], false);
  const snowSoil = mesh(new THREE.CylinderGeometry(L.pot[4] - 0.012, L.pot[4] - 0.012, 0.03, 12), mats.snow, scene, [px, soilY - 0.005, pz], false);
  const canG = new THREE.Group(); scene.add(canG); canG.position.set(L.can[0], L.stool[2], L.can[1]);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), M(0xf2c14e), canG, [0, 0.06, 0]);
  mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.14, 5), M(0xe0ab3a), canG, [0.08, 0.1, 0]).rotation.z = -0.9;
  // 窗外的城市
  const city = [];
  for (let k = 0; k < 70; k++) {
    const x = (rnd() - 0.5) * 140, z = -40 - rnd() * 90, h = 3 + rnd() * 12, w = 4 + rnd() * 7;
    mesh(new THREE.BoxGeometry(w, h, w), M([0xd7e2ea, 0xe8dccf, 0xc3d3df, 0xe3cdbd][k % 4]), scene, [x, -14 + h / 2, z], false);
    if (k % 3 === 0) city.push(mesh(new THREE.IcosahedronGeometry(1.6 + rnd(), 0), M(0x9fc98a), scene, [x + 4, -12.5, z + 3], false));
  }
  return { renderer, scene, cam, hemi, sun, caps, geran, pot, snowSoil, city, soil: [px, soilY, pz], mats, rnd, B, L, WW, HH };
}

// 树：按最终形态建好，整体随高度缩放；叶子各有长出、变色、落下的季节值
function buildTree(W) {
  const { scene, rnd } = W, root = new THREE.Group(), FINAL = 1.25;
  root.position.set(...W.soil); scene.add(root);
  const bark = M(0x7a5a3e), trunk = mesh(new THREE.CylinderGeometry(0.018, 0.035, FINAL, 6), bark, root, [0, FINAL / 2, 0]);
  const tips = [[0, FINAL, 0]];
  [[0.42, 0.6, 0.3], [0.55, -0.9, 0.34], [0.7, 2.2, 0.3], [0.82, 3.6, 0.24]].forEach(([hf, a, len]) => {
    const y = hf * FINAL, dir = new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)).normalize();
    const br = mesh(new THREE.CylinderGeometry(0.008, 0.014, len, 5), bark, root, [0, y, 0]);
    br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); br.position.add(dir.clone().multiplyScalar(len / 2));
    tips.push([dir.x * len, y + dir.y * len, dir.z * len]);
  });
  const leafGeo = new THREE.IcosahedronGeometry(0.07, 0), leaves = [];
  for (let k = 0; k < 46; k++) {
    const tp = tips[k % tips.length], j = () => (rnd() - 0.5) * 0.22;
    const pos = k < 6 ? [j() * 0.4, 0.15 + k * 0.12, j() * 0.4] : [tp[0] + j(), tp[1] - 0.05 + j() * 0.8, tp[2] + j()];
    const m = mesh(leafGeo, M(0x7fbf5a), root, pos);
    m.scale.set(1, 0.45, 1.3); m.rotation.set(rnd() * 3, rnd() * 3, 0);
    const born = 0.3 + (pos[1] / FINAL) * 1.9 * rnd() ** 0.3, fall = 2.45 + rnd() * 0.45;
    leaves.push({ m, pos, born, fall, ph: rnd() * 6.28, dx: (rnd() - 0.5) * 0.5, dz: (rnd() - 0.5) * 0.5 });
  }
  const blossom = [];
  for (let k = 0; k < 30; k++) {
    const tp = tips[k % tips.length], m = mesh(new THREE.IcosahedronGeometry(0.045, 0), M(k % 3 ? 0xf6c2cc : 0xffffff), root, [tp[0] + (rnd() - 0.5) * 0.25, tp[1] + (rnd() - 0.5) * 0.2, tp[2] + (rnd() - 0.5) * 0.25]);
    blossom.push({ m, born: 3.72 + rnd() * 0.22 });
  }
  const coty = [-1, 1].map((s) => { const m = mesh(new THREE.IcosahedronGeometry(0.03, 0), M(0x9fd68a), scene, [W.soil[0] + 0.03 * s, W.soil[1] + 0.05, W.soil[2]]); m.scale.set(1.4, 0.35, 0.8); return m; });
  return { root, leaves, blossom, coty, FINAL };
}
const sat = (x) => Math.max(1e-3, x);
const SKY = [0xcfe6ef, 0xa8d8ea, 0xecd9b4, 0xc9d3df, 0xd6ecf2], LIGHT = [0xfff1dc, 0xfff6e0, 0xffd9a8, 0xdfe6f0, 0xfff1dc];
const colAt = (arr, s) => { const a = Math.min(Math.floor(s), 3), k = clamp(s - a); return new THREE.Color(arr[a]).lerp(new THREE.Color(arr[a + 1]), k); };
const heightAt = (s) => (s < 0.15 ? 0 : 0.06 + 0.5 * io(clamp((s - 0.15) / 1.2)) + 0.3 * io(clamp((s - 1.35) / 0.9)) + 0.39 * io(clamp((s - 3.6) / 0.4)));

// 邻居：浇水、撑伞、拍照；延时摄影里人只在这几个时刻出现
function buildNeighbor(W) {
  const { scene, L } = W, p = person(scene, { coat: 0x6f8f5a, pants: 0x7a5a42, hair: 0xd8d4cc, scale: 0.95 });
  p.root.position.set(L.nb[0], 0, L.nb[1]);
  // 老人发型：头发只盖头顶后半，露出脸；加眼镜
  const hair = p.head.children[1];
  hair.scale.set(0.98, 0.45, 0.9); hair.position.set(0, 0.12, -0.07);
  for (const x of [-0.07, 0.07]) mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 10), M(0x4a4a4a), p.head, [x, 0.02, 0.19], false);
  const can = new THREE.Group(); p.armR.add(can); can.position.set(0, -0.62, 0);
  mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.18, 8), M(0x6f9a8a), can, [0, -0.05, 0.02]).rotation.x = Math.PI / 2;
  const spoutG = new THREE.CylinderGeometry(0.012, 0.02, 0.3, 5); spoutG.rotateX(Math.PI / 2);
  mesh(spoutG, M(0x5f8a7a), can, [0, -0.02, 0.24]);
  const spout = new THREE.Object3D(); can.add(spout); spout.position.set(0, -0.02, 0.4);
  const phone = mesh(new THREE.BoxGeometry(0.08, 0.15, 0.012), M(0x2b2d33), p.armR, [0, -0.66, 0.03], false);
  const umb = new THREE.Group(); scene.add(umb);
  const cone = new THREE.ConeGeometry(0.62, 0.26, 10, 1, true);
  mesh(cone, M(0xd9483b, { side: THREE.DoubleSide }), umb, [0, 0, 0]);
  const shaft = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), M(0x4a3a2a), umb, [0, 0, 0]);
  const drops = [...Array(14)].map(() => mesh(new THREE.SphereGeometry(0.012, 5, 4), new THREE.MeshBasicMaterial({ color: 0x8fd0e8 }), scene, [0, 0, 0], false));
  const mats = [];
  p.root.traverse((o) => o.material && !mats.includes(o.material) && mats.push(o.material));
  mats.forEach((m) => (m.transparent = true));
  return { p, can, spout, phone, umb, shaft, drops, mats };
}

export function makeGrow(canvas, D) {
  const W = buildWorld(canvas, D), T = buildTree(W), N = buildNeighbor(W), { B, L, scene, cam, renderer } = W;
  // 起始镜头朝 sun3.dir；太阳圆盘与像平面平行，按 sunPlace 反求，投影落在 (C, R)，与冬夜月亮重合
  const P0 = V(D.cam3[0][1]), S3 = D.sun3, sp = sunPlace(D.cam3[0][1], S3.dir, D.C, D.R, S3.fov, S3.depth);
  const tmp = new THREE.PerspectiveCamera();
  const lookQ = (p, l) => { tmp.position.copy(p); tmp.lookAt(l); return tmp.quaternion.clone(); };
  const q0 = lookQ(P0, P0.clone().add(V(S3.dir)));
  const sunM = new THREE.Mesh(new THREE.CircleGeometry(sp.radius, 48), new THREE.MeshBasicMaterial({ color: 0xf6c453, toneMapped: false, fog: false }));
  sunM.position.set(...sp.pos); sunM.quaternion.copy(q0); scene.add(sunM);
  const K = D.cam3.map(([t, p, l]) => ({ t, p: V(p), l: l && V(l) }));
  const SN = 900, snowPos = new Float32Array(SN * 3), seeds = [...Array(SN)].map(() => [W.rnd() * 6 - 2.5, W.rnd() * 3.2, W.rnd() * 4 - 2.4]);
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, depthWrite: false })); scene.add(snow);
  const sAt = (t) => (t < B.lapse0 ? 0 : t < B.lapse1 ? (4 * (t - B.lapse0)) / (B.lapse1 - B.lapse0) : 4);
  const wins = [[B.w1, B.w1e, "water"], [B.w2, B.w2e, "water"], [B.w3, B.w3e, "water"], [B.umb, B.umbE, "umb"], [B.lapse1, 1e9, "photo"]];
  const lc = new THREE.Color(), cG = new THREE.Color(0x6fb04f), cY = new THREE.Color(0xe9b949), cO = new THREE.Color(0xe8833a), cN = new THREE.Color(0x9fd68a);

  function camera(t) {
    // 视角：起始 45°（与月亮对位），下摇时放宽到 50°
    cam.fov = lerp(S3.fov, 50, seg(t, B.tiltDown0, B.tiltDown1)); cam.updateProjectionMatrix();
    if (t < B.tiltDown0) { cam.position.copy(P0); cam.quaternion.copy(q0); return; }
    if (t < B.tiltDown1) { cam.position.copy(P0); cam.quaternion.slerpQuaternions(q0, lookQ(P0, K[1].l), seg(t, B.tiltDown0, B.tiltDown1)); return; }
    if (t >= B.povCut) { cam.position.copy(K[4].p); cam.lookAt(K[4].l); return; }
    let i = 1; while (i < 3 && t >= K[i + 1].t) i++;
    const k = i < 3 ? seg(t, K[i].t, K[i + 1].t) : 1, a = K[i], b = K[Math.min(i + 1, 3)];
    cam.position.lerpVectors(a.p, b.p, k);
    cam.lookAt(new THREE.Vector3().lerpVectors(a.l, b.l, k));
  }

  function render(t0) {
    const t = Math.min(t0, B.shutter), s = sAt(t);
    const sky = colAt(SKY, s); scene.background = sky; scene.fog.color.copy(sky);
    W.sun.color.copy(colAt(LIGHT, s)); W.sun.intensity = s > 2.9 && s < 3.7 ? 1.2 : 1.9;
    const az = 0.6 + 0.5 * s; W.sun.position.set(W.soil[0] + 8 * Math.cos(az), 12, W.soil[2] + 8 * Math.sin(az) - 4); W.sun.target.position.set(...W.soil);
    const winter = s > 3.0 && s < 3.75;
    W.caps.forEach((c) => (c.visible = s > 3.1 && s < 3.8)); W.snowSoil.visible = s > 3.1 && s < 3.8;
    W.geran.forEach((g, i) => { g.visible = !(i % 2 && s > 2.6 && s < 3.8); });
    W.city.forEach((c) => c.material.color.copy(colAt([0xa9cf8a, 0x6fbf5a, 0xe0a050, 0xe8eef4, 0xb5dc9a], s)));
    // 树
    const h = heightAt(s); T.root.scale.setScalar(sat(h / T.FINAL)); T.root.visible = h > 0;
    T.coty.forEach((c) => { c.visible = s > 0.12 && s < 0.9; c.scale.setScalar(1); c.scale.set(1.4 * seg(s, 0.12, 0.3), 0.35, 0.8); });
    const sc = sat(h / T.FINAL);
    T.leaves.forEach((lf, k) => {
      const reborn = 3.72 + (k % 7) * 0.03;
      if (s < lf.born) { lf.m.visible = false; return; }
      lf.m.visible = true;
      if (s < lf.fall || s >= reborn) {
        const g0 = s >= reborn ? seg(s, reborn, reborn + 0.15) : seg(s, lf.born, lf.born + 0.25);
        lf.m.position.set(...lf.pos); lf.m.scale.set(g0, 0.45 * g0, 1.3 * g0);
        lc.copy(s >= reborn ? cN : cG).lerp(cY, s >= reborn ? 0 : seg(s, 2.05, 2.35)).lerp(cO, s >= reborn ? 0 : seg(s, 2.35, 2.6));
        lf.m.material.color.copy(lc);
        lf.m.rotation.z = 0.15 * Math.sin(t * 2 + lf.ph);
        return;
      }
      if (s > 3.1) { lf.m.visible = false; return; }
      const u = seg(s, lf.fall, lf.fall + 0.25), wx0 = W.soil[0] + lf.pos[0] * sc, wy0 = W.soil[1] + lf.pos[1] * sc, wz0 = W.soil[2] + lf.pos[2] * sc;
      const wx = wx0 + lf.dx * u, wy = lerp(wy0, 0.01, u), wz = wz0 + lf.dz * u;
      lf.m.position.set((wx - W.soil[0]) / sc, (wy - W.soil[1]) / sc, (wz - W.soil[2]) / sc);
      lf.m.scale.set(1 / sc, 0.45 / sc, 1.3 / sc); lf.m.rotation.x = u * 6 + lf.ph;
      lf.m.material.color.copy(cO);
    });
    T.blossom.forEach((b) => { const k = seg(s, b.born, b.born + 0.12); b.m.visible = k > 0; b.m.scale.setScalar(sat(k)); });
    // 雪
    snow.visible = winter; snow.material.opacity = seg(s, 3.0, 3.15) * (1 - seg(s, 3.6, 3.75));
    for (let i = 0; i < SN; i++) { const [x, y, z] = seeds[i]; snowPos[3 * i] = x + 0.1 * Math.sin(t + i); snowPos[3 * i + 1] = 3.2 - ((3.2 - y + t * 0.6) % 3.2); snowPos[3 * i + 2] = z; }
    snowGeo.attributes.position.needsUpdate = true;
    neighbor(t);
    camera(t0 >= B.shutter ? B.shutter : t0);
    renderer.render(scene, cam);
  }

  function neighbor(t) {
    let op = 0, kind = null, a0 = 0, a1 = 0;
    for (const [a, b, k] of wins) if (t > a - 0.3 && t < b + 0.3) { op = seg(t, a - 0.3, a) * (1 - seg(t, b, b + 0.3)); kind = k; a0 = a; a1 = b; }
    if (t >= B.povCut) op = 0;  // 手机视角：拍照的人不入画
    N.p.root.visible = op > 0.01; N.mats.forEach((m) => { m.opacity = op; m.depthWrite = op > 0.99; });
    N.umb.visible = kind === "umb" && op > 0.01; N.phone.visible = kind === "photo"; N.can.visible = kind === "water";
    N.drops.forEach((d) => (d.visible = false));
    if (!kind) return;
    N.p.root.rotation.y = -Math.PI / 2 + (kind === "photo" ? 0.5 : 0.3);
    N.p.armL.rotation.set(kind === "photo" ? -1.6 * seg(t, B.phoneUp, B.phoneUp + 0.5) : 0, 0, 0);
    if (kind === "water") {
      const lift = seg(t, a0, a0 + 0.35) * (1 - seg(t, a1 - 0.3, a1));
      N.p.armR.rotation.set(-0.3 - 1.05 * lift, 0, 0); N.can.rotation.x = 0.55 * lift;
      if (lift > 0.9) {
        const sp = new THREE.Vector3(); N.spout.getWorldPosition(sp);
        N.drops.forEach((d, i) => { const u = ((t * 2.2 + i / N.drops.length) % 1); d.visible = true; d.position.set(lerp(sp.x, W.soil[0] + 0.02, u), lerp(sp.y, W.soil[1], u * u), lerp(sp.z, W.soil[2], u)); });
      }
    } else if (kind === "umb") {
      N.p.armR.rotation.set(-2.3, 0, 0);
      const hand = new THREE.Vector3(); N.can.getWorldPosition(hand);
      const top = new THREE.Vector3(W.soil[0] + 0.05, 1.68, W.soil[2]);
      N.umb.position.copy(top); N.shaft.position.set(0, 0, 0);
      const d = hand.clone().sub(top); N.shaft.scale.set(1, d.length(), 1);
      N.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); N.shaft.position.copy(d.clone().multiplyScalar(0.5));
    } else {
      N.p.armR.rotation.set(-1.6 * seg(t, B.phoneUp, B.phoneUp + 0.5), 0, 0);
    }
  }
  return { render, renderer };
}
