// 低多边形人物与猫：盒体 + 关节组；姿态由权重叠加
import * as THREE from "three";

const box = (w, h, d, mat, y0 = -h / 2) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0, 0); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m; };
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const lim = (parent, x, y, len1, len2, w, mat, matEnd) => {
  const a = pivot(parent, x, y, 0); a.add(box(w, len1, w, mat));
  const b = pivot(a, 0, -len1, 0); b.add(box(w * 0.92, len2, w * 0.92, mat));
  if (matEnd) b.add(box(w * 1.05, 0.07, w * 1.3, matEnd, -len2 - 0.0));
  return { a, b, end: pivot(b, 0, -len2, 0) };
};

// 人：髋高 0.62，身高约 1.36；c = { skin, hair, top, bottom, shoe }，dress 为真时下身是裙
export function makeHuman(M, c, { dress = false, s = 1, tag = 0, longHair = false } = {}) {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0); body.scale.setScalar(s);
  const hips = pivot(body, 0, 0.62, 0), torso = pivot(hips, 0, 0, 0);
  torso.add(box(0.34, 0.42, 0.2, M(c.top), 0.21));
  const neck = pivot(torso, 0, 0.44, 0), head = pivot(neck, 0, 0, 0);
  head.add(box(0.27, 0.27, 0.25, M(c.skin), 0.135));
  head.add(box(0.29, 0.1, 0.27, M(c.hair), 0.27 - 0.03));
  const back = box(0.29, longHair ? 0.34 : 0.2, 0.06, M(c.hair), 0.27); back.position.z = -0.12; head.add(back);
  const eyes = new THREE.Group(); eyes.position.set(0, 0.14, 0.126); head.add(eyes);
  for (const x of [-0.06, 0.06]) { const e = box(0.04, 0.05, 0.01, M("#2a2228"), 0); e.position.x = x; eyes.add(e); }
  const arm = (x) => lim(torso, x, 0.4, 0.24, 0.21, 0.085, M(c.top), null);
  const aL = arm(0.215), aR = arm(-0.215);
  for (const a of [aL, aR]) a.end.add(box(0.08, 0.08, 0.08, M(c.skin), -0.02));
  const lL = lim(hips, 0.085, 0, 0.3, 0.3, 0.11, M(dress ? c.skin : c.bottom), M(c.shoe));
  const lR = lim(hips, -0.085, 0, 0.3, 0.3, 0.11, M(dress ? c.skin : c.bottom), M(c.shoe));
  if (dress) { const g = new THREE.CylinderGeometry(0.17, 0.27, 0.34, 6); g.translate(0, -0.12, 0); const m = new THREE.Mesh(g, M(c.bottom)); m.castShadow = true; torso.add(m); }
  else hips.add(box(0.33, 0.1, 0.2, M(c.bottom), 0.02));
  root.traverse((o) => { if (o.isMesh) o.userData.mask = tag; });
  // P：walk 相位与幅度；crouch / sit 权重；lean；head [pitch, yaw]；armL / armR [前抬, 外展, 屈肘]；blink 0..1
  function set(P) {
    const sw = Math.sin(P.phase) * P.walk, lift = Math.max(0, Math.cos(P.phase)) * P.walk;
    const cr = P.crouch, si = P.sit;
    hips.position.y = 0.62 - 0.27 * cr - 0.5 * si + 0.03 * Math.abs(Math.cos(P.phase)) * P.walk + (P.hop || 0);
    torso.rotation.x = 0.35 * cr + (P.lean || 0) - 0.1 * si;
    const leg = (l, sgn) => {
      l.a.rotation.x = -0.55 * sgn * sw - 1.25 * cr - 1.5 * si;
      l.b.rotation.x = 0.8 * (sgn > 0 ? lift : Math.max(0, -Math.cos(P.phase)) * P.walk) + 2.3 * cr + 1.45 * si;
      l.a.rotation.z = 0.12 * cr * Math.sign(l.a.position.x);
    };
    leg(lL, 1); leg(lR, -1);
    const armSet = (a, v, sgn) => {
      a.a.rotation.x = -v[0] + 0.45 * sgn * sw; a.a.rotation.z = Math.sign(a.a.position.x) * (0.08 + v[1]); a.b.rotation.x = -v[2] - 0.2 * P.walk;
    };
    armSet(aL, P.armL, -1); armSet(aR, P.armR, 1);
    neck.rotation.x = P.head[0]; neck.rotation.y = P.head[1];
    eyes.scale.y = Math.max(0.12, 1 - P.blink);
  }
  return { root, body, hips, head, neck, hand: { L: aL.end, R: aR.end }, back: torso, set, s };
}

// 猫：身长 0.46，肩高 0.2；朝 +z
export function makeCat(M, c, tag = 2) {
  const root = new THREE.Group(), body = pivot(root, 0, 0.2, 0);
  const torso = box(0.2, 0.17, 0.44, M(c.fur), 0.0); body.add(torso);
  const neck = pivot(body, 0, 0.06, 0.2), head = pivot(neck, 0, 0, 0);
  head.add(box(0.19, 0.16, 0.16, M(c.fur), 0.05));
  const muzzle = box(0.1, 0.06, 0.05, M(c.light), 0); muzzle.position.set(0, 0.0, 0.09); head.add(muzzle);
  const ears = [];
  for (const x of [-0.06, 0.06]) {
    const g = new THREE.ConeGeometry(0.04, 0.08, 4); g.translate(0, 0.04, 0);
    const e = new THREE.Mesh(g, M(c.fur)); e.position.set(x, 0.13, -0.02); e.castShadow = true; head.add(e); ears.push(e);
  }
  const eyes = new THREE.Group(); eyes.position.set(0, 0.07, 0.081); head.add(eyes);
  for (const x of [-0.045, 0.045]) { const e = box(0.03, 0.035, 0.01, M("#2a2228"), 0); e.position.x = x; eyes.add(e); }
  const legs = [[0.06, 0.17], [-0.06, 0.17], [0.06, -0.17], [-0.06, -0.17]].map(([x, z]) => {
    const p = pivot(body, x, -0.03, z); p.add(box(0.06, 0.18, 0.06, M(c.fur))); return p;
  });
  const tail = []; let tp = pivot(body, 0, 0.05, -0.22);
  for (let i = 0; i < 4; i++) { const g = box(0.045, 0.045, 0.1, M(i === 3 ? c.light : c.fur), 0); g.geometry.translate(0, 0, -0.05); tp.add(g); tail.push(tp); tp = pivot(tp, 0, 0, -0.1); }
  root.traverse((o) => { if (o.isMesh) o.userData.mask = tag; });
  // P：phase / walk；curl、sit、lie、stretch 权重；head [pitch, yaw]；ear 抖动；tail 摆；hop 离地高度；blink
  function set(P, t) {
    const g = P.walk, cu = P.curl, si = P.sit, li = P.lie, stv = P.stretch;
    legs.forEach((l, i) => {
      const ph = P.phase + (i === 0 || i === 3 ? 0 : Math.PI);
      l.rotation.x = 0.6 * Math.sin(ph) * g + (i >= 2 ? -1.2 : 0) * si + (i < 2 ? -1.3 : 1.3) * (li + cu) - 0.7 * stv * (i < 2 ? 1 : 0);
      l.scale.y = 1 - 0.6 * (cu + li) * (1 - 0.3);
    });
    body.position.y = 0.2 - 0.12 * (cu + li) - 0.03 * si + (P.hop || 0) + 0.015 * Math.abs(Math.cos(P.phase)) * g;
    body.rotation.x = -0.55 * si + 0.3 * stv;
    body.rotation.z = (P.roll || 0);
    body.scale.set(1 + 0.15 * cu, 1, 1 - 0.18 * cu);
    neck.rotation.x = P.head[0] + 0.5 * si - 0.25 * stv; neck.rotation.y = P.head[1] + 0.9 * cu;
    neck.position.y = 0.06 - 0.05 * cu;
    ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * 0.5 * P.ear; });
    tail.forEach((s, i) => {
      s.rotation.x = i === 0 ? 0.7 - 1.2 * si + 0.4 * li - 0.6 * cu + 0.5 * P.walk : 0.15 * Math.sin(1.8 * t - i) * (1 - cu);
      s.rotation.y = i === 0 ? 0.9 * cu : (0.25 + 0.5 * cu) * (1 + 0.6 * Math.sin(1.3 * t + i));
    });
    eyes.scale.y = Math.max(0.12, 1 - P.blink);
  }
  return { root, body, head, set };
}
