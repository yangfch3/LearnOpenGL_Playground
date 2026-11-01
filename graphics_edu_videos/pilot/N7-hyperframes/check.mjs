// N7 逐帧（30Hz）校验：相机参数有限且个数完整；每帧位移与子帧数匹配（≤ 48px/帧）；
// 看得见的纸上标注互不重叠、不出纸面、字幕显示时不进字幕带（y ≥ 800）；动物彼此不重叠、在笼中时不出笼子
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadData, importPure, report } from "./assets/shared/js/check.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] || "n7-ep1";
const D = loadData(join(here, `assets/data/${name}.js`)), T = loadData(join(here, "assets/text/zh-CN.js"));
const W = await importPure(join(here, "world.js"));
const C = W.makeCam(D), R = report();
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
  const L = W.labels(D, T, t).concat(W.dynLabels(D, T, t)).filter((a) => a.alpha > 0.02 && vis.has(a.page));
  const scr = L.map((a) => { const p0 = C.project(k, [a.box[0], a.box[1]]), p1 = C.project(k, [a.box[2], a.box[3]]); return [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])]; });
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = a.box, s = scr[i], pr = D.prect[a.page];
    const onScr = s[2] > 0 && s[0] < 1920 && s[3] > 0 && s[1] < 1080;
    if (a.kind !== "link" && (b[0] < pr[0] - 0.05 || b[2] > pr[2] + 0.05 || b[1] < pr[1] - 0.05 || b[3] > pr[3] + 0.05)) R.flag(`标注出纸面 ${a.id}`, t);
    // 字幕带只管本段写出的标注与焦点（以及随数据移动的标注）；前面段落留在纸上的旧字是背景，不算
    const fresh = !a.t || a.t[0] >= segStart - 1e-6;
    if (capOn && fresh && onScr && s[3] >= 800 && s[1] < 1080) R.flag(`标注进字幕带 ${a.id}`, t);
    if (fresh && onScr && tbox.some((q) => W.overlap(s, q))) R.flag(`标注压到标题卡 ${a.id}`, t);
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
