// N5 逐帧绘制：画面只取决于时刻 t。墨与墨色的树只画在纸色区域里，纸与纸色的树只画在墨色区域里（裁剪），
// 所以两边永远不会互相遮挡；红色（种子、果子）不属于任何一边，不裁剪
import { makeWorld, BODY, E, clamp01, lerp, seg } from "./world.js";

const D = window.N5, Wd = makeWorld(D), B = D.beats, cv = document.getElementById("cv"), ctx = cv.getContext("2d");
const PAPER = "#EEE6D3", INK = "#1E2638", RED = "#D9452E", K = BODY;
{ // 片名落在杯座里：按最终镜头算出屏幕位置
  const el = document.getElementById("title"), m = Wd.camMat(Wd.cam(D.duration));
  el.textContent = window.TEXT["n5.title"];
  el.style.top = `${(Wd.toScr(m, [0, D.reveal.titleY])[1] - 48).toFixed(1)}px`;
}

// 孔版纸纹：固定种子的细颗粒 + 大块浓淡，贴在屏幕上（是「印刷」的属性，不随镜头动）
const grain = document.createElement("canvas");
{
  grain.width = 960; grain.height = 540;
  const g = grain.getContext("2d"), img = g.createImageData(960, 540);
  const hs = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const sm = (u) => u * u * (3 - 2 * u), C = 40;
  const vn = (x, y) => { const i = Math.floor(x / C), j = Math.floor(y / C), u = sm(x / C - i), v = sm(y / C - j);
    const a = hs(i, j + 9999), b = hs(i + 1, j + 9999), c = hs(i, j + 10000), d = hs(i + 1, j + 10000);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  for (let y = 0; y < 540; y++) for (let x = 0; x < 960; x++) {
    const v = 128 + 46 * (hs(x, y) - 0.5) + 34 * (vn(x, y) - 0.5), o = (y * 960 + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

function setCam(c) {
  const a = (c.rot * Math.PI) / 180, s = c.s, A = s * Math.cos(a), Bb = s * Math.sin(a), Cc = s * Math.sin(a), Dd = -s * Math.cos(a);
  ctx.setTransform(A, Bb, Cc, Dd, 960 - (A * c.c[0] + Cc * c.c[1]), 540 - (Bb * c.c[0] + Dd * c.c[1]));
}
const line = (pts, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.stroke(); };
const dot = (p, r) => { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.fill(); };

// 剪影人物：同色、无前后层次；眼睛是反色的一个点
function figure(A, col, neg, extra) {
  const J = A.J, F = A.F;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 0; i < 2; i++) { line([J.hip, J.knees[i], J.feet[i]], K.legW); line([J.feet[i], [J.feet[i][0] + A.f * 0.055, J.feet[i][1]]], 0.075); }
  line([J.hip, J.sh], K.torsoW);
  for (let i = 0; i < 2; i++) line([J.sh, J.elbows[i], J.hands[i]], K.armW);
  dot(J.head, K.headR);
  const ga = (J.eyeDir * Math.PI) / 180, up = [Math.sin(ga), Math.cos(ga)], fw = [Math.cos(ga), -Math.sin(ga)];
  const L = (dx, dy) => F.toW([J.headLocal[0] + fw[0] * dx + up[0] * dy, J.headLocal[1] + fw[1] * dx + up[1] * dy]);
  extra(L);
  ctx.fillStyle = neg;
  const e = L(0.08, 0.02), ex = 0.026 * Math.abs(A.f);
  ctx.beginPath(); ctx.ellipse(e[0], e[1], Math.max(ex, 0.004), J.blink ? 0.006 : 0.032, 0, 0, 2 * Math.PI); ctx.fill();
}

// 树：同一结构，墨那边向上长、纸那边向下长（g = ±1）
function tree(t, g, col) {
  const gr = Wd.grow(t), T = Wd.tree, bx = D.lay.treeX, by = Wd.h(bx, t), W = (x, y) => [bx + x, by + g * y];
  if (gr <= 0) return;
  ctx.fillStyle = col;
  for (const [x0, y0, x1, y1, w0, w1, s0, s1] of T.segs) {
    if (gr <= s0) continue;
    const p = clamp01((gr - s0) / (s1 - s0)), xe = lerp(x0, x1, p), ye = lerp(y0, y1, p), we = lerp(w0, w1, p);
    const l = Math.hypot(xe - x0, ye - y0) || 1e-6, nx = -(ye - y0) / l, ny = (xe - x0) / l;
    const q = [W(x0 + nx * w0 / 2, y0 + ny * w0 / 2), W(xe + nx * we / 2, ye + ny * we / 2), W(xe - nx * we / 2, ye - ny * we / 2), W(x0 - nx * w0 / 2, y0 - ny * w0 / 2)];
    ctx.beginPath(); ctx.moveTo(...q[0]); for (const v of q.slice(1)) ctx.lineTo(...v); ctx.closePath(); ctx.fill();
    dot(W(xe, ye), we / 2);
  }
  for (const [x, y, r, s0, s1] of T.leaves) { const p = clamp01((gr - s0) / (s1 - s0)); if (p > 0) dot(W(x, y), r * E.o3(p)); }
}

function scene(t) {
  const c = Wd.cam(t), R = 1110 / c.s + 0.5;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1920, 1080);
  setCam(c);
  // 墨色区域 = 鲁宾杯；纸色区域 = 其余（大矩形挖去杯身，evenodd）
  const ink = new Path2D(), pts = Wd.inkOutline(t, Math.max(0.004, 1.5 / c.s), Math.min(c.c[1] - R - 1, -1));
  ink.moveTo(...pts[0]); for (const p of pts) ink.lineTo(...p); ink.closePath();
  const paper = new Path2D(), Rb = R + 80;
  paper.rect(c.c[0] - Rb, c.c[1] - Rb, 2 * Rb, 2 * Rb); paper.addPath(ink);
  ctx.fillStyle = INK; ctx.fill(ink);

  const m = Wd.actor("mo", t), z = Wd.actor("zhi", t);
  ctx.save(); ctx.clip(paper, "evenodd");
  tree(t, 1, INK);
  const fr = Wd.fruit(t);
  if (fr && fr.stem) { ctx.strokeStyle = INK; ctx.lineCap = "round"; line([fr.stem, [fr.p[0], fr.p[1] + fr.r * 0.8]], 0.022); }
  figure(m, INK, PAPER, (L) => { // 墨：头顶一撮翘起的毛
    ctx.lineWidth = 0.04; ctx.beginPath(); const a = L(-0.02, 0.14), b = L(0.02, 0.25), d = L(0.09, 0.24);
    ctx.moveTo(...a); ctx.quadraticCurveTo(...b, ...d); ctx.stroke();
  });
  ctx.restore();

  ctx.save(); ctx.clip(ink);
  tree(t, -1, PAPER);
  figure(z, PAPER, INK, (L) => { // 纸：脑后一束马尾，随铲子甩动
    ctx.lineWidth = 0.08; ctx.beginPath(); const a = L(-0.12, 0.07), b = L(-0.27, 0.06 + 0.05 * z.sway), d = L(-0.25, -0.1 + 0.06 * z.sway);
    ctx.moveTo(...a); ctx.quadraticCurveTo(...b, ...d); ctx.stroke();
  });
  const { tip, dir } = z.shovel || {};
  ctx.fillStyle = PAPER; ctx.strokeStyle = PAPER; ctx.lineCap = "round";
  if (tip) {
    const pp = [-dir[1], dir[0]], at = (k, w) => [tip[0] + dir[0] * k + pp[0] * w, tip[1] + dir[1] * k + pp[1] * w];
    line([at(0.16, 0), at(D.lay.shovel, 0)], 0.035);
    ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(...at(0, -0.045)); ctx.lineTo(...at(0, 0.045)); ctx.lineTo(...at(0.2, 0.065));
    ctx.lineTo(...at(0.2, -0.065)); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const p of Wd.clods(t)) dot(p, 0.05);
  ctx.restore();

  ctx.fillStyle = RED;
  const sd = Wd.seed(t);
  if (sd.r > 0.002) dot(sd.p, sd.r);
  if (fr && fr.r > 0.002) dot(fr.p, fr.r);
}

// 运动模糊：镜头快动时，在半帧快门（1/120s）内取若干子帧求平均；子帧间画面位移约 ≤ 1.5px
const acc = document.createElement("canvas"); acc.width = 1920; acc.height = 1080;
const actx = acc.getContext("2d");
function renderAt(t) {
  const k = Math.min(16, Math.max(1, Math.ceil((Wd.camSpeed(t) * 0.5) / 1.5)));
  if (k === 1) scene(t);
  else {
    actx.globalAlpha = 1; actx.globalCompositeOperation = "source-over";
    for (let i = 0; i < k; i++) {
      scene(t + ((i + 0.5) / k - 0.5) * (0.5 / 60));
      actx.globalAlpha = 1 / (i + 1); actx.drawImage(cv, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "copy"; ctx.drawImage(acc, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = 0.55;
  ctx.drawImage(grain, 0, 0, 1920, 1080);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  document.getElementById("title").style.opacity = seg(t, B.title0, B.title1, E.sine).toFixed(3);
}

window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady.n5 = document.fonts.load('300 120px "Noto Sans SC"').then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => { const t = Number(e.detail?.time); if (Number.isFinite(t)) renderAt(t); });
renderAt(0);
