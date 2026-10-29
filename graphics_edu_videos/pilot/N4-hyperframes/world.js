// N4 世界：同一个 3D 场景，四季只改材质色、雪与光；画风由 post.js 的管线状态决定
import * as THREE from "three";
import { makeHuman, makeCat } from "./rig.js";
import { hash, lerp, seg, E, clamp01 } from "./path.js";

// 四季色板 [春, 夏, 秋, 冬]；第 5 季即第二年春
export const PAL = {
  sky: ["#bfe6f5", "#86cdf2", "#f3d9a8", "#c9d6e6"], grass: ["#9bd46c", "#5fba5c", "#c7a650", "#d9e2ec"],
  hill: ["#7ec39c", "#4fa07c", "#b98a5c", "#a9b8cb"], hill2: ["#9fd3b4", "#73b897", "#d0a679", "#bfcbda"],
  leaf: ["#f4a8c2", "#3f9e52", "#e2783a", "#7d8a80"], leaf2: ["#fbc9d8", "#5bb365", "#eda24a", "#9aa69c"],
  wheat: ["#a9d878", "#d9c45c", "#e9b646", "#c4ced9"], roof: ["#d9624e", "#d9624e", "#c9563f", "#f2f5f8"],
  awnA: ["#e65a5a", "#e65a5a", "#e65a5a", "#eef2f6"], awnB: ["#fff4e0", "#fff4e0", "#fff4e0", "#eef2f6"],
  path: ["#e9d9b2", "#e9d6a8", "#d9c08e", "#e3e9f0"], cloud: ["#ffffff", "#ffffff", "#fff3e0", "#eef2f7"],
};
export const CONST = {
  wall: "#f3e7d1", door: "#8a5a3c", window: "#ffd982", trunk: "#7a5236", stone: "#9aa0a8", soil: "#8c6a4c", post: "#9a6b46",
  red: "#e23b3b", jeans: "#3a4a6b", skin: "#f2c39c", hairA: "#3b2a22", hairB: "#6a3f2a", teal: "#2fa7a0", shoe: "#3a3036",
  catFur: "#f28c28", catLight: "#fde2c0", snow: "#ffffff", carrot: "#f07a2a", kiteA: "#ffd23f", kiteB: "#3f7fe0", ribbon: "#e65a5a",
  bflyA: "#ffb02e", bflyB: "#3a2a30", fruitA: "#e8483f", fruitB: "#f2b43a", fruitC: "#7cc34e", flowerA: "#ff7aa8", flowerB: "#ffd23f",
  sun: "#fff2c4",
};
export const CROWD_COLORS = [["#5a7fd8", "#3a3a4a"], ["#9b6bd1", "#4a3a3a"], ["#f2a93b", "#3a4a6b"], ["#5bb39a", "#5a4a3a"], ["#e86f9a", "#3a3a4a"], ["#7a8a9a", "#2a3a4a"]];

const C = (h) => new THREE.Color(h);
export function seasonColor(key, s) {
  const p = PAL[key], i = Math.floor(s) % 4, j = (i + 1) % 4, u = s - Math.floor(s);
  return C(p[i]).lerp(C(p[j]), u);
}
// 材质表：同名共用一份；季节色每帧刷新
export function makeMaterials() {
  const mats = new Map();
  const M = (name) => {
    if (!mats.has(name)) {
      const hex = CONST[name] || (name.startsWith("#") ? name : PAL[name] ? PAL[name][0] : "#ff00ff");
      const m = new THREE.MeshLambertMaterial({ color: hex }); m.userData.key = name; mats.set(name, m);
    }
    return mats.get(name);
  };
  const update = (s, snow) => {
    for (const [k, m] of mats) {
      if (PAL[k]) m.color.copy(seasonColor(k, s));
      if (m.userData.snowy) m.color.copy(C(CONST[k] || k)).lerp(C(CONST.snow), snow);
    }
  };
  return { M, mats, update };
}

const mesh = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; };
const Box = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; };
function prismRoof(w, d, h) {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
}

function buildStatic(scene, M, L) {
  const ground = mesh(new THREE.CircleGeometry(48, 48).rotateX(-Math.PI / 2), M("grass"), 0, 0, 0, false); scene.add(ground);
  const pathG = new THREE.PlaneGeometry(30, 1.3).rotateX(-Math.PI / 2);
  scene.add(mesh(pathG, M("path"), 0, 0.005, 0.15, false));
  // 远山：一圈低多边形山丘，挡住地面边缘
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2, r = 17 + 3 * hash(i), h = 1.4 + 1.6 * hash(i + 40);
    if (Math.cos(a) < 0.35) continue; // 只留身后半圈：前方是镜头
    const g = new THREE.ConeGeometry(3.5 + 2.5 * hash(i + 9), h, 5); g.translate(0, h / 2, 0);
    scene.add(mesh(g, M(i % 2 ? "hill" : "hill2"), Math.sin(a) * r, 0, -Math.cos(a) * r, false));
  }
  // 房子
  const h = L.house, house = new THREE.Group(); house.position.set(h.x, 0, h.z); scene.add(house);
  house.add(mesh(Box(h.w, h.h, h.d), M("wall")));
  const roof = mesh(prismRoof(h.w + 0.4, h.d + 0.3, 1.2), M("roof")); roof.position.y = h.h; house.add(roof);
  house.add(mesh(Box(0.36, 0.8, 0.36), M("roof"), 0.7, h.h + 0.3, -0.3));
  house.add(mesh(Box(0.62, 1.15, 0.06), M("door"), 0.1, 0, h.d / 2));
  for (const x of [-0.85, 0.95]) house.add(mesh(Box(0.5, 0.5, 0.05), M("window"), x, 1.0, h.d / 2));
  // 屋前花丛
  for (let i = 0; i < 9; i++) scene.add(mesh(Box(0.14, 0.22 + 0.12 * hash(i), 0.14), M(i % 2 ? "flowerA" : "flowerB"), -7.6 + 0.3 * i, 0, 0.55 + 0.2 * hash(i + 3)));
  // 石头
  const st = new THREE.DodecahedronGeometry(L.stone.r, 0); st.scale(1, L.stone.top / L.stone.r, 0.9);
  scene.add(mesh(st, M("stone"), L.stone.x, 0.0, L.stone.z));
  // 集市两个摊位：柱、柜台、条纹棚、货
  for (const [si, s] of L.stalls.entries()) {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); scene.add(g);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(Box(0.08, 1.9, 0.08), M("post"), (px * s.w) / 2, 0, (pz * s.d) / 2));
    g.add(mesh(Box(s.w, 0.8, 0.4), M("post"), 0, 0, s.d / 2 - 0.2));
    for (let k = 0; k < 6; k++) g.add(mesh(Box(s.w / 6, 0.08, s.d + 0.3), M(k % 2 ? "awnB" : "awnA"), -s.w / 2 + (k + 0.5) * (s.w / 6), 1.9, 0));
    for (let k = 0; k < 7; k++) {
      const f = mesh(new THREE.IcosahedronGeometry(0.09, 0), M(["fruitA", "fruitB", "fruitC"][(k + si) % 3]), -0.6 + 0.2 * k, 0.88, s.d / 2 - 0.2);
      g.add(f);
    }
  }
}

function buildTree(scene, M, L) {
  const T = L.tree, g = new THREE.Group(); g.position.set(T.x, 0, T.z); scene.add(g);
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6); trunk.translate(0, 1.1, 0); g.add(mesh(trunk, M("trunk")));
  const branches = [];
  for (const [a, r, y] of [[0.6, 0.9, 1.7], [-0.7, 1.0, 1.9], [2.4, 0.8, 2.1], [-2.2, 0.7, 2.0]]) {
    const b = new THREE.CylinderGeometry(0.05, 0.08, r, 5); b.translate(0, r / 2, 0);
    const m = mesh(b, M("trunk"), 0, y, 0); m.rotation.set(0.9 * Math.cos(a), a, 0.9 * Math.sin(a)); m.rotation.order = "YXZ"; g.add(m); branches.push(m);
  }
  const crown = new THREE.Group(); crown.position.y = 2.6; g.add(crown);
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = i === 0 ? 0 : 0.75 + 0.2 * hash(i);
    const m = mesh(new THREE.IcosahedronGeometry(0.62 + 0.25 * hash(i + 5), 0), M(i % 3 ? "leaf" : "leaf2"), Math.cos(a) * r, (i === 0 ? 0.5 : 0.1) + 0.3 * hash(i + 2), Math.sin(a) * r * 0.8);
    m.rotation.set(hash(i) * 3, hash(i + 1) * 3, 0); crown.add(m); blobs.push(m);
  }
  return { crown, blobs, top: [T.x, 3.3, T.z] };
}
function buildField(scene, M, L) {
  const F = L.field, nx = 34, nz = 22, n = nx * nz;
  scene.add(mesh(new THREE.PlaneGeometry(F.x1 - F.x0, F.z1 - F.z0).rotateX(-Math.PI / 2), M("soil"), (F.x0 + F.x1) / 2, 0.01, (F.z0 + F.z1) / 2, false));
  const geo = Box(0.05, F.h, 0.05), inst = new THREE.InstancedMesh(geo, M("wheat"), n);
  inst.castShadow = inst.receiveShadow = true;
  const pos = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const k = i * nz + j;
    pos.push([F.x0 + (i + 0.5 + 0.6 * (hash(k) - 0.5)) * ((F.x1 - F.x0) / nx), F.z0 + (j + 0.5 + 0.6 * (hash(k + 999) - 0.5)) * ((F.z1 - F.z0) / nz), 0.85 + 0.3 * hash(k + 77)]);
  }
  const o = new THREE.Object3D();
  function update(t, wind, height) {
    pos.forEach(([x, z, s], k) => {
      o.position.set(x, 0.01, z); o.rotation.set(0.05 * Math.sin(k), 0, 0.35 * wind(x, t) * (0.8 + 0.4 * hash(k + 5)) + 0.04);
      o.scale.set(1, s * height, 1); o.updateMatrix(); inst.setMatrixAt(k, o.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
  }
  scene.add(inst);
  return { update };
}
// 季节性飘落物：落英（春）、落叶（秋）、雪（冬）。位置是 t 的函数
function buildFallers(scene, M, n, size, matName) {
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size * 0.4, size), M(matName), n);
  inst.castShadow = false; scene.add(inst);
  const o = new THREE.Object3D();
  function update(t, amt, box, vy, drift) {
    for (let k = 0; k < n; k++) {
      const on = hash(k + 3.3) < amt, hgt = box.y1 - box.y0, ph = hash(k + 7.7) * hgt;
      const fall = (ph + vy * t) % hgt, y = box.y1 - fall;
      const x = box.x0 + ((hash(k) * (box.x1 - box.x0) + drift * t + 0.3 * Math.sin(1.3 * t + k)) % (box.x1 - box.x0) + (box.x1 - box.x0)) % (box.x1 - box.x0);
      o.position.set(x, y, box.z0 + hash(k + 1.1) * (box.z1 - box.z0));
      o.rotation.set(t * (1 + hash(k)) + k, t * 0.7 + k, 0);
      o.scale.setScalar(on ? 1 : 0); o.updateMatrix(); inst.setMatrixAt(k, o.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }
  return { update };
}

function buildKite(M) {
  const g = new THREE.Group(), s = 0.42;
  const tri = (pts, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  const side = (mat) => { const m = mat.clone(); m.side = THREE.DoubleSide; return m; };
  g.add(tri([[0, s, 0], [-s * 0.7, 0, 0], [0, -s * 1.3, 0], [0, s, 0], [0, -s * 1.3, 0], [s * 0.7, 0, 0]].slice(0, 3), side(M("kiteA"))));
  g.add(tri([[0, s, 0], [0, -s * 1.3, 0], [s * 0.7, 0, 0]], side(M("kiteB"))));
  const tail = [];
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02), M("ribbon")); b.castShadow = true; g.add(b); tail.push(b); }
  g.traverse((o) => { if (o.isMesh) o.userData.mask = 3; });
  return { g, tail, s };
}
function buildButterfly(M) {
  const g = new THREE.Group(), wings = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); g.add(p);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.1), M("bflyA")); m.position.x = sx * 0.06; p.add(m); wings.push([p, sx]);
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.1), M("bflyB")));
  return { g, wings };
}
function buildSnowman(M, L) {
  const S = L.snowman, mat = M("snow");
  const body = mesh(new THREE.IcosahedronGeometry(1, 1), mat), head = mesh(new THREE.IcosahedronGeometry(1, 1), mat);
  const nose = mesh(new THREE.ConeGeometry(0.035, 0.16, 5).rotateX(Math.PI / 2), M("carrot"));
  const eyes = [0, 1].map(() => mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), M("shoe")));
  return { body, head, nose, eyes, S };
}
function buildCloud(M, i) {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) g.add(mesh(Box(1.0 + 0.8 * hash(i * 7 + k), 0.5 + 0.3 * hash(i * 3 + k), 0.8), M("cloud"), (k - 1.5) * 0.7, 0.15 * hash(k + i), 0, false));
  return g;
}

export function buildWorld(P, D) {
  const scene = new THREE.Scene(), L = D.lay, { M, mats, update: updateMats } = makeMaterials();
  M("snow").userData.snowy = false;
  buildStatic(scene, M, L);
  const tree = buildTree(scene, M, L), field = buildField(scene, M, L);
  const petals = buildFallers(scene, M, 70, 0.07, "leaf2"), leaves = buildFallers(scene, M, 70, 0.09, "leaf"), snow = buildFallers(scene, M, 900, 0.045, "snow");
  const hero = makeHuman(M, { skin: "skin", hair: "hairA", top: "red", bottom: "jeans", shoe: "shoe" }, { tag: 1 });
  const girl = makeHuman(M, { skin: "skin", hair: "hairB", top: "teal", bottom: "teal", shoe: "shoe" }, { tag: 3, dress: true, s: 0.94, longHair: true });
  const cat = makeCat(M, { fur: "catFur", light: "catLight" });
  const crowd = D.crowd.map((c, i) => {
    const [top, bottom] = CROWD_COLORS[c.c];
    const h = makeHuman(M, { skin: "skin", hair: i % 2 ? "hairA" : "hairB", top, bottom, shoe: "shoe" }, { s: 1.12 + 0.08 * hash(i), dress: i % 3 === 1 });
    scene.add(h.root); return h;
  });
  scene.add(hero.root, girl.root, cat.root);
  const kite = buildKite(M); scene.add(kite.g);
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1, 0.018).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: "#f6f2ea" }));
  string.userData.mask = 3; scene.add(string);
  const bfly = buildButterfly(M); scene.add(bfly.g);
  const sm = buildSnowman(M, L); scene.add(sm.body, sm.head, sm.nose, ...sm.eyes);
  const clouds = [0, 1, 2, 3, 4].map((i) => { const c = buildCloud(M, i); scene.add(c); return c; });
  const amb = new THREE.AmbientLight("#ffffff", Math.PI), sunL = new THREE.DirectionalLight("#ffffff", 0);
  sunL.castShadow = true; sunL.shadow.mapSize.set(4096, 4096); sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.02;
  Object.assign(sunL.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 0.5, far: 80 });
  scene.add(amb, sunL, sunL.target);
  scene.fog = new THREE.Fog("#ffffff", 200, 300);
  scene.traverse((o) => { o.frustumCulled = false; });
  return { scene, mats, M, updateMats, tree, field, petals, leaves, snow, hero, girl, cat, crowd, kite, string, bfly, sm, clouds, amb, sunL };
}

// ---- 姿态：动作权重 → 关节角 ----
const ARM0 = [0.05, 0.02, 0.15];
const mixArm = (base, w, tgt) => base.map((v, i) => lerp(v, tgt[i], w));
function humanPose(P, who, t, D) {
  const p = P.at(who, t), a = (n) => P.act(who, n, t), str = D.stride[who];
  const walk = Math.min(1, p.v / 1.0);
  const Q = { phase: (Math.PI * p.dist) / (str / 2) + Math.PI / 2, walk, crouch: a("crouch"), sit: a("sit"), lean: 0, hop: 0, blink: 0 };
  let L = ARM0, R = ARM0;
  const pat = Math.sin(2 * Math.PI * 2.2 * t);
  R = mixArm(R, a("pet"), [0.95, 0.05, 0.25 + 0.25 * pat]);
  L = mixArm(L, a("hold"), [0.95, 0.12, 0.7]); R = mixArm(R, a("hold"), [0.95, 0.12, 0.7]);
  L = mixArm(L, a("raise"), [2.9, 0.12, 0.1]); R = mixArm(R, a("raise"), [2.9, 0.12, 0.1]);
  const ch = a("cheer"); L = mixArm(L, ch, [2.7, 0.45, 0.2]); R = mixArm(R, ch, [2.7, 0.45, 0.2]);
  Q.hop += 0.1 * Math.abs(Math.sin(2 * Math.PI * 1.6 * t)) * ch;
  const sh = a("shape"), pat2 = Math.sin(2 * Math.PI * 3 * t);
  L = mixArm(L, sh, [0.75, 0.0, 1.0 + 0.25 * pat2]); R = mixArm(R, sh, [0.75, 0.0, 1.0 - 0.25 * pat2]);
  L = mixArm(L, a("lift"), [2.1, 0.06, 0.35]); R = mixArm(R, a("lift"), [2.1, 0.06, 0.35]);
  R = mixArm(R, a("wave"), [2.6, 0.55, 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.2 * t)]);
  R = mixArm(R, a("string"), [1.35, 0.1, 0.2]);
  const rl = a("reel"); R = mixArm(R, rl, [1.0, 0.1, 0.6 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t)]); L = mixArm(L, rl, [0.9, 0.0, 0.5]);
  const pu = a("push"); L = mixArm(L, pu, [1.3, 0.0, 0.4]); R = mixArm(R, pu, [1.3, 0.0, 0.4]); Q.lean += 0.25 * pu;
  R = mixArm(R, a("poke"), [1.5, 0.0, 0.05]);
  const holdG = who === "girl" ? a("hold") : 0; if (holdG) R = mixArm(R, holdG, [0.45, 0.08, 0.55]);
  Q.armL = L; Q.armR = R;
  Q.head = [-0.5 * a("lookUp") + 0.45 * a("lookDown") + 0.5 * a("sad") + 0.2 * Q.crouch, 0];
  const bu = P.actU(who, "blink", t);
  Q.blink = bu < 0 ? 0 : Math.max(0, 1 - Math.abs(bu * 2 % 1 - 0.5) * 5) * 1;
  return { p, Q };
}
function catPose(P, t, D) {
  const p = P.at("cat", t), a = (n) => P.act("cat", n, t);
  const Q = { phase: (Math.PI * p.dist) / (D.stride.cat / 2) + Math.PI / 2, walk: Math.min(1, p.v / 0.8), curl: a("curl"), sit: a("sit"), lie: a("lie"),
    stretch: a("stretch"), ear: Math.sin(2 * Math.PI * 7 * t) * a("ear"), roll: 0.18 * Math.sin(2 * Math.PI * 1.1 * t) * a("rub"), hop: 0, blink: 0 };
  const pu = P.actU("cat", "pounce", t);
  if (pu >= 0) Q.hop = 0.45 * Math.sin(Math.PI * pu);
  Q.head = [0.55 * a("headDown") - 0.55 * a("meow") - 0.35 * P.act("hero", "lookUp", t) * (1 - a("curl")), 0];
  Q.blink = a("curl") > 0.5 ? 1 : 0;
  return { p, Q };
}

function catY(P, D, t) {
  const tr = D.track.cat;
  for (let i = 1; i < tr.length; i++) {
    if (t >= tr[i][0]) continue;
    const s0 = P.surface(tr[i - 1][1], tr[i - 1][2]), s1 = P.surface(tr[i][1], tr[i][2]), u = clamp01((t - tr[i - 1][0]) / (tr[i][0] - tr[i - 1][0]));
    return Math.abs(s1 - s0) > 0.1 ? lerp(s0, s1, u) + 0.22 * Math.sin(Math.PI * u) : s0;
  }
  const l = tr[tr.length - 1]; return P.surface(l[1], l[2]);
}
const V = () => new THREE.Vector3();
const leafAmt = (s) => (s < 2.55 ? 1 : s < 3 ? 1 - (s - 2.55) / 0.45 : s < 3.4 ? 0 : Math.min(1, (s - 3.4) / 0.5));

export function updateWorld(Wd, P, D, t) {
  const B = D.beats, L = D.lay, s = P.season(t), sc = P.snowCover(t), lit = P.lit(t), sun = P.sun(t);
  Wd.updateMats(s, sc);
  // 天色：季节色，黄昏偏橙紫
  const sky = seasonColor("sky", s).lerp(new THREE.Color("#f0a27a"), 0.55 * sun.dusk);
  Wd.scene.background = sky;
  Wd.scene.fog.color.copy(sky);
  const fg = P.fog(t); Wd.scene.fog.near = lerp(200, 9, fg); Wd.scene.fog.far = lerp(300, 34, fg);
  // 光：未打开时环境光 π（材质色原样输出）；打开后方向光 + 阴影
  Wd.amb.intensity = Math.PI * lerp(1, lerp(0.55, 0.72, P.snowCover(t)), lit);
  Wd.sunL.intensity = Math.PI * lit * lerp(0.62, 0.45, sc) * (1 - 0.35 * sun.dusk);
  Wd.sunL.color.set("#fff6e6").lerp(new THREE.Color("#ff9a5a"), sun.dusk);
  Wd.sunL.position.set(sun.dir[0] * 40, sun.dir[1] * 40, sun.dir[2] * 40); Wd.sunL.target.position.set(0, 0, -1);
  Wd.sunL.castShadow = lit > 0.001;
  // 树、麦田、飘落物、云
  const la = leafAmt(s);
  Wd.tree.blobs.forEach((b, i) => b.scale.setScalar(Math.max(0.001, la * (0.85 + 0.15 * Math.sin(0.8 * t + i)))));
  Wd.field.update(t, P.wind, s < 2.6 ? 1 : s < 3.4 ? lerp(1, 0.3, (s - 2.6) / 0.8) : lerp(0.3, 1, Math.min(1, (s - 3.4) / 0.6)));
  const T0 = L.tree, crownBox = { x0: T0.x - 2.6, x1: T0.x + 1.4, y0: 0, y1: 3.2, z0: T0.z - 1, z1: T0.z + 1.6 };
  Wd.petals.update(t, 0.6 * seg(t, B.s1a - 4, B.s1a, E.lin) * (1 - seg(t, B.s1b, B.s1b + 1.5, E.lin)), crownBox, 0.45, -0.3);
  Wd.leaves.update(t, 0.7 * seg(t, B.s2a, B.s2b, E.lin) * (1 - seg(t, B.s3a, B.s3b, E.lin)), crownBox, 0.6, -0.4);
  const c = P.cam(t), snowBox = { x0: c.T[0] - 9, x1: c.T[0] + 9, y0: -0.2, y1: 7, z0: c.T[2] - 7, z1: c.T[2] + 5 };
  Wd.snow.update(t, P.snowFall(t), snowBox, 0.7, -0.35);
  Wd.clouds.forEach((g, i) => { const x = ((((8 + 5 * i - 24 / 81.4 * t) % 24) + 24) % 24) - 12; g.position.set(x * 1.6, 5.4 + 1.3 * hash(i + 2), -15 - 2 * hash(i)); });
  return { s, sc, lit, sun };
}

export function updateActors(Wd, P, D, t) {
  const B = D.beats, L = D.lay, sc = P.snowCover(t);
  for (const who of ["hero", "girl"]) {
    const h = Wd[who], { p, Q } = humanPose(P, who, t, D);
    h.root.position.set(p.x, 0, p.z); h.root.rotation.y = P.yaw(who, t); h.set(Q);
  }
  const { p: cp, Q: cq } = catPose(P, t, D);
  Wd.cat.root.position.set(cp.x, catY(P, D, t), cp.z); Wd.cat.root.rotation.y = P.yaw("cat", t); Wd.cat.set(cq, t);
  // 群众：入冬向右离场，开春走回
  const away = 7 * seg(t, B.s3a, B.s3b) * (1 - seg(t, B.melt0, B.melt1));
  const moving = (t > B.s3a && t < B.s3b) || (t > B.melt0 && t < B.melt1);
  Wd.crowd.forEach((h, i) => {
    const c = D.crowd[i], x = c.x + away;
    h.root.position.set(x, 0, c.z); h.root.visible = away < 6.95;
    const leaving = t < B.melt0;
    h.root.rotation.y = moving ? (leaving ? Math.PI / 2 : -Math.PI / 2) : (c.yaw * Math.PI) / 180;
    h.set({ phase: x * 6, walk: moving ? 1 : 0, crouch: 0, sit: 0, lean: 0, hop: 0, blink: 0,
      armL: [0.05 + (i < 2 ? 0.5 + 0.3 * Math.sin(1.7 * t + i) : 0), 0.02, 0.4], armR: [0.05 + 0.15 * Math.sin(1.1 * t + i * 2), 0.02, 0.3],
      head: [0.1 * Math.sin(0.7 * t + i), 0.5 * Math.sin(0.43 * t + i * 1.7)] });
  });
  for (const o of [Wd.hero.root, Wd.girl.root, Wd.cat.root, ...Wd.crowd.map((h) => h.root)]) o.updateMatrixWorld(true);
  const hand = (h, side) => h.hand[side].getWorldPosition(new THREE.Vector3());
  const gH = hand(Wd.girl, "R"), hL = hand(Wd.hero, "L"), hR = hand(Wd.hero, "R"), hM = hL.clone().add(hR).multiplyScalar(0.5);
  // 风筝
  const k = P.kite(t, [gH.x, gH.y, gH.z]), K = Wd.kite.g;
  let kp, tilt = 0, upright = true;
  if (k.mode === "hand") { kp = gH.clone().add(new THREE.Vector3(0, 0.12, 0.06)); tilt = 0.25; }
  else if (k.mode === "hero") kp = hM.clone().add(new THREE.Vector3(0, 0.3, 0));
  else if (k.mode === "back") { kp = Wd.girl.back.localToWorld(new THREE.Vector3(0, 0.25, -0.14)); upright = true; }
  else { kp = new THREE.Vector3(...k.p); tilt = k.tilt || 0; if (k.mode === "sky" && k.lift < 1) kp.lerp(hM.clone().add(new THREE.Vector3(0, 0.3, 0)), 1 - k.lift); }
  K.position.copy(kp); K.rotation.set(k.mode === "fall" ? -tilt : 0, k.mode === "back" ? P.yaw("girl", t) : 0, k.mode === "fall" ? 0 : tilt);
  K.scale.setScalar(k.mode === "back" || k.mode === "hand" ? 0.75 : 1);
  if (upright && k.mode === "fall" && tilt > 1.4) K.rotation.x = -Math.PI / 2;
  Wd.kite.tail.forEach((r, i) => r.position.set(0.12 * (i + 1) + 0.05 * Math.sin(6 * t + i), -Wd.kite.s * 1.3 - 0.12 * i, 0));
  const strOn = ["tow", "fall", "hero", "sky", "reel"].includes(k.mode);
  Wd.string.visible = strOn;
  if (strOn) {
    const end = kp.clone().add(new THREE.Vector3(0, -0.15, 0)), d = end.clone().sub(gH);
    Wd.string.position.copy(gH); Wd.string.scale.set(1, d.length(), 1);
    Wd.string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  // 蝴蝶
  const bf = P.butterfly(t);
  Wd.bfly.g.visible = !(t > 21.5 && t < B.melt0);
  Wd.bfly.g.position.set(...bf.p); Wd.bfly.g.rotation.y = bf.heading > 0 ? Math.PI / 2 : -Math.PI / 2;
  Wd.bfly.wings.forEach(([w, sx]) => { w.rotation.z = sx * (0.2 + 0.9 * (0.5 + 0.5 * bf.flap)); });
  updateSnowman(Wd, P, D, t, sc, hM);
}

function updateSnowman(Wd, P, D, t, sc, hM) {
  const B = D.beats, S = D.lay.snowman, { body, head, nose, eyes } = Wd.sm;
  const melt = 1 - seg(t, B.melt0, B.melt1 - 0.6);
  // 身子：女孩推着越滚越大
  const ru = seg(t, B.roll0, B.roll1, E.lin), g = P.at("girl", Math.min(t, B.roll1));
  const r = t < B.roll0 ? 0 : lerp(0.12, S.r, ru) * melt;
  const bx = t < B.roll1 ? g.x - (0.32 + lerp(0.12, S.r, ru)) : S.x;
  body.visible = t >= B.roll0 - 0.3 && r > 0.005;
  body.position.set(bx, r * 0.9, S.z); body.scale.set(r, r * 0.9, r);
  const b0 = D.lay.ball0;
  body.rotation.z = t < B.roll1 ? (b0 - bx) / Math.max(0.12, r) : (b0 - S.x) / S.r;
  // 头：男孩在手里团出来，举到身子上
  const hu = seg(t, B.shape0, B.shape1, E.lin), rh = lerp(0.05, S.rh, hu) * melt, top = new THREE.Vector3(S.x, 2 * 0.9 * S.r * melt + 0.85 * rh, S.z);
  head.visible = t >= B.shape0 && rh > 0.005;
  const lu = seg(t, B.lift0, B.lift1);
  const hp = t < B.lift0 ? hM.clone().add(new THREE.Vector3(0, -0.02, 0)) : hM.clone().lerp(top, lu).add(new THREE.Vector3(0, 0.35 * Math.sin(Math.PI * lu), 0));
  head.position.copy(t < B.lift1 ? hp : top); head.scale.setScalar(rh);
  // 眼与鼻：头放稳后出现；鼻子由女孩按上
  const face = t >= B.lift1 && melt > 0.05;
  eyes.forEach((e, i) => { e.visible = face; e.position.set(S.x + (i ? 0.07 : -0.07) * melt, top.y + 0.05 * melt, S.z + rh * 0.95); });
  nose.visible = face && t >= B.poke0 + 0.3;
  nose.position.set(S.x, top.y, S.z + rh + 0.06 * melt); nose.scale.setScalar(Math.max(0.001, melt));
  body.visible = body.visible && melt > 0.01; head.visible = head.visible && melt > 0.01;
}
