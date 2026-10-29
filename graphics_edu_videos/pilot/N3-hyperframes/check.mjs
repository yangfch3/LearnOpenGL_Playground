// 出片前的空间校验：匹配剪辑主体前后一致、四肢 IK 目标在骨长内。用法：node check.mjs（在本目录）
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const here = new URL(".", import.meta.url);
const A = await import("data:text/javascript;base64," + Buffer.from(readFileSync(new URL("acts.js", here))).toString("base64"));
const D = JSON.parse(readFileSync(new URL("assets/data/n3.js", here), "utf8").replace(/^window\.N3 = /, "").replace(/;\s*$/, ""));
const SC = A.makeScenes(D), B = D.beats, msg = [], FPS = 60;
const frames = (a, b) => { const o = []; for (let t = Math.ceil(a * FPS) / FPS; t < b; t += 1 / FPS) o.push(t); return o; };
const heroAt = (name, t) => {
  const s = SC[name], h = s.hero(t), v = A.view(s.c0, s.cam(t), s.layers[h.layer]), p = A.toScreen(v, h.w);
  return [p[0], p[1], h.r * v.z];
};

// 1. 匹配剪辑：形变窗口内两场主体的屏幕位置与半径
const cuts = [["palm", "spring", B.push1, B.push1 + 0.6, [1240, 300, 90]], ["spring", "summer", B.cut1 - 0.3, B.cut1 + 0.3], ["summer", "autumn", B.cut2 - 0.3, B.cut2 + 0.3],
  ["autumn", "winter", B.cut3 - 0.3, B.cut3 + 0.3]];
for (const [a, b, t0, t1, tgt] of cuts) {
  const T = tgt ?? [...D.C, D.R];
  let worst = 0;
  for (const t of frames(t0, t1)) for (const p of [heroAt(a, t), heroAt(b, t)]) worst = Math.max(worst, ...p.map((v, i) => Math.abs(v - T[i])));
  msg.push(`${worst > 0.5 ? "✗" : "✓"} 匹配剪辑 ${a}→${b}：最大偏差 ${worst.toFixed(3)}px`);
}
{ // 冬 → 3D：月亮停在 C
  let worst = 0;
  for (const t of frames(B.cut4 - 0.3, B.cut4 + 0.3)) {
    const s = SC.winter, v = A.view(s.c0, s.cam(t), s.layers.sky), p = A.toScreen(v, s.MOON);
    worst = Math.max(worst, Math.abs(p[0] - D.C[0]), Math.abs(p[1] - D.C[1]), Math.abs(s.MOON_R * v.z - D.R));
  }
  msg.push(`${worst > 0.5 ? "✗" : "✓"} 匹配剪辑 winter→3D：月亮最大偏差 ${worst.toFixed(3)}px`);
  const S3 = D.sun3, P0 = D.cam3[0][1], sp = A.sunPlace(P0, S3.dir, D.C, D.R, S3.fov, S3.depth), c = A.project(P0, S3.dir, S3.fov, sp.pos);
  const fpx = 540 / Math.tan((S3.fov * Math.PI) / 360), d3 = Math.max(Math.abs(c[0] - D.C[0]), Math.abs(c[1] - D.C[1]), Math.abs((sp.radius * fpx) / c[2] - D.R));
  msg.push(`${d3 > 0.5 ? "✗" : "✓"} 匹配剪辑 winter→3D：3D 太阳投影偏差 ${d3.toFixed(3)}px`);
}

{ // 镜头参数完整
  const bad = [];
  for (const n of ["palm", "spring", "summer", "autumn", "winter", "room"]) for (const t of frames(0, D.duration)) { const c = SC[n].cam(t); if (c.length !== 3 || !c.every(Number.isFinite)) { bad.push(`${n}@${t.toFixed(2)}`); break; } }
  msg.push(bad.length ? `✗ 镜头参数无效 ${bad.join(" ")}` : "✓ 镜头参数完整");
}

// 2. 四肢够不到目标（同一肢体只记首次时刻与帧数）
const wins = { spring: [B.push1, B.cut1 + 0.3], summer: [B.cut1 - 0.3, B.cut2 + 0.3], autumn: [B.cut2 - 0.3, B.cut3 + 0.3], winter: [B.cut3 - 0.3, B.cut4 + 0.3], room: [B.room, B.palm2] };
const first = {};
for (const [name, [t0, t1]] of Object.entries(wins)) {
  for (const t of frames(t0, t1)) {
    const cast = SC[name].cast(t);
    for (const [who, P] of Object.entries(cast)) {
      if (!P || !P.H) continue;
      for (const e of A.solve(P).err) {
        const k = `${name}.${who}.${e.split(" ")[0]}`;
        first[k] = first[k] || { t, n: 0, max: 0 };
        first[k].n++; first[k].max = Math.max(first[k].max, parseFloat(e.split("+")[1]));
      }
    }
  }
}
const ik = Object.entries(first);
msg.push(ik.length ? `✗ IK 越界 ${ik.length} 处` : "✓ IK 全部在骨长内");
for (const [k, v] of ik) msg.push(`  ${k} 首次 ${v.t.toFixed(2)}s，${v.n} 帧，最大 ${v.max.toFixed(1)}px`);

mkdirSync(new URL("../../Temp/", here), { recursive: true });
writeFileSync(new URL("../../Temp/n3_check.txt", here), msg.join("\n"), "utf8");
const bad = msg.some((m) => m.startsWith("✗"));
console.log(bad ? "FAIL" : "OK", "-> Temp/n3_check.txt");
process.exit(bad ? 1 : 0);
