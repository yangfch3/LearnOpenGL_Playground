// 按页面 id 画一张纸：纸底 → 本页内容 → 纸上标注 → 翻页投在这张纸上的影子
import { G, paperBase, world, ga } from "./paper.js";
import { drawAnn } from "./annot.js";
import { tr } from "./world.js";
import { PAGES_A } from "./pagesA.js";
import { PAGES_B } from "./pagesB.js";
import { PAGES_C } from "./pagesC.js";
import { PAGES_D } from "./pagesD.js";

const PAGES = { ...PAGES_A, ...PAGES_B, ...PAGES_C, ...PAGES_D };
// shadows：[[x, y], ...] 多边形（世界坐标，已投到桌面），翻动的纸投下的影子
export function drawPage(pid, t, shadows = []) {
  G.pid = pid; G.dim = tr(G.D, "dim", t);
  const R = G.D.prect[pid], c = G.ctx;
  c.reset();
  paperBase(pid, R);
  world();
  if (PAGES[pid]) PAGES[pid](t);
  drawAnn(pid, t);
  if (shadows.length) {
    world(); c.save(); c.filter = `blur(${(1.2 * G.map.f).toFixed(1)}px)`;
    for (const [pts, a] of shadows) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); ga(a); c.fillStyle = "#2B1D12"; c.fill(); }
    c.restore(); ga(1);
  }
}
