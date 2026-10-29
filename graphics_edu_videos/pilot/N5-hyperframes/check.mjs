// N5 逐帧（30Hz）空间校验：翻转前纸与种子藏在可见窄条以下；树与同侧角色不粘连；握铲、够物；关节有限。冲突按区间汇总，有冲突退出码 1
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadData, importPure, report } from "./assets/shared/js/check.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const D = loadData(join(here, "assets/data/n5.js"));
const { makeWorld, BODY: K } = await importPure(join(here, "world.js"));
const W = makeWorld(D), B = D.beats, R = report(), flag = R.flag, stat = { grip: 0, reach: 0 };
const dseg = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-9, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2));
  return Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vy); };
// 身体采样点 [点, 半宽]
function body(J) {
  const out = [[J.head, K.headR]], lim = (pts, w) => { for (let i = 1; i < pts.length; i++) for (let k = 0; k <= 4; k++)
    out.push([[pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / 4, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / 4], w / 2]); };
  lim([J.hip, J.sh], K.torsoW);
  for (let i = 0; i < 2; i++) { lim([J.hip, J.knees[i], J.feet[i]], K.legW); lim([J.sh, J.elbows[i], J.hands[i]], K.armW); }
  return out;
}
function treeGap(t, g, J) {
  const gr = W.grow(t), bx = D.lay.treeX, by = W.h(bx, t), P = (x, y) => [bx + x, by + g * y];
  let gap = 9;
  for (const [p, w] of body(J)) {
    for (const [x0, y0, x1, y1, w0, w1, s0, s1] of W.tree.segs) {
      if (gr <= s0) continue;
      const u = Math.min(1, (gr - s0) / (s1 - s0));
      gap = Math.min(gap, dseg(p, P(x0, y0), P(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u)) - w - w0 / 2);
    }
    for (const [x, y, r, s0, s1] of W.tree.leaves) {
      const u = Math.min(1, Math.max(0, (gr - s0) / (s1 - s0))); if (u <= 0) continue;
      gap = Math.min(gap, Math.hypot(p[0] - P(x, y)[0], p[1] - P(x, y)[1]) - w - r * (1 - (1 - u) ** 3));
    }
  }
  return gap;
}
for (let f = 0; f <= D.duration * 30; f++) {
  const t = f / 30, m = W.actor("mo", t), z = W.actor("zhi", t), c = W.cam(t);
  for (const J of [m.J, z.J]) for (const [p] of body(J)) if (!p.every(Number.isFinite)) flag("关节非有限值", t);
  if (t < B.flip0) {
    const vis = c.c[1] - 540 / c.s;
    if (Math.max(...body(z.J).map(([p, w]) => p[1] + w)) > vis - 0.02) flag("翻转前纸露出窄条", t);
    const s = W.seed(t); if (s.p[1] + s.r > vis - 0.02) flag("翻转前种子露出窄条", t);
  }
  if (t < B.reveal0) { // 拉远之前，画面边框上的点都必须在杯口以内 / 杯身以内，鲁宾杯不能提前露出
    const mm = W.camMat(c), rim = D.vase[0][1];
    for (let k = 0; k < 40; k++) {
      const u = k / 40, [x, y] = W.fromScr(mm, ...[[1920 * u, 0], [1920, 1080 * u], [1920 * (1 - u), 1080], [0, 1080 * (1 - u)]][k % 4]);
      if (y > -1 ? Math.abs(x) > rim - 0.4 : Math.abs(x) > W.vaseW(y) - 0.1) { flag("杯沿提前入画", t); break; }
    }
  }
  if (t >= B.grow0) {
    if (treeGap(t, 1, m.J) < 0.08) flag("墨与墨色树粘连", t);
    if (treeGap(t, -1, z.J) < 0.08) flag("纸与纸色树粘连", t);
  }
  if (t < B.drop && z.shovel) {
    const s = z.shovel, e = [s.tip[0] + s.dir[0] * D.lay.shovel, s.tip[1] + s.dir[1] * D.lay.shovel];
    stat.grip = Math.max(stat.grip, dseg(z.J.hands[0], s.tip, e));
  }
  for (const A of t < B.drop + 0.3 ? [m] : [m, z]) for (let i = 0; i < 2; i++) { // 握铲期间纸的手另由「手离铲柄」统计
    const d = Math.hypot(A.J.hands[i][0] - A.J.targets[i][0], A.J.hands[i][1] - A.J.targets[i][1]);
    if (d > 0.04) flag(`${A === m ? "墨" : "纸"}手${i}够不着目标（>0.04）`, t);
    stat.reach = Math.max(stat.reach, d);
  }
}
R.note(`手离铲柄最大 ${stat.grip.toFixed(3)}；手离目标最大 ${stat.reach.toFixed(3)}`);
const n = R.write(join(here, "../../Temp/n5-probe/check.txt"));
console.log(n ? `FAIL ${n}` : "OK");
process.exit(n ? 1 : 0);
