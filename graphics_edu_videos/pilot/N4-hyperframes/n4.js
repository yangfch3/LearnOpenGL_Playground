// N4 逐帧驱动：画面只取决于时刻 t
import * as THREE from "three";
import { makePath, seg, lerp, E } from "./path.js";
import { buildWorld, updateWorld, updateActors, CONST } from "./world.js";
import { makePipeline } from "./post.js";

const D = window.N4, T = window.TEXT, B = D.beats, $ = (id) => document.getElementById(id);
const P = makePath(D), Wd = buildWorld(P, D), pipe = makePipeline($("gl"));
const CHARS = [CONST.red, CONST.catFur, CONST.teal].map((h) => new THREE.Color(h));
const label = (n) => (n ? `${n} × ${(n * 9) / 16}` : "1920 × 1080");

function blinkAmt(t) {
  const u = P.actU("hero", "blink", t);
  return u < 0 ? 0 : Math.max(0, 1 - Math.abs(((u * 2) % 1) - 0.5) * 5);
}
const tctx = $("title").getContext("2d"), small = document.createElement("canvas"), sctx = small.getContext("2d");
function drawTitle(t) {
  const u = seg(t, B.title0, B.title1, E.lin), f = [48, 24, 12, 6, 3, 1][Math.min(5, Math.floor(u * 6))];
  small.width = Math.ceil(1920 / f); small.height = Math.ceil(1080 / f);
  sctx.clearRect(0, 0, small.width, small.height);
  sctx.save(); sctx.scale(1 / f, 1 / f);
  sctx.font = '300 150px "Noto Sans SC"'; sctx.textAlign = "center"; sctx.textBaseline = "middle"; sctx.fillStyle = "#22303c";
  sctx.letterSpacing = "40px"; sctx.fillText(T["n4.title"], 980, 300);
  sctx.restore();
  tctx.clearRect(0, 0, 1920, 1080); tctx.imageSmoothingEnabled = false; tctx.drawImage(small, 0, 0, small.width * f, small.height * f);
}

function renderAt(t) {
  updateWorld(Wd, P, D, t); updateActors(Wd, P, D, t);
  const c = P.cam(t), m = P.matrices(c), r = P.res(t);
  const hp = P.at("hero", t), o = P.project(c, [hp.x, 1.2, hp.z]);
  const tr = r.mode === "single" ? [r.n, r.n, 1, -1] : [r.lo, r.hi, r.dir, (t - r.t0) / r.dur];
  const palette = [];
  for (const col of [Wd.scene.background, ...[...Wd.mats.values()].map((mm) => mm.color)])
    if (!palette.some((p) => Math.abs(p.r - col.r) + Math.abs(p.g - col.g) + Math.abs(p.b - col.b) < 0.01)) palette.push(col);
  const tileP = t >= B.tile0 ? (t - B.tile0) / (B.tile1 - B.tile0) : -1;
  pipe.render(Wd.scene, { ...m, tr, dur: r.dur || 1, quant: P.quant(t), blink: blinkAmt(t), palette, chars: CHARS,
    origin: [o.sx / 1920, 1 - o.sy / 1080], tileP, tileDur: B.tile1 - B.tile0, overlay: lerp(0.4, 0.22, seg(t, B.title0, B.fade0)) });
  // 分辨率计数：春天与结尾回落时显示
  const shown = r.mode === "single" ? r.n : (t - r.t0) / r.dur >= 0.5 ? (r.dir > 0 ? r.hi : r.lo) : r.dir > 0 ? r.lo : r.hi;
  $("res").textContent = label(shown);
  const a1 = seg(t, 0.4, 0.9) * (1 - seg(t, B.vec + 1.2, B.vec + 1.7)), a2 = seg(t, B.c1024 - 0.4, B.c1024) * (1 - seg(t, B.tile0, B.tile0 + 0.5));
  $("res").style.opacity = Math.max(a1, a2).toFixed(3);
  $("title").style.opacity = t >= B.title0 ? "1" : "0";
  if (t >= B.title0) drawTitle(t);
  $("fade").style.opacity = seg(t, B.fade0, B.fade1, E.lin).toFixed(3);
}
window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.n4 = document.fonts.load('300 150px "Noto Sans SC"').then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => { const t = Number(e.detail?.time); if (Number.isFinite(t)) renderAt(t); });
renderAt(0);
