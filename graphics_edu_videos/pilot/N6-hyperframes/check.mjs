// N6 逐帧（30Hz）校验：镜头参数有限、结构完整；运动模糊子帧够用（每帧位移 ≤ 48px）；字幕都在 80% 标题安全框内
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadData, importPure, report } from "./assets/shared/js/check.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const D = loadData(join(here, "assets/data/n6.js"));
const { makeCam, subframes, matAt } = await importPure(join(here, "world.js"));
const C = makeCam(D), R = report();
let vmax = 0, tmax = 0;
for (let f = 0; f <= D.duration * 30; f++) {
  const t = f / 30, k = C.at(t);
  if (!(k.c.length === 2 && k.c.every(Number.isFinite) && Number.isFinite(k.s) && k.s > 0)) R.flag("镜头参数无效", t);
  const v = C.speed(t); if (v > vmax) { vmax = v; tmax = t; }
  if (v * 0.5 / subframes(v) > 1.5 + 1e-6) R.flag("运动模糊子帧不够（每帧位移 > 48px）", t);
  if (!matAt(D.cay.mk, t).flat().every(Number.isFinite)) R.flag("矩阵非有限值", t);
}
for (const c of D.caps) if (c.y < 108 || c.y + 70 > 972) R.flag(`字幕 ${c.k} 出标题安全框`, c.t0);
R.note(`镜头最快 ${vmax.toFixed(1)} px/帧 @ ${tmax.toFixed(2)}s`);
const n = R.write(join(here, "../../Temp/n6/check.txt"));
console.log(n ? `FAIL ${n}` : "OK");
process.exit(n ? 1 : 0);
