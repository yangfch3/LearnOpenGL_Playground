// N2 建筑与道具建模；雪顶、窗户登记到 W，供季节与昼夜驱动
import * as THREE from "three";
import { M, mesh } from "./world.js";

const roofGeo = (w, d, h) => {  // 双坡屋顶
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
};

export function house(W, x, z, rot, o = {}) {
  const g = new THREE.Group(), w = o.w ?? 2.4, d = o.d ?? 2.2, h = o.h ?? 1.9;
  g.position.set(x, 0, z); g.rotation.y = rot;
  mesh(new THREE.BoxGeometry(w, h, d), M(o.wall ?? 0xf3e6d0), g, [0, h / 2, 0]);
  const roofMat = M(o.roof ?? 0xc8664f);
  mesh(roofGeo(w + 0.4, d + 0.3, 1.1), roofMat, g, [0, h, 0]);
  const cap = mesh(roofGeo(w + 0.5, d + 0.36, 1.16), W.mats.snow, g, [0, h + 0.04, 0], false);
  cap.visible = false; W.snowCaps.push(cap);
  const hinge = new THREE.Group(); hinge.position.set(w * 0.22 - 0.3, 0, d / 2 + 0.02); g.add(hinge);
  mesh(new THREE.BoxGeometry(0.6, 1.1, 0.06), W.mats.woodDark, hinge, [0.3, 0.55, 0]);
  if (o.name) W.doors[o.name] = hinge;
  for (const wx of [-w * 0.22]) {
    const win = mesh(new THREE.BoxGeometry(0.62, 0.55, 0.06), W.mats.window, g, [wx, h * 0.58, d / 2 + 0.02], false);
    W.windows.push(win);
  }
  mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), M(0x8a7f74), g, [w * 0.25, h + 0.8, -d * 0.15]);
  W.scene.add(g);
  return g;
}

export function buildings(W, D) {
  const L = D.lay;
  // 女孩家：门朝 +z，窗户位置与 2D 室内的窗对上
  const G = L.girlHouse, gh = house(W, G.x, G.z, G.rot, { name: "girl", w: G.w, d: G.d, h: G.h, wall: 0xfbefd9, roof: 0x5f86b8 });
  W.girlHouse = gh;
  house(W, L.bakery.x, L.bakery.z, L.bakery.rot, { w: L.bakery.w, d: L.bakery.d, h: L.bakery.h, wall: 0xf6d9b4, roof: 0xb45a46 });
  L.houses.forEach(([x, z, r], k) => house(W, x, z, r, { wall: [0xf3e6d0, 0xe9eef2, 0xf6e3c6, 0xeadfcf, 0xf0e2e0][k], roof: [0xc8664f, 0x6f9a72, 0xd99a4e, 0x8d6fa8, 0xc8664f][k] }));
  // 钟楼
  const [tx, tz] = L.tower, tw = new THREE.Group();
  tw.position.set(tx, 0, tz); W.scene.add(tw);
  mesh(new THREE.BoxGeometry(1.8, 6, 1.8), M(0xe9dcc4), tw, [0, 3, 0]);
  mesh(new THREE.ConeGeometry(1.6, 2.2, 4), M(0x5f86b8), tw, [0, 7.1, 0]).rotation.y = Math.PI / 4;
  const tcap = mesh(new THREE.ConeGeometry(1.66, 2.26, 4), W.mats.snow, tw, [0, 7.13, 0], false);
  tcap.rotation.y = Math.PI / 4; tcap.visible = false; W.snowCaps.push(tcap);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 20), M(0xfaf6ee), tw, [0, 4.9, 0.92]).rotation.x = Math.PI / 2;
  W.hand = mesh(new THREE.BoxGeometry(0.06, 0.45, 0.04), M(0x333333), tw, [0, 4.9, 0.98], false);
  W.hand.geometry.translate(0, 0.2, 0);
  W.bell = mesh(new THREE.ConeGeometry(0.35, 0.5, 10, 1, true), M(0xd6a94a, { metalness: 0.5, roughness: 0.4 }), tw, [0, 5.9, 0]);
  // 灯塔：灯室发光，扫光用一束半透明锥
  const [lx, lz] = L.lighthouse, lh = new THREE.Group();
  lh.position.set(lx, 0, lz); W.scene.add(lh);
  for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(0.62 - k * 0.07, 0.69 - k * 0.07, 1.2, 12), M(k % 2 ? 0xc8564a : 0xf5f1ea), lh, [0, 0.6 + k * 1.2, 0]);
  W.lamp = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 12), M(0xfff3c4, { emissive: 0xffd77a, emissiveIntensity: 0.2 }), lh, [0, 5.1, 0], false);
  mesh(new THREE.ConeGeometry(0.6, 0.6, 12), M(0xc8564a), lh, [0, 5.7, 0]);
  const beamGeo = new THREE.ConeGeometry(1.6, 12, 16, 1, true);
  beamGeo.translate(0, -6, 0); beamGeo.rotateZ(Math.PI / 2);
  W.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffe8a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  W.beam.position.set(lx, 5.1, lz); W.scene.add(W.beam);
  W.lampLight = new THREE.PointLight(0xffd77a, 0, 18, 1.6); W.lampLight.position.set(lx, 5.1, lz); W.scene.add(W.lampLight);
}

export function streetProps(W, D) {
  const L = D.lay;
  // 邮筒
  const mb = new THREE.Group();
  mb.position.set(L.mailbox[0], 0, L.mailbox[1]); W.scene.add(mb);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), M(0x4a4a4a), mb, [0, 0.45, 0]);
  mesh(new THREE.BoxGeometry(0.5, 0.55, 0.42), M(0x2f8a5b), mb, [0, 1.15, 0]);
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 12, 1, false, 0, Math.PI), M(0x2f8a5b), mb, [0, 1.42, 0]).rotation.set(0, 0, Math.PI / 2);
  W.mailFlag = mesh(new THREE.BoxGeometry(0.04, 0.22, 0.1), M(0xd8443a), mb, [0.27, 1.2, 0]);
  // 码头：栈桥 + 木桩
  const [dx, dz] = L.dock;
  const [dw, dd] = L.dockSize;
  mesh(new THREE.BoxGeometry(dw, 0.1, dd), W.mats.wood, W.scene, [dx, -0.03, dz]);
  for (const sx of [-dw / 2 + 0.2, 0, dw / 2 - 0.2]) for (const sz of [-dd / 2 + 0.1, dd / 2 - 0.1]) mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), W.mats.woodDark, W.scene, [dx + sx, -0.5, dz + sz]);
  // 石拱桥
  const [bx, bz] = L.bridge, br = new THREE.Group();
  br.position.set(bx, 0, bz); W.scene.add(br);
  const arch = new THREE.TorusGeometry(1.3, 0.28, 6, 14, Math.PI);
  mesh(arch, M(0xcfc3b0), br, [0, -0.6, 0]).rotation.y = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.9, 0.12, 3.0), M(0xcfc3b0), br, [0, 0.62, 0]);
  W.bridgeTop = 0.68;
  // 集市摊位：彩色遮篷，夏天出现
  W.stalls = new THREE.Group(); W.scene.add(W.stalls);
  const cols = [0xe86f5a, 0x6aa9d8, 0xf2c14e, 0x8cc084];
  L.stalls.forEach(([x, z, rot], k) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rot; W.stalls.add(s);
    mesh(new THREE.BoxGeometry(1.2, 0.7, 0.6), W.mats.wood, s, [0, 0.35, 0]);
    for (const px of [-0.55, 0.55]) mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), W.mats.woodDark, s, [px, 0.75, -0.25]);
    mesh(new THREE.BoxGeometry(1.4, 0.06, 0.9), M(cols[k]), s, [0, 1.5, 0]).rotation.x = 0.25;
    for (let j = 0; j < 4; j++) mesh(new THREE.IcosahedronGeometry(0.1, 0), M([0xff8a5b, 0xffd35b, 0xb4e06b, 0xe85a6a][(j + k) % 4]), s, [-0.4 + j * 0.27, 0.76, 0.05]);
  });
}

export function plants(W, D, rnd) {
  const L = D.lay;
  // 大树：枝从树干顶部伸出；叶簇挂在枝末端与中段，新芽沿枝分布（不悬空）
  const [tx, tz] = L.tree, tree = new THREE.Group();
  tree.position.set(tx, 0, tz); W.scene.add(tree); W.tree = tree;
  mesh(new THREE.CylinderGeometry(0.28, 0.42, 3.4, 7), W.mats.woodDark, tree, [0, 1.7, 0]);
  const up = new THREE.Vector3(0, 1, 0), tips = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.28 + 0.3 * rnd(), tilt = 0.55 + 0.35 * rnd(), len = 1.5 + 0.5 * rnd();
    const base = new THREE.Vector3(0, 2.8 + 0.12 * k, 0);
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
    const geo = new THREE.CylinderGeometry(0.05, 0.13, len, 5);
    geo.translate(0, len / 2, 0);
    const br = mesh(geo, W.mats.woodDark, tree, base.toArray());
    br.quaternion.setFromUnitVectors(up, dir);
    tips.push({ base, dir, len });
  }
  tips.forEach(({ base, dir, len }) => {
    for (const u of [1.0, 0.6]) {
      const c = base.clone().addScaledVector(dir, len * u);
      const lf = mesh(new THREE.IcosahedronGeometry(u === 1 ? 0.85 : 0.6, 0), W.mats.leaf, tree, [c.x, c.y + 0.15, c.z]);
      lf.userData = { s: 1, k: rnd() };
      W.leaves.push(lf);
    }
    for (let j = 0; j < 3; j++) {
      const c = base.clone().addScaledVector(dir, len * (0.55 + 0.22 * j));
      const bud = mesh(new THREE.IcosahedronGeometry(0.16, 0), M(0xa6e06b), tree, [c.x, c.y + 0.06, c.z], false);
      bud.scale.setScalar(0.001); bud.userData.k = rnd(); W.buds.push(bud);
    }
  });
  // 松树：位置来自 build.py（已避开建筑、路、河与镜头）；冬天积雪
  W.pines = [];
  for (const [x, z, s] of D.pines) {
    const p = new THREE.Group();
    p.position.set(x, 0, z); p.scale.setScalar(s); W.scene.add(p);
    mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.6, 5), W.mats.woodDark, p, [0, 0.3, 0]);
    for (let j = 0; j < 3; j++) {
      mesh(new THREE.ConeGeometry(0.9 - j * 0.22, 1.0, 7), W.mats.pine, p, [0, 0.9 + j * 0.55, 0]);
      const c = mesh(new THREE.ConeGeometry(0.62 - j * 0.16, 0.42, 7), W.mats.snow, p, [0, 1.25 + j * 0.55, 0], false);
      c.visible = false; W.snowCaps.push(c);
    }
    W.pines.push(p);
  }
}

export function fields(W, D, rnd) {
  const L = D.lay, [fx, fz] = L.field;
  // 麦田：实例化麦秆，颜色与高度随季节变；秋末收割后出现草垛
  const n = 420, geo = new THREE.ConeGeometry(0.07, 0.8, 4);
  geo.translate(0, 0.4, 0);
  W.wheat = new THREE.InstancedMesh(geo, M(0xffffff), n);
  W.wheat.receiveShadow = true;
  W.wheatBase = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const x = fx + (rnd() - 0.5) * L.fieldSize[0], z = fz + (rnd() - 0.5) * L.fieldSize[1], s = 0.8 + rnd() * 0.5;
    W.wheatBase.push({ x, z, s, ph: rnd() * 6.28 });
    m.makeTranslation(x, 0, z); W.wheat.setMatrixAt(i, m);
  }
  W.scene.add(W.wheat);
  for (let k = 0; k < 4; k++) {
    const h = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 10), M(0xe2b65a), W.scene, [fx - 2.2 + k * 1.5, 0.35, fz + (k % 2 ? 0.8 : -0.6)]);
    h.rotation.z = Math.PI / 2; h.visible = false; W.hay.push(h);
  }
  // 春天的野花
  W.flowers = new THREE.Group(); W.scene.add(W.flowers);
  const fc = [0xffffff, 0xffd35b, 0xf4a6c0, 0xb7a6f4];
  for (let k = 0; k < 90; k++) {
    const a = rnd() * 6.28, r = 2 + rnd() * 11;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    if (Math.abs(z + 9.6) < 1.6) continue;
    mesh(new THREE.IcosahedronGeometry(0.09, 0), M(fc[k % 4]), W.flowers, [x, 0.08, z], false);
  }
  // 船
  const boat = new THREE.Group(); W.scene.add(boat); W.boat = boat;
  const hs = new THREE.Shape([new THREE.Vector2(-1.4, 0.4), new THREE.Vector2(1.6, 0.4), new THREE.Vector2(1.1, -0.2), new THREE.Vector2(-1.1, -0.2)]);
  const hull = new THREE.ExtrudeGeometry(hs, { depth: 1.0, bevelEnabled: false });
  hull.translate(0, 0, -0.5);
  mesh(hull, M(0x3e6fa3), boat, [0, 0, 0]);
  mesh(new THREE.BoxGeometry(1.0, 0.7, 0.8), M(0xf5f1ea), boat, [-0.3, 0.75, 0]);
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), M(0xc8564a), boat, [-0.3, 1.35, 0]);
  W.boatWin = mesh(new THREE.BoxGeometry(0.5, 0.25, 0.82), W.mats.window, boat, [-0.3, 0.85, 0], false);
}
