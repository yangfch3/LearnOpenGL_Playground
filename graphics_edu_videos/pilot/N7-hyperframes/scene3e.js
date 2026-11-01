// 下集 3 滤镜的立体内容：手机（屏幕是动态贴图）、色卡、颜色立方体、点云、色卡点对与偏差线、立体文字。位置全部取自 filter.js
import * as THREE from "three";
import { LineSegments2 } from "./assets/shared/vendor/three/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "./assets/shared/vendor/three/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "./assets/shared/vendor/three/lines/LineMaterial.js";
import { G } from "./paper.js";
import { seg, E, clamp01, tr } from "./world.js";
import { scene } from "./scene.js";

const rgb = (c) => `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")})`;
function lines(color, px, opacity = 1, dashed = false) {
  const m = new LineMaterial({ color, linewidth: px, transparent: true, opacity, depthWrite: false, dashed, dashSize: 0.6, gapSize: 0.45 });
  m.resolution.set(1920, 1080);
  const o = new LineSegments2(new LineSegmentsGeometry(), m); o.frustumCulled = false; o.renderOrder = 2; scene.add(o);
  return { o, m, set(a) { o.visible = a.length > 0; if (!a.length) return; o.geometry.dispose(); o.geometry = new LineSegmentsGeometry(); o.geometry.setPositions(a); if (dashed) o.computeLineDistances(); } };
}
// 圆点：直径 sz（世界单位，随透视缩放）；深色描边让浅色点在纸上也看得见；ring = 1 画成空心圈
const PVS = `attribute vec3 col; attribute float sz; attribute float ring; attribute float al; uniform float uS; varying vec3 vC; varying float vR; varying float vA;
  void main(){ vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; gl_PointSize = sz * uS / p.w; vC = col; vR = ring; vA = al; }`;
const PFS = `varying vec3 vC; varying float vR; varying float vA;
  void main(){ float r = length(gl_PointCoord * 2.0 - 1.0); if (r > 1.0 || vA < 0.003 || (vR > 0.5 && r < 0.40)) discard;
    vec3 ol = vec3(0.118, 0.149, 0.22); float e = smoothstep(0.64, 0.76, r); if (vR > 0.5) e = max(e, 1.0 - smoothstep(0.44, 0.54, r));
    gl_FragColor = vec4(mix(vC, ol, e), vA * (1.0 - smoothstep(0.9, 1.0, r))); }`;
function points(n) {
  const g = new THREE.BufferGeometry();
  for (const [k, d] of [["position", 3], ["col", 3], ["sz", 1], ["ring", 1], ["al", 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * d), d));
  const m = new THREE.ShaderMaterial({ vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, uniforms: { uS: { value: 1 } } });
  const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 3; scene.add(o);
  const A = (k) => g.attributes[k].array;
  return { o, g, set(i, p, c, sz, ring, al) { A("position").set(p, i * 3); A("col").set(c.map((v) => v / 255), i * 3); A("sz")[i] = sz; A("ring")[i] = ring; A("al")[i] = al; },
    done(n2) { g.setDrawRange(0, n2); for (const k of ["position", "col", "sz", "ring", "al"]) g.attributes[k].needsUpdate = true; o.visible = n2 > 0; } };
}
// 立体文字：手写体，纸色描边（压在点云上也读得清）；同一 id 的字变了才重画
const SPR = {};
function sprite(id, str, red) {
  const key = str + (red ? "|r" : "");
  if (SPR[id] && SPR[id].key === key) return SPR[id].s;
  if (SPR[id]) { scene.remove(SPR[id].s); SPR[id].s.material.map.dispose(); }
  const cv = document.createElement("canvas"), c = cv.getContext("2d"), px = 96;
  c.font = `${px}px "WenKai"`; const w = Math.ceil(c.measureText(str).width) + 28;
  cv.width = w; cv.height = Math.round(px * 1.4); c.font = `${px}px "WenKai"`; c.textAlign = "center"; c.textBaseline = "middle";
  c.lineWidth = px * 0.18; c.lineJoin = "round"; c.strokeStyle = "rgba(247,243,232,0.9)"; c.strokeText(str, w / 2, cv.height / 2);
  c.fillStyle = red ? G.C.redT : G.C.hand; c.fillText(str, w / 2, cv.height / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  s.userData.ar = w / cv.height; s.renderOrder = 5; scene.add(s); SPR[id] = { key, s }; return s;
}

// ---- 色卡与手机：各一块带贴图的薄板 ----
const PXU = 40; // 贴图每格像素
// 板身是圆角矩形挤出，圆角与贴图上画的同半径 r，四角不露方角
function slab(w, h, th, cvW, cvH, side, r) {
  const cv = document.createElement("canvas"); cv.width = Math.round(cvW * PXU); cv.height = Math.round(cvH * PXU);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
  const sh = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  const P2 = Math.PI / 2; // 圆弧与 canvas roundRect 同形
  sh.moveTo(x0 + r, y0); sh.lineTo(x0 + w - r, y0); sh.absarc(x0 + w - r, y0 + r, r, -P2, 0); sh.lineTo(x0 + w, y0 + h - r);
  sh.absarc(x0 + w - r, y0 + h - r, r, 0, P2); sh.lineTo(x0 + r, y0 + h); sh.absarc(x0 + r, y0 + h - r, r, P2, 2 * P2);
  sh.lineTo(x0, y0 + r); sh.absarc(x0 + r, y0 + r, r, 2 * P2, 3 * P2);
  const grp = new THREE.Group(), box = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 8 }), new THREE.MeshBasicMaterial({ color: side }));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(cvW, cvH), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  top.position.z = th + 0.005; grp.add(box, top); scene.add(grp);
  return { grp, cv, c: cv.getContext("2d"), tex };
}
let X = null;
const cardDims = (k) => [6 * k.cell + 5 * k.gap + 2 * k.pad, 4 * k.cell + 3 * k.gap + 2 * k.pad];
// 色卡图样（色卡本身与手机屏幕上拍到的那张共用）：原点在左上，单位为格
function cardArt(c, k, cols, hi) {
  const [w, h] = cardDims(k);
  c.fillStyle = "#26282B"; c.beginPath(); c.roundRect(0, 0, w, h, 0.5); c.fill();
  for (let i = 0; i < 24; i++) {
    const x = k.pad + (i % 6) * (k.cell + k.gap), y = k.pad + Math.floor(i / 6) * (k.cell + k.gap);
    c.fillStyle = rgb(cols[i]); c.fillRect(x, y, k.cell, k.cell);
    const a = hi ? hi(i) : 0;
    if (a > 0.01) { c.globalAlpha = a; c.strokeStyle = "#FFFFFF"; c.lineWidth = 0.34; c.strokeRect(x - 0.25, y - 0.25, k.cell + 0.5, k.cell + 0.5); c.globalAlpha = 1; }
  }
}
export function build3e() {
  const F3 = G.F3; if (!F3) return;
  const F = F3.F, P = F.phone, [cw, ch] = cardDims(F.card);
  const card = slab(cw, ch, F.card.z, cw, ch, "#1C1D1F", 0.5);
  const phone = slab(P.w, P.h, P.th, P.w, P.h, "#2E333B", 1.8);
  const photo = document.createElement("canvas"); photo.width = F.pw; photo.height = F.ph;
  const pctx = photo.getContext("2d"), id = pctx.createImageData(F.pw, F.ph);
  for (let i = 0; i < F.pw * F.ph; i++) { const c = F3.rgbAt(i % F.pw, Math.floor(i / F.pw)); id.data.set([c[0], c[1], c[2], 255], i * 4); }
  pctx.putImageData(id, 0, 0);
  const ink = G.C.hand, N = F.nx * F.ny;
  X = { card, phone, photo, cardKey: "", edges: lines(ink, 2.2, 0.55), axes: lines(ink, 3.4, 0.95), drop: lines(G.C.red, 2.4, 0.9, true), dev: lines(G.C.red, 3.4, 0.95),
    cloud: points(N), pairs: points(48), tapP: points(1) };
}

// 手机屏幕：照片 → 取景（拍色卡）→ 拍下的色卡（随校正矩阵变色）；点开的像素画一个红圈
function drawPhone(t) {
  const F3 = G.F3, F = F3.F, P = F.phone, b = G.D.b, c = X.phone.c, sx = (P.w - P.sw) / 2, sy = (P.h - P.sh) / 2;
  c.setTransform(PXU, 0, 0, PXU, 0, 0); c.clearRect(0, 0, P.w, P.h);
  c.fillStyle = "#23272E"; c.beginPath(); c.roundRect(0, 0, P.w, P.h, 1.8); c.fill();
  c.fillStyle = "#3A404A"; c.beginPath(); c.arc(sx * 0.5, P.h / 2, 0.35, 0, 2 * Math.PI); c.fill(); // 前置摄像头
  c.save(); c.beginPath(); c.rect(sx, sy, P.sw, P.sh); c.clip();
  const [m0, shot] = b.camMode || [Infinity, Infinity];
  if (t < m0) { c.imageSmoothingEnabled = true; c.drawImage(X.photo, sx, sy, P.sw, P.sh); }
  else { // 取景框里是纸上的色卡；拍下后，屏幕上的颜色按当前校正矩阵算
    c.fillStyle = "#E9E4D8"; c.fillRect(sx, sy, P.sw, P.sh);
    const M = t < shot ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : F3.Mu(t), cols = F.cap.map((q) => F3.mul(M, q)), [cw, ch] = cardDims(F.card), k = (P.sh * 0.84) / ch;
    c.save(); c.translate(sx + P.sw / 2 - (cw * k) / 2, sy + P.sh / 2 - (ch * k) / 2); c.scale(k, k);
    cardArt(c, F.card, cols, (i) => F3.pulseOf(t, i)); c.restore();
    if (t < shot + 0.1) { c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(sx + P.sw - 1.5, P.h / 2, 0.85, 0, 2 * Math.PI); c.fill(); }
    const ir = 1 - clamp01(Math.abs(t - shot) / 0.14); // 快门：屏幕暗一下（只在屏幕里，不闪全屏）
    if (ir > 0) { c.fillStyle = `rgba(10,10,12,${(0.9 * ir).toFixed(3)})`; c.fillRect(sx, sy, P.sw, P.sh); }
  }
  c.restore();
  if (b.tap && t >= b.tap[0] && t < b.axnOut + 0.5) { // 点开的像素
    const [px, py] = F3.sampPix(F.tapK), [u, v] = F3.pixUV(px, py), r = 0.35 + 0.55 * seg(t, b.tap[0], b.tap[1], E.o3);
    c.globalAlpha = 1 - seg(t, b.axnOut, b.axnOut + 0.5, E.sine); c.strokeStyle = G.C.red; c.lineWidth = 0.2;
    c.beginPath(); c.arc(P.w / 2 + u, P.h / 2 - v, r, 0, 2 * Math.PI); c.stroke(); c.globalAlpha = 1;
  }
  X.phone.tex.needsUpdate = true;
}
function drawCardTex(t) {
  const F3 = G.F3, F = F3.F, hi = (i) => F3.pulseOf(t, i), key = Array.from({ length: 24 }, (_, i) => hi(i).toFixed(2)).join();
  if (key === X.cardKey) return;
  const c = X.card.c; c.setTransform(PXU, 0, 0, PXU, 0, 0); c.clearRect(0, 0, X.card.cv.width, X.card.cv.height);
  cardArt(c, F.card, F.ref, hi); X.card.tex.needsUpdate = true; X.cardKey = key;
}

export function update3e(t, k) {
  const F3 = G.F3; if (!F3 || !X) return;
  const F = F3.F, D = G.D, b = D.b, Z = F3.PAGE_Z, uS = 540 / k.hh;
  // 手机与色卡
  const p = F3.pose(t);
  X.phone.grp.position.set(p.x, p.y, Z + p.lift); X.phone.grp.rotation.z = (F.phone.rot * Math.PI) / 180; drawPhone(t);
  const cp = tr(D, "card", t, [-999, 0]);
  X.card.grp.visible = cp[0] > -95; X.card.grp.position.set(cp[0], cp[1], Z); if (X.card.grp.visible) drawCardTex(t);
  // 立方体：12 条棱，三条从黑角出发的棱加粗（红、绿、蓝）
  const pop = F3.pop(t), on = pop > 0.002;
  const V = (x, y, z) => F3.cubeW(t, [x * 255, y * 255, z * 255]), ed = [], ax = [];
  if (on) {
    const L = [[[0, 0, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 0, 1]]];
    for (const [a, q] of L) ax.push(...V(...a), ...V(...q));
    const rest = [[[1, 0, 0], [1, 1, 0]], [[0, 1, 0], [1, 1, 0]], [[1, 0, 0], [1, 0, 1]], [[0, 1, 0], [0, 1, 1]], [[1, 1, 0], [1, 1, 1]],
      [[0, 0, 1], [1, 0, 1]], [[0, 0, 1], [0, 1, 1]], [[1, 0, 1], [1, 1, 1]], [[0, 1, 1], [1, 1, 1]]];
    for (const [a, q] of rest) ed.push(...V(...a), ...V(...q));
  }
  X.edges.set(ed); X.axes.set(ax);
  // 点云（3b 起退为背景）；点开的那个像素点大一号
  const cl = F3.cloud(t); let n = 0;
  for (const q of cl) { if (q.k === F.tapK) continue; X.cloud.set(n++, q.p, q.c, 0.62, 0, q.a); }
  X.cloud.done(n); X.cloud.o.material.uniforms.uS.value = uS;
  const tp = cl.find((q) => q.k === F.tapK);
  if (tp) {
    const pl = Math.max(0, ...F3.sprites(G.T, t).filter((s) => s.id.startsWith("axv")).map((s) => s.pulse || 0));
    X.tapP.set(0, tp.p, tp.c, 1.15 * (1 + 0.25 * pl), 0, Math.max(tp.a, 1 - seg(t, b.axnOut, b.axnOut + 0.8, E.sine))); X.tapP.done(1);
  } else X.tapP.done(0);
  X.tapP.o.material.uniforms.uS.value = uS;
  // 点开的像素：红虚线落到地面、再连到红、绿两条棱；一条横线连到蓝棱
  const da = seg(t, b.drop[0], b.drop[1], E.sine) * (1 - seg(t, b.axnOut, b.axnOut + 0.4, E.sine));
  if (da > 0.01) {
    const c = F.tap, P0 = F3.cubeW(t, c), Q = F3.cubeW(t, [c[0], c[1], 0]);
    X.drop.set([...P0, ...Q, ...Q, ...F3.cubeW(t, [c[0], 0, 0]), ...Q, ...F3.cubeW(t, [0, c[1], 0]), ...P0, ...F3.cubeW(t, [0, 0, c[2]])]); X.drop.m.opacity = 0.9 * da;
  } else X.drop.set([]);
  // 色卡点对：实心点 = 真实，空心圈 = 拍出（随校正矩阵移动），红线 = 偏差
  const pr = F3.pairs(t), dl = [];
  pr.forEach((q, i) => {
    const s = 0.95 * (1 + 0.5 * q.pulse);
    X.pairs.set(2 * i, q.tp, F.ref[q.i], s, 0, q.a); X.pairs.set(2 * i + 1, q.cp, q.cc, s, 1, q.a);
    dl.push(...q.tp, ...q.cp);
  });
  X.pairs.done(2 * pr.length); X.pairs.o.material.uniforms.uS.value = uS; X.dev.set(dl);
  // 立体文字
  const live = new Set();
  for (const s of F3.sprites(G.T, t)) {
    const sp = sprite(s.id, s.str, s.red), sz = s.size * (1 + 0.15 * (s.pulse || 0));
    sp.visible = true; sp.position.set(...s.p); sp.scale.set(sz * sp.userData.ar, sz, 1); sp.material.opacity = s.alpha; live.add(s.id);
  }
  for (const [id, v] of Object.entries(SPR)) if (!live.has(id)) v.s.visible = false;
}
