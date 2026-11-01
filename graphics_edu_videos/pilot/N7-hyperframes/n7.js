// N7 逐帧渲染：画面只取决于时刻 t。Three.js 画进离屏画布，再拷到 #gl；快动时在半帧快门内取子帧平均
import * as THREE from "three";
import * as W from "./world.js";
import { makeCam, subframes, clamp01, tr } from "./world.js";
import { makeF3 } from "./filter.js";
import { G, mixHex } from "./paper.js";
import { build, update, setGround, makeRenderer, scene, cam } from "./scene.js";
import { build3d, update3d } from "./scene3d.js";
import { build3e, update3e } from "./scene3e.js";

const D = window.N7, CAM = makeCam(D);
Object.assign(G, { D, T: window.TEXT, C: D.col, F3: makeF3(W, D) });
const out = document.getElementById("gl"), octx = out.getContext("2d");
const glc = document.createElement("canvas"); glc.width = 1920; glc.height = 1080;
let R = null;

function frame(t) {
  const k = CAM.at(t), g = tr(D, "ground", t);
  setGround(g); R.setClearColor(new THREE.Color(mixHex(D.col.desk, D.col.paper, g)));
  update(t, k, CAM.flat(k));
  update3d(t); update3e(t, k);
  R.render(scene, cam);
}
// 字幕三种：say 底部逐字显出；note 手写批注，逐字慢写；title 先贴胶带再逐字写。关键词写完后荧光笔划过、轻跳一下
const PACE = { say: [0.03, 0.18], note: [0.07, 0.12], title: [0.09, 0.14] };
const caps = D.caps.map((c, i) => {
  const el = document.getElementById("cap" + i), ch = [...el.querySelectorAll(".c")];
  const kws = [...el.querySelectorAll(".kw")].map((k) => ({ k, end: ch.indexOf([...k.querySelectorAll(".c")].pop()) }));
  return { c, el, ch, kws, tape: el.querySelector(".tape") };
});
function capAt(t, { c, el, ch, kws, tape }) {
  if (t < c.t0 - 0.05 || t > c.t1 + 0.05) return;
  const [dt, fd] = PACE[c.st], o = 1 - clamp01((t - (c.t1 - 0.3)) / 0.3), t0 = c.t0 + (tape ? 0.22 : 0);
  if (tape) { const u = clamp01((t - c.t0) / 0.3); tape.style.transform = `scaleX(${(1 - (1 - u) ** 3).toFixed(4)})`; el.style.opacity = o.toFixed(3); }
  for (let i = 0; i < ch.length; i++) ch[i].style.opacity = (tape ? clamp01((t - t0 - i * dt) / fd) : Math.min(clamp01((t - t0 - i * dt) / fd), o)).toFixed(3);
  for (const { k, end } of kws) {
    const s = t0 + end * dt + fd, u = clamp01((t - s) / 0.35), p = clamp01((t - s) / 0.3);
    k.style.backgroundSize = `${(100 * (1 - (1 - u) ** 2)).toFixed(2)}% 100%`;
    k.style.transform = `scale(${(1 + 0.08 * Math.sin(Math.PI * p)).toFixed(4)})`;
    if (!tape) k.style.opacity = o.toFixed(3);
  }
}
function renderAt(t) {
  if (!R) return;
  const n = subframes(CAM.speed(t));
  octx.globalCompositeOperation = "source-over";
  for (let i = 0; i < n; i++) {
    frame(n === 1 ? t : t + ((i + 0.5) / n - 0.5) * (0.5 / 60));
    octx.globalAlpha = 1 / (i + 1); octx.drawImage(glc, 0, 0);
  }
  octx.globalAlpha = 1;
  for (const cp of caps) capAt(t, cp);
}

window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.n7 = Promise.all(['700 52px "Noto Sans SC"', '40px "WenKai"', '40px "KMain"', '40px "KMath"'].map((f) => document.fonts.load(f, "鸡兔头脚蜻蜓0123xy")))
  .then(() => { R = makeRenderer(glc); build(); build3d(); build3e(); renderAt(0); });
window.addEventListener("hf-seek", (e) => { const t = Number(e.detail?.time); if (Number.isFinite(t)) renderAt(t); });
