// N3 逐帧驱动：画面只取决于时刻 t
import { makeScenes, sceneAlpha, seg, lerp, E } from "./acts.js";
import { buildScenes, PHOTO } from "./scenes.js";
import { makeGrow } from "./grow.js";

const D = window.N3, T = window.TEXT, B = D.beats, $ = (id) => document.getElementById(id);
const SC = makeScenes(D), S = buildScenes($("art"), SC, D, T), alpha = sceneAlpha(B);
$("art2").appendChild(S.room.root);
const gl = $("gl"), G = makeGrow(gl, D);
$("title").textContent = T["n3.title"]; $("endTitle").textContent = T["n3.title"];
const show = (e, a) => { e.setAttribute("display", a > 0 ? "inline" : "none"); e.setAttribute("opacity", a.toFixed(3)); };

function renderAt(t) {
  const a = alpha(t);
  for (const n of ["palm", "spring", "summer", "autumn", "winter", "room"]) { show(S[n].root, a[n]); if (a[n] > 0) S[n].update(t); }
  // 手机：振动两下，消息弹出
  show(S.phone.root, a.phone);
  const bz = (u) => (u > 0 && u < 0.25 ? 5 * Math.sin(2 * Math.PI * 28 * u) : 0), sx = bz(t - B.buzz) + bz(t - B.buzz - 0.4);
  S.phone.ph.setAttribute("transform", `translate(${sx.toFixed(2)},0)`);
  const m = seg(t, B.msg, B.msg + 0.35, E.back);
  S.phone.bub.setAttribute("opacity", seg(t, B.msg, B.msg + 0.2, E.lin).toFixed(3));
  S.phone.bub.setAttribute("transform", `translate(760,536) scale(${lerp(0.6, 1, m).toFixed(3)}) translate(-760,-536)`);
  // 3D 画布：快门后缩进手机里的照片位
  gl.style.display = a.gl > 0 ? "block" : "none"; gl.style.opacity = a.gl.toFixed(3);
  if (a.gl > 0) {
    G.render(t);
    const k = seg(t, B.shrink0, B.shrink1), s = lerp(1, PHOTO.w / 1920, k);
    gl.style.transform = `translate(${(lerp(0, PHOTO.x, k) + sx).toFixed(2)}px,${lerp(0, PHOTO.y, k).toFixed(2)}px) scale(${s.toFixed(5)})`;
    gl.style.clipPath = `inset(0 round ${(lerp(0, 16, k) / s).toFixed(1)}px)`;
  }
  $("shut").style.opacity = (0.35 * (seg(t, B.shutter - 0.05, B.shutter, E.lin) * (1 - seg(t, B.shutter + 0.05, B.shutter + 0.3, E.lin)))).toFixed(3);
  $("title").style.opacity = (seg(t, B.title, B.title + 0.8) * (1 - seg(t, B.titleOut, B.titleOut + 0.6))).toFixed(3);
  $("endTitle").style.opacity = seg(t, B.endTitle, B.endTitle + 1.2).toFixed(3);
  $("fade").style.opacity = seg(t, B.fade0, B.fade1, E.lin).toFixed(3);
}
window.addEventListener("hf-seek", (e) => { const t = Number(e.detail?.time); if (Number.isFinite(t)) renderAt(t); });
renderAt(0);
