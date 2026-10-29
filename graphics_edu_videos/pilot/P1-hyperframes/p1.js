import * as THREE from "three";
import { LineSegments2 } from "./assets/shared/vendor/three/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "./assets/shared/vendor/three/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "./assets/shared/vendor/three/lines/LineMaterial.js";

const D = window.P1, B = D.beats, W = 1920, H = 1080;
const VIEW = 0x45c4e0, INK_DIM = 0x9aa6b8;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x11161d, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(D.orbit.fov, W / H, 0.1, 100);

const mat = (color, dashed) => new LineMaterial({
  color, linewidth: 3, worldUnits: false, dashed: !!dashed, dashSize: 0.06, gapSize: 0.05, alphaToCoverage: true,
  resolution: new THREE.Vector2(W, H),
});
const seg = (pts, color, dashed) => {
  const g = new LineSegmentsGeometry().setPositions(pts.flat());
  const l = new LineSegments2(g, mat(color, dashed));
  if (dashed) l.computeLineDistances();
  scene.add(l);
  return l;
};

// 视锥棱线：每条单独一个对象，绘制进度改端点
const edges = D.edges.map((e) => ({ ...e, line: seg([e.a, e.b], VIEW, e.dashed) }));
const setEdge = (e, k) => {
  const b = e.a.map((v, i) => v + (e.b[i] - v) * k);
  e.line.geometry.setPositions([...e.a, ...b]);
  if (e.dashed) e.line.computeLineDistances();
  e.line.visible = k > 0;
};

// 近、远平面：sp-view 15%
const plane = (pts) => {
  const g = new THREE.BufferGeometry().setFromPoints([0, 1, 2, 0, 2, 3].map((i) => new THREE.Vector3(...pts[i])));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: VIEW, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(m);
  return m;
};
const planes = [plane(D.near), plane(D.far)];

// 线框立方体
const { c, s } = D.cube, h = s / 2;
const cv = [];
for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) cv.push([c[0] + x, c[1] + y, c[2] + z]);
const cubeEdges = [];
for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([0, 1, 2].filter((a) => cv[i][a] !== cv[j][a]).length === 1) cubeEdges.push(cv[i], cv[j]);
seg(cubeEdges, INK_DIM);

// 视点：小球
scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 12), new THREE.MeshBasicMaterial({ color: 0xedf1f7 })));

const labs = {
  labEye: { p: [0, -0.12, 0], dy: 34 },
  labNear: { p: [0, D.near[2][1], -0.5], dy: -34 },
  labFar: { p: [0, D.far[2][1], -3], dy: -34 },
};
Object.keys(labs).forEach((k) => (labs[k].el = document.getElementById(k)));

const clamp = (x) => Math.min(Math.max(x, 0), 1);
const inOut2 = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const out2 = (t) => 1 - (1 - t) ** 3;

function renderAt(t) {
  edges.forEach((e) => setEdge(e, out2(clamp((t - e.at) / D.draw))));
  planes.forEach((p) => (p.material.opacity = 0.15 * out2(clamp((t - B.planes) / 0.5))));
  const k = inOut2(clamp((t - B.orbit) / (B.orbitEnd - B.orbit)));
  const az = THREE.MathUtils.degToRad(D.orbit.az0 + 360 * k), pitch = THREE.MathUtils.degToRad(D.orbit.pitch);
  const [tx, ty, tz] = D.orbit.target, r = D.orbit.dist;
  camera.position.set(tx + r * Math.cos(pitch) * Math.sin(az), ty + r * Math.sin(pitch), tz + r * Math.cos(pitch) * Math.cos(az));
  camera.lookAt(tx, ty, tz);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  Object.values(labs).forEach(({ p, dy, el }) => {
    const v = new THREE.Vector3(...p).project(camera);
    const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H + dy;
    el.style.transform = `translate(${(x - el.offsetWidth / 2).toFixed(1)}px, ${(y - el.offsetHeight / 2).toFixed(1)}px)`;
  });
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(0);
