// 空间校验：角色不进障碍物、不相互重叠；环绕镜头不进物体、视线不被挡；镜头参数完整
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./assets/data/n4.js", import.meta.url), "utf8");
const D = JSON.parse(src.slice(src.indexOf("=") + 1).trim().replace(/;$/, ""));
const { makePath } = await import("data:text/javascript," + encodeURIComponent(readFileSync(new URL("./path.js", import.meta.url), "utf8")));
const P = makePath(D), L = D.lay, err = [];
const H = L.house, boxes = [{ n: "house", x0: H.x - H.w / 2, x1: H.x + H.w / 2, z0: H.z - H.d / 2, z1: H.z + H.d / 2, y1: H.h + 1.2 },
  ...L.stalls.map((s, i) => ({ n: "stall" + i, x0: s.x - s.w / 2 - 0.05, x1: s.x + s.w / 2 + 0.05, z0: s.z - s.d / 2, z1: s.z + s.d / 2, y1: 2.0 }))];
const circles = [{ n: "stone", x: L.stone.x, z: L.stone.z, r: L.stone.r }, { n: "trunk", x: L.tree.x, z: L.tree.z, r: 0.25 }];
const boxDist = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
for (let t = 0; t <= D.duration; t += 1 / 30) {
  const c = P.cam(t);
  if (!(c.T.length === 3 && [c.hh, c.k, c.yaw, c.pitch, ...c.T].every(Number.isFinite))) err.push(`${t.toFixed(2)} 镜头参数无效`);
  const pos = {};
  for (const who of ["hero", "girl", "cat"]) {
    const p = P.at(who, t), r = D.radius[who]; pos[who] = p;
    for (const b of boxes) if (boxDist(b, p.x, p.z) < r) err.push(`${t.toFixed(2)} ${who} 进入 ${b.n}`);
    for (const o of circles) {
      if (who === "cat" && o.n === "stone") continue; // 猫本来就在石头上
      if (Math.hypot(p.x - o.x, p.z - o.z) < r + o.r) err.push(`${t.toFixed(2)} ${who} 碰到 ${o.n}`);
    }
    if (t >= D.beats.roll1 && t < D.beats.melt1 && Math.hypot(p.x - L.snowman.x, p.z - L.snowman.z) < r + L.snowman.r) err.push(`${t.toFixed(2)} ${who} 进入雪人`);
  }
  if (Math.hypot(pos.hero.x - pos.girl.x, pos.hero.z - pos.girl.z) < 0.4) err.push(`${t.toFixed(2)} 男孩与女孩重叠`);
  for (const p of D.crowd) for (const who of ["hero", "girl"]) if (Math.hypot(pos[who].x - p.x, pos[who].z - p.z) < 0.4 && P.season(t) < 2.9) err.push(`${t.toFixed(2)} ${who} 撞到群众`);
  // 透视段：机位不进物体，看雪人的视线不穿过树冠与房子
  const e = P.eye(c);
  if (e && c.k > 0.05) {
    for (const b of boxes) if (boxDist(b, e[0], e[2]) < 0.3 && e[1] < b.y1) err.push(`${t.toFixed(2)} 机位进入 ${b.n}`);
    const S = [L.snowman.x, 0.8, L.snowman.z], cr = [L.tree.x, 3.0, L.tree.z];
    for (let u = 0.05; u < 0.95; u += 0.05) {
      const q = e.map((v, i) => v + (S[i] - v) * u);
      if (Math.hypot(q[0] - cr[0], q[1] - cr[1], q[2] - cr[2]) < L.tree.r + 0.2) { err.push(`${t.toFixed(2)} 树冠挡住雪人`); break; }
      if (boxes.some((b) => boxDist(b, q[0], q[2]) < 0.05 && q[1] < b.y1)) { err.push(`${t.toFixed(2)} 物体挡住雪人`); break; }
    }
  }
}
const uniq = [...new Set(err.map((s) => s.replace(/^[\d.]+ /, "")))];
console.log(err.length ? `FAIL ${err.length}\n` + uniq.map((u) => u + " @ " + err.filter((s) => s.endsWith(u)).map((s) => s.split(" ")[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join("–")).join("\n") : "OK");
process.exit(err.length ? 1 : 0);
