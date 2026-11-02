// N7 逐帧（30Hz）校验：相机参数有限且个数完整；每帧位移与子帧数匹配（≤ 48px/帧）；
// 看得见的纸上标注互不重叠、不出纸面、字幕显示时不进字幕带（y ≥ 800）；动物彼此不重叠、在笼中时不出笼子
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadData, importPure, report } from "./assets/shared/js/check.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] || "n7-ep1";
const D = loadData(join(here, `assets/data/${name}.js`)), T = loadData(join(here, "assets/text/zh-CN.js"));
const W = await importPure(join(here, "world.js"));
const F3 = (await importPure(join(here, "filter.js"))).makeF3(W, D);
const C = W.makeCam(D), R = report();
const sbox = (k, pts) => { const q = pts.map((p) => C.project(k, p)); return [Math.min(...q.map((v) => v[0])), Math.min(...q.map((v) => v[1])), Math.max(...q.map((v) => v[0])), Math.max(...q.map((v) => v[1]))]; };
const inScr = (s) => s[0] >= 0 && s[2] <= 1920 && s[1] >= 0 && s[3] <= 1080;
// 两个凸多边形（屏幕点集取凸包）是否相交：分离轴
function hull(P) {
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function polyHit(A, B) {
  for (const Q of [A, B]) for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length], n = [b[1] - a[1], a[0] - b[0]], pr = (S) => S.map((p) => p[0] * n[0] + p[1] * n[1]);
    const pa = pr(A), pb = pr(B);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
const scrPts = (k, pts) => hull(pts.map((p) => C.project(k, p).slice(0, 2)));
const allow = new Set(D.ann.filter((a) => a.on).map((a) => a.id + "|" + a.on));
let vmax = 0, tmax = 0;
for (let f = 0; f <= D.duration * 30; f++) {
  const t = f / 30, k = C.at(t);
  if (!(W.CAM_KEYS.every((q) => q in k) && k.c.length === 2 && k.c.every(Number.isFinite) && [k.hh, k.k, k.yaw, k.pitch].every(Number.isFinite) && k.hh > 0))
    R.flag("相机参数无效", t);
  const v = C.speed(t); if (v > vmax) { vmax = v; tmax = t; }
  if (v > 48 || (v * 0.5) / W.subframes(v) > 1.5 + 1e-6) R.flag("快动超限或子帧不够", t);
  const P = W.pagesAt(D, t), vis = new Set([P.right, P.left].filter(Boolean));
  if (P.moving.length) continue; // 翻页的 0.9s 里纸面在动，不查
  const on = D.caps.filter((c) => t >= c.t0 && t <= c.t1), capOn = on.some((c) => c.st !== "title"), tbox = on.filter((c) => c.st === "title").map((c) => c.box), segStart = Math.max(...Object.values(D.segs).filter((v) => v <= t + 1e-6));
  const L = W.labels(D, T, t).concat(W.dynLabels(D, T, t), F3 ? F3.labels(T, t) : []).filter((a) => a.alpha > 0.02 && vis.has(a.page));
  if (F3) { // 下集 3：立方体、手机是这几拍的焦点；立体文字、便签都要在画面内、不进字幕带，立方体不压便签
    const cube = F3.pop(t) > 0.01 ? sbox(k, F3.cubeCorners(t)) : null, ph = sbox(k, F3.phoneCorners(t));
    const nb = D.ann.find((a) => a.id === "note"), noteOn = nb && t >= nb.t[0];
    const nS = noteOn ? sbox(k, [[nb.box[0], nb.box[1]], [nb.box[2], nb.box[1]], [nb.box[0], nb.box[3]], [nb.box[2], nb.box[3]]]) : null;
    // 取景跟着焦点走：物体要么整个在画内，要么整个在画外；镜头停住时被画框切一半才算错
    const still = v < 0.5, cut = (s) => !inScr(s) && s[2] > 0 && s[0] < 1920 && s[3] > 0 && s[1] < 1080;
    for (const [id, s] of [["立方体", cube], ["手机", ph], ["便签", nS]]) {
      if (!s) continue;
      if (still && cut(s)) R.flag(`${id}被画框切到`, t);
      if (capOn && s[3] >= 800 && s[1] < 1080 && s[2] > 0 && s[0] < 1920) R.flag(`${id}进字幕带`, t);
    }
    const PH = scrPts(k, F3.phoneCorners(t));
    for (const a of L) if ((!a.t || a.t[0] >= segStart - 1e-6) && polyHit(PH, scrPts(k, [[a.box[0], a.box[1]], [a.box[2], a.box[1]], [a.box[0], a.box[3]], [a.box[2], a.box[3]]]))) R.flag(`手机压到纸上的字 ${a.id}`, t);
    if (cube && nS && polyHit(scrPts(k, F3.cubeCorners(t)), scrPts(k, [[nb.box[0], nb.box[1]], [nb.box[2], nb.box[1]], [nb.box[0], nb.box[3]], [nb.box[2], nb.box[3]]])))
      R.flag("立方体压到便签", t);
    const onS = (a) => { const s = sbox(k, [[a.box[0], a.box[1]], [a.box[2], a.box[3]]]); return s[2] > 0 && s[0] < 1920 && s[3] > 0 && s[1] < 1080; };
    if (cube && (still || D.ep !== 2)) { const H = scrPts(k, F3.cubeCorners(t)); for (const a of L) if (a.page === "e1" && onS(a) && polyHit(H, scrPts(k, [[a.box[0], a.box[1]], [a.box[2], a.box[1]], [a.box[0], a.box[3]], [a.box[2], a.box[3]]]))) R.flag(`立方体压到纸上的字 ${a.id}`, t); }
    const SB = [];
    for (const sp of F3.sprites(T, t)) {
      if (sp.alpha < 0.02) continue;
      const p = C.project(k, sp.p), w = W.textW(sp.str, sp.size) * 540 / k.hh / p[2], h = sp.size * 540 / k.hh / p[2];
      const s = [p[0] - w / 2, p[1] - h / 2, p[0] + w / 2, p[1] + h / 2];
      for (const [id2, s2] of SB) if (W.overlap(s, s2)) R.flag(`立体文字互压 ${sp.id} × ${id2}`, t);
      SB.push([sp.id, s]);
      if (still && cut(s)) R.flag(`立体文字被画框切到 ${sp.id}`, t);
      if (capOn && s[3] >= 800 && s[1] < 1080) R.flag(`立体文字进字幕带 ${sp.id}`, t);
      if (nS && W.overlap(s, nS)) R.flag(`立体文字压到便签 ${sp.id}`, t);
    }
  }
  const scr = L.map((a) => { const p0 = C.project(k, [a.box[0], a.box[1]]), p1 = C.project(k, [a.box[2], a.box[3]]); return [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])]; });
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = a.box, s = scr[i], pr = D.prect[a.page];
    const onScr = s[2] > 0 && s[0] < 1920 && s[3] > 0 && s[1] < 1080;
    if (a.kind !== "link" && (b[0] < pr[0] - 0.05 || b[2] > pr[2] + 0.05 || b[1] < pr[1] - 0.05 || b[3] > pr[3] + 0.05)) R.flag(`标注出纸面 ${a.id}`, t);
    // 字幕带只管本段写出的标注与焦点（以及随数据移动的标注）；前面段落留在纸上的旧字是背景，不算
    const fresh = !a.t || a.t[0] >= segStart - 1e-6;
    if (capOn && fresh && onScr && s[3] >= 800 && s[1] < 1080) R.flag(`标注进字幕带 ${a.id}`, t);
    if (fresh && onScr && tbox.some((q) => W.overlap(s, q))) R.flag(`标注压到标题卡 ${a.id}`, t);
    if (D.ep === 2 && v < 0.5 && fresh && onScr && !inScr(s)) R.flag(`标注被画框切到 ${a.id}`, t);
    for (let j = i + 1; j < L.length; j++) {
      const o = L[j];
      if (allow.has(a.id + "|" + o.id) || allow.has(o.id + "|" + a.id)) continue;
      if (W.overlap(b, o.box, 0.05)) R.flag(`标注重叠 ${a.id} × ${o.id}`, t);
    }
  }
  const A = W.animals(D, t).filter((a) => a.shown && vis.has(a.page));
  for (let i = 0; i < A.length; i++) {
    const a = A[i], c = a.cage;
    if (c && !a.moving && (a.box[0] < c[0] - 0.05 || a.box[2] > c[2] + 0.05 || a.box[3] > c[3] + 0.05)) R.flag(`动物出笼 ${a.id}`, t);
    for (let j = i + 1; j < A.length; j++) if (A[j].page === a.page && W.overlap(a.box, A[j].box, 0.05)) R.flag(`动物重叠 ${a.id} × ${A[j].id}`, t);
  }
}
R.note(`镜头最快 ${vmax.toFixed(1)} px/帧 @ ${tmax.toFixed(2)}s`);
const n = R.write(join(here, `../../Temp/n7/check-${name}.txt`));
console.log(n ? `FAIL ${n}` : "OK");
process.exit(n ? 1 : 0);
