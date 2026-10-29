import * as THREE from "three";
import { LineSegments2 } from "./assets/shared/vendor/three/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "./assets/shared/vendor/three/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "./assets/shared/vendor/three/lines/LineMaterial.js";

// 场景 B 右侧三维阶段：顶点 → 虚拟摄像机拍摄（投影到成像平面）→ 观察镜头飞入摄像机，与平面阶段画面重合
const D = window.N1, B = D.beats, PW = D.panel.w, PH = D.panel.h, I = D.img;
const VIEW = 0x45c4e0, INK = 0xedf1f7, INK_DIM = 0x9aa6b8, NEAR = 0.8;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(PW, PH, false);
renderer.setClearColor(0x11161d, 1);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, PW / PH, 0.05, 100);

const clamp = (x) => Math.min(Math.max(x, 0), 1);
const io2 = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const backOut = (k) => 1 + 3 * (k - 1) ** 3 + 2 * (k - 1) ** 2;
const seg = (t, t0, d, e = io2) => e(clamp((t - t0) / d));

// 虚拟摄像机在原点朝 −z；成像平面 16:9，与平面阶段的 800×450 画面一一对应
const tv = Math.tan((D.fovV / 2) * Math.PI / 180), AS = 16 / 9;
const verts = D.verts.map(([gx, gy], k) => {
  const d = D.depth[k], nx = (gx / I.nx) * 2 - 1, ny = (gy / I.ny) * 2 - 1;
  return new THREE.Vector3(nx * tv * AS * d, ny * tv * d, -d);
});
const FOV_END = (2 * Math.atan((tv * PH) / I.h) * 180) / Math.PI;

const lineMat = (color, width) => new LineMaterial({ color, linewidth: width, worldUnits: false, transparent: true, alphaToCoverage: false, resolution: new THREE.Vector2(PW, PH) });
const lines = (pts, color, width) => {
  const l = new LineSegments2(new LineSegmentsGeometry().setPositions(pts.flat()), lineMat(color, width));
  scene.add(l);
  return l;
};
const ball = (p, r, color) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.copy(p);
  scene.add(m);
  return m;
};

const grid = new THREE.GridHelper(12, 24, 0x2e3947, 0x2e3947);
grid.position.y = -1.6;
grid.material.transparent = true;
scene.add(grid);
const vBalls = verts.map((v) => ball(v, 0.07, INK));
const nc = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [sx * tv * AS * NEAR, sy * tv * NEAR, -NEAR]);
const frustum = lines([...nc.flatMap((c) => [[0, 0, 0], c]), ...nc.flatMap((c, i) => [c, nc[(i + 1) % 4]])], VIEW, 3);
const bw = 0.16, bh = 0.12, bd = 0.24;  // 摄像机机身线框
const bc = [];
for (const x of [-bw, bw]) for (const y of [-bh, bh]) for (const z of [0.02, bd]) bc.push([x, y, z]);
const bodyPts = [];
for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([0, 1, 2].filter((a) => bc[i][a] !== bc[j][a]).length === 1) bodyPts.push(bc[i], bc[j]);
const body = lines(bodyPts, VIEW, 3);
const rays = verts.map(() => lines([[0, 0, 0], [0, 0, 0]], INK_DIM, 2));
const proj = verts.map((v) => ball(v.clone().multiplyScalar(NEAR / -v.z), 0.0104, INK));

const P0 = new THREE.Vector3(2.7, 1.5, 1.9), LOOK0 = new THREE.Vector3(-0.15, 0.1, -1.4);
const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
const tmp = new THREE.PerspectiveCamera();
const lookQ = (pos, at) => { tmp.position.copy(pos); tmp.lookAt(at); return tmp.quaternion.clone(); };
q1.identity();

function renderAt(t) {
  // 观察镜头：先缓慢环视，再飞入虚拟摄像机
  const drift = (seg(t, B.B, B.fly - B.B, (k) => k) - 0.5) * 10 * Math.PI / 180;
  const p0 = P0.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), drift);
  q0.copy(lookQ(p0, LOOK0));
  const k = seg(t, B.fly, B.flyEnd - B.fly);
  cam.position.lerpVectors(p0, new THREE.Vector3(0, 0, 0), k);
  cam.quaternion.slerpQuaternions(q0, q1, k);
  cam.fov = 50 + (FOV_END - 50) * k;
  cam.updateProjectionMatrix();

  vBalls.forEach((b, i) => {
    const s = seg(t, B.v1 + 0.3 * i, 0.3, backOut);
    b.scale.setScalar(Math.max(s, 1e-3));
    b.material.opacity = 1 - seg(t, B.flyEnd - 0.5, 0.5);
  });
  const camIn = seg(t, B.cam, 0.4), fade = 1 - seg(t, B.fly, (B.flyEnd - B.fly) * 0.7);
  frustum.material.opacity = camIn;
  body.material.opacity = camIn * fade;
  grid.material.opacity = fade;
  verts.forEach((v, i) => {
    const r = seg(t, B.rays + 0.2 * i, 0.5, (x) => x), end = v.clone().multiplyScalar(1 - r);
    rays[i].geometry.setPositions([v.x, v.y, v.z, end.x, end.y, end.z]);
    rays[i].visible = r > 0;
    rays[i].material.opacity = fade;
    proj[i].visible = r >= 1 - NEAR / -v.z;
  });
  renderer.render(scene, cam);
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
