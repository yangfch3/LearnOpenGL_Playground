// N2 低多边形小岛：只建模，不含动画。导出 build(D) → 场景与需要逐帧驱动的对象
import * as THREE from "three";
import { M, mesh, jitter, mulberry32 } from "./assets/shared/js/lowpoly.js";
export { M, mesh, jitter, mulberry32 };
// 沿折线的平面带（河、路）
const strip = (pts, width, y) => {
  const pos = [], idx = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(i - 1, 0)], c = pts[Math.min(i + 1, pts.length - 1)];
    const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
    pos.push(p[0] + nx * width / 2, y, p[1] + nz * width / 2, p[0] - nx * width / 2, y, p[1] - nz * width / 2);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const smooth = (pts, n = 8) => {  // Catmull-Rom 加密
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return c.getPoints(pts.length * n).map((v) => [v.x, v.z]);
};

export function build(D) {
  const L = D.lay, rnd = mulberry32(7);
  const scene = new THREE.Scene();
  const W = { scene, mats: {}, snowCaps: [], windows: [], doors: {}, leaves: [], buds: [], wheat: null, hay: [], clouds: [] };
  const mats = W.mats;
  mats.grass = M(0x8ccb7a); mats.rock = M(0x8a7f74); mats.rockDark = M(0x6b625a); mats.water = M(0x6fb3d6, { roughness: 0.4 });
  mats.road = M(0xe2cfa6); mats.snow = M(0xf4f7fa); mats.wood = M(0x9a6b45); mats.woodDark = M(0x6e4a30);
  mats.leaf = M(0xf4b6c8); mats.pine = M(0x4f8a5c); mats.field = M(0x9bd27a); mats.cloud = M(0xffffff, { roughness: 1 });
  mats.window = M(0x2a3a52, { emissive: 0xffc46b, emissiveIntensity: 0 });

  // 岛体：草地顶面 + 倒锥岩体
  const top = jitter(new THREE.CylinderGeometry(L.radius, L.radius - 0.6, 1.2, 40, 1), 0.25, rnd);
  W.ground = mesh(top, mats.grass, scene, [0, -0.6, 0], false);
  // 岩体顶圈埋进草地层（y −0.9），顶圈不抖动，避免与草地层之间露缝
  const under = new THREE.ConeGeometry(L.radius - 0.7, 10, 24, 3);
  under.rotateX(Math.PI);
  jitter(under, 1.4, rnd, (x, y) => y > 4.4);
  mesh(under, mats.rock, scene, [0, -5.9, 0], false);
  for (let k = 0; k < 9; k++) {  // 岩体碎块
    const a = rnd() * 6.28, r = 3 + rnd() * 7;
    mesh(jitter(new THREE.DodecahedronGeometry(0.8 + rnd() * 1.2, 0), 0.4, rnd), mats.rockDark, scene, [r * Math.cos(a), -4 - rnd() * 5, r * Math.sin(a)], false);
  }
  mesh(strip(smooth(L.river), 2.0, 0.03), mats.water, scene, [0, 0, 0], false).castShadow = false;
  mesh(strip(smooth(D.road), 1.3, 0.025), mats.road, scene, [0, 0, 0], false).castShadow = false;

  // 云海：环绕岛下方，整体缓慢转动
  W.cloudRing = new THREE.Group(); scene.add(W.cloudRing);
  for (let k = 0; k < 70; k++) {
    const a = rnd() * 6.28, r = 16 + rnd() * 30, g = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = 1.4 + rnd() * 2.4;
      mesh(new THREE.IcosahedronGeometry(s, 0), mats.cloud, g, [(j - 1.5) * s * 0.9, rnd() * 0.8, rnd() * 1.5], false).castShadow = false;
    }
    g.position.set(r * Math.cos(a), -3.5 - rnd() * 4, r * Math.sin(a));
    g.rotation.y = rnd() * 6;
    W.cloudRing.add(g);
  }
  return W;
}
