// 小学课本插图式简笔动物：侧面，2–3 个平涂色 + 3px 铅笔描边。局部坐标原点在脚下，朝右为正
// lift = 抬两只脚：鸡蹲坐（双脚收起），兔后腿站立（前爪离地）
import { G, lw as lw0, ellipse, shape, line } from "./paper.js";

const PEN = "#4A4A4A";
let SC = 1;
const lw = (px) => lw0(px) / SC; // 动物整体放大 sc 倍画，描边仍保持原像素宽
const pw = () => lw(3);

function chicken(lift) {
  const c = G.ctx, C = G.C, dy = -0.85 * lift;
  if (lift < 0.98) for (const x of [-0.3, 0.25]) { // 腿与三趾
    line([[x, 0.95 + dy], [x, 0.05]], lw(3), C.beak);
    for (const d of [-0.28, 0, 0.3]) line([[x, 0.05], [x + d, 0]], lw(2.6), C.beak);
  }
  c.save(); c.translate(0, dy);
  c.beginPath(); c.moveTo(-0.95, 1.9); c.lineTo(-1.5, 2.75); c.lineTo(-1.15, 2.05); c.lineTo(-1.45, 2.3); c.lineTo(-0.85, 1.55); c.closePath();
  shape(C.chickBody, PEN, pw()); // 尾
  ellipse(0, 1.6, 1.2, 0.82); shape(C.chickBody, PEN, pw());
  c.beginPath(); c.moveTo(-0.55, 1.75); c.quadraticCurveTo(0.0, 1.05, 0.5, 1.7); c.quadraticCurveTo(0.0, 1.45, -0.55, 1.75); shape(C.chick, PEN, lw(2.4)); // 翅
  ellipse(0.85, 2.5, 0.5, 0.5); shape(C.chickBody, PEN, pw());
  c.beginPath(); c.moveTo(0.55, 2.92); c.arc(0.68, 3.02, 0.14, Math.PI, 0, true); c.arc(0.92, 3.08, 0.15, Math.PI, 0, true); c.arc(1.13, 2.96, 0.12, Math.PI * 0.9, 0.1, true); c.closePath();
  shape(C.chick, PEN, lw(2.2)); // 冠
  c.beginPath(); c.moveTo(1.3, 2.62); c.lineTo(1.62, 2.48); c.lineTo(1.3, 2.36); c.closePath(); shape(C.beak, PEN, lw(2.2));
  ellipse(1.02, 2.95 - 0.38, 0.07, 0.07); shape(PEN);
  ellipse(0.98, 2.22, 0.08, 0.13); shape(C.chick); // 肉垂
  c.restore();
}

function rabbit(lift) {
  const c = G.ctx, C = G.C;
  ellipse(-0.55, 0.38, 0.8, 0.36); shape(C.rabbitBody, PEN, pw()); // 后腿
  c.save(); c.translate(-0.7, 0.3); c.rotate(lift * 0.95); c.translate(0.7, -0.3); // 上身绕后腿立起
  ellipse(-1.45, 1.25, 0.28, 0.28); shape("#FFFFFF", PEN, lw(2.4)); // 尾
  ellipse(-0.2, 1.1, 1.3, 0.92); shape(C.rabbitBody, PEN, pw());
  c.save(); c.translate(0.75, 0.55); c.rotate(-lift * 0.5); ellipse(0.05, -0.2, 0.18, 0.42); shape(C.rabbitBody, PEN, lw(2.6)); c.restore(); // 前爪
  for (const [x, r] of [[0.62, 0.32], [0.9, 0.18]]) { // 两只长耳
    c.save(); c.translate(x, 2.3); c.rotate(r - 0.85 * lift); ellipse(0, 0.6, 0.2, 0.68); // 立起时耳朵仍朝上
    shape(C.rabbitBody, PEN, lw(2.6)); ellipse(0, 0.62, 0.08, 0.48); shape(C.rabbit); c.restore();
  }
  ellipse(1.05, 1.95, 0.62, 0.5); shape(C.rabbitBody, PEN, pw());
  ellipse(1.25, 2.05, 0.08, 0.08); shape(C.rabbit);
  ellipse(1.64, 1.88, 0.06, 0.05); shape(C.rabbit);
  c.restore();
}

function duck() {
  const c = G.ctx, C = G.C;
  for (const x of [-0.25, 0.25]) { line([[x, 0.6], [x, 0.08]], lw(3), C.beak); c.beginPath(); c.moveTo(x - 0.05, 0.08); c.lineTo(x + 0.4, 0.0); c.lineTo(x - 0.1, 0.0); c.closePath(); shape(C.beak, PEN, lw(2)); }
  c.beginPath(); c.moveTo(-1.35, 1.0); c.quadraticCurveTo(-1.6, 1.75, -1.25, 1.85); c.quadraticCurveTo(-0.6, 1.6, 0.6, 1.55);
  c.quadraticCurveTo(1.3, 1.2, 0.9, 0.75); c.quadraticCurveTo(0.1, 0.4, -1.35, 1.0); c.closePath(); shape(C.duckBody, PEN, pw()); // 身
  c.beginPath(); c.moveTo(-0.7, 1.35); c.quadraticCurveTo(-0.05, 0.95, 0.45, 1.3); c.quadraticCurveTo(-0.1, 1.45, -0.7, 1.35); shape(C.duck, PEN, lw(2.4)); // 翅
  c.beginPath(); c.moveTo(0.45, 1.5); c.quadraticCurveTo(0.5, 1.95, 0.7, 2.1); c.lineTo(1.1, 2.0); c.quadraticCurveTo(0.95, 1.7, 0.95, 1.35); c.closePath(); shape(C.duckBody); // 颈
  ellipse(0.9, 2.35, 0.48, 0.45); shape(C.duckBody, PEN, pw());
  c.beginPath(); c.moveTo(1.25, 2.38); c.quadraticCurveTo(1.75, 2.42, 1.85, 2.28); c.quadraticCurveTo(1.7, 2.12, 1.25, 2.2); c.closePath(); shape(C.beak, PEN, lw(2.2)); // 扁嘴
  ellipse(1.05, 2.48, 0.07, 0.07); shape(PEN);
}

function dragonfly(t) { // 蜻蜓：细长身子、四片翅膀（扇动），大眼
  const c = G.ctx, C = G.C, fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 40));
  for (const [x, a] of [[0.1, 0.5], [-0.35, 0.35]]) for (const s of [1, -1]) {
    c.save(); c.translate(x, 1.0); c.rotate(s * a); c.scale(1, fl);
    ellipse(0, s * 0.55, 0.3, 0.6); shape("rgba(255,255,255,0.75)", PEN, lw(2)); c.restore();
  }
  c.beginPath(); c.roundRect(-1.3, 0.9, 1.9, 0.2, 0.1); shape(C.fly, PEN, lw(2.2));
  ellipse(0.75, 1.0, 0.24, 0.2); shape(C.flyBody, PEN, lw(2.2));
}

// a 取自 world.js animals()：x、y（含跳起）、face（-1..1 连续，压扁即转身）、lift、sc
export function drawAnimal(a, t = 0, liftOverride = null) {
  if (!a.shown) return;
  const c = G.ctx, s = a.sc, lift = liftOverride ?? a.lift;
  SC = s;
  c.save(); c.translate(a.x, a.y); c.scale(s * Math.sign(a.face || 1) * Math.max(0.06, Math.abs(a.face)), s);
  if (a.kind === "chicken") chicken(lift); else if (a.kind === "rabbit") rabbit(lift); else if (a.kind === "duck") duck(); else dragonfly(t);
  c.restore();
}
