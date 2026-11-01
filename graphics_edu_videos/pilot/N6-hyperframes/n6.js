// N6 逐帧绘制：画面只取决于时刻 t。镜头由 world.js 求出，书桌与各章工作台分模块画
import { makeCam, subframes, seg, E, clamp01 } from "./world.js";
import { G, txt, world } from "./draw.js";
import { floor, tableShadow, drawDesks } from "./desks.js";
import * as han from "./han.js";
import * as gauss from "./gauss.js";
import * as cay from "./cay.js";
import * as heis from "./heis.js";
import * as goog from "./goog.js";
import * as today from "./today.js";

const D = window.N6, CAM = makeCam(D), cv = document.getElementById("cv"), ctx = cv.getContext("2d");
G.ctx = ctx; G.T = window.TEXT; G.D = D;
today.init(D);
const CH = [han, gauss, cay, heis, goog, today];

function scene(t) {
  G.t = t; G.k = CAM.at(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  floor(); world(); tableShadow(); drawDesks();
  for (const m of CH) { world(); ctx.globalAlpha = 1; m.draw(t); }
  world(); ctx.globalAlpha = 1;
  const a = 1 - seg(G.k.s, 14, 24, E.lin); // 拉远见全桌时，桌下标出年份
  if (a > 0) for (let i = 0; i < 6; i++) txt(G.T["era" + i], i * 32 + 16, 21.2, 4.2, "#EDE4D0", { weight: 600, alpha: a });
}

const acc = document.createElement("canvas"); acc.width = 1920; acc.height = 1080;
const actx = acc.getContext("2d");
const caps = D.caps.map((c, i) => ({ c, el: document.getElementById("cap" + i) }));
const title = document.getElementById("title");
function renderAt(t) {
  const k = subframes(CAM.speed(t));
  if (k === 1) scene(t);
  else {
    actx.globalAlpha = 1; actx.globalCompositeOperation = "source-over";
    for (let i = 0; i < k; i++) { scene(t + ((i + 0.5) / k - 0.5) * (0.5 / 60)); actx.globalAlpha = 1 / (i + 1); actx.drawImage(cv, 0, 0); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "copy"; ctx.drawImage(acc, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  for (const { c, el } of caps) { // 逐字显出，整行淡出
    if (!el) continue;
    const out = 1 - clamp01((t - (c.t1 - 0.3)) / 0.3), sp = el.children;
    for (let i = 0; i < sp.length; i++) sp[i].style.opacity = (Math.min(clamp01((t - c.t0 - i * 0.035) / 0.18), out)).toFixed(3);
    if (c.plate) el.style.background = `rgba(17,14,12,${(0.78 * Math.min(clamp01((t - c.t0) / 0.25), out)).toFixed(3)})`;
  }
  title.style.opacity = seg(t, D.b.title, D.b.title + 1.2, E.sine).toFixed(3);
}

window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.n6 = Promise.all(['700 60px "Noto Sans SC"', '500 60px "Noto Sans SC"', '500 40px "JBM"', '40px "KMath"', '40px "KMain"', '40px "KMainI"']
  .map((f) => document.fonts.load(f))).then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => { const t = Number(e.detail?.time); if (Number.isFinite(t)) renderAt(t); });
renderAt(0);
