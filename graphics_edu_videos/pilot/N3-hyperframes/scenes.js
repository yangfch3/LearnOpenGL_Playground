// 2D 各场：静态水彩画面建一次，逐帧只更新镜头、人物与道具
import { el, g, wrect, well, wpoly, bands, line, shade, mixC, mulberry32, curve } from "./paint.js";
import { makeRig } from "./rig.js";
import { view, solve, seg, clamp, lerp, pulse, E } from "./acts.js";

const SKIN = "#f2d2b6";
export const LOOKS = {
  spring: { top: "#f2c14e", sleeve: "short", bottom: { kind: "dress", color: "#f2c14e" }, shoes: "#d9705a", pack: "#d9483b" },
  summer: { top: "#f08a6a", sleeve: "short", bottom: { kind: "shorts", color: "#5f86b8" }, shoes: SKIN, hat: "straw" },
  autumn: { top: "#3e5a8a", bottom: { kind: "skirt", color: "#b0563f" }, legs: "#f4efe6", shoes: "#5a3a2a", pack: "#d9483b" },
  winter: { top: "#d9483b", coat: "#d9483b", bottom: { kind: "coat", color: "#4a4f5e" }, hat: "beanie", hatColor: "#f4efe6", scarf: "#f4efe6", mitten: "#d9483b", shoes: "#5a3a2a" },
  room: { top: "#9cc79a", bottom: { kind: "skirt", color: "#5f86b8" }, legs: "#f4efe6", shoes: "#d9705a" },
  neighbor: { hair: "#d8d4cc", hairStyle: "old", top: "#6f8f5a", bottom: { kind: "pants", color: "#7a5a42" }, glasses: true, shoes: "#5a4a3a" },
  friend: { hair: "#2f2420", hairStyle: "short", top: "#5fa8d8", sleeve: "short", bottom: { kind: "shorts", color: "#f2c14e" }, shoes: SKIN },
  dad: { hair: "#2f2420", hairStyle: "short", top: "#5a6b7e", coat: "#5a6b7e", bottom: { kind: "coat", color: "#3a3f4a" }, scarf: "#c8a24a", shoes: "#3a2e2a" },
  mom: { hair: "#3b2a20", hairStyle: "bun", top: "#e2cfb0", coat: "#e2cfb0", bottom: { kind: "coat", color: "#6a5a50" }, scarf: "#b85a6a", shoes: "#5a3a2a" },
  amom: { hair: "#3b2a20", hairStyle: "bun", top: "#b07c6a", bottom: { kind: "skirt", color: "#6a5a50" }, legs: "#5a4a44", shoes: "#3a2e2a" },
  akid: { hair: "#2f2420", top: "#f2a7b5", bottom: { kind: "skirt", color: "#8a6aa0" }, shoes: "#d9705a" },
};
const SUN = "#f6c453";

function stage(svg, def) {
  const root = g(svg, { display: "none" }), layers = {};
  for (const n in def.layers) layers[n] = g(root);
  const place = (t) => {
    const cam = def.cam(t);
    for (const n in layers) {
      const v = view(def.c0, cam, def.layers[n]);
      layers[n].setAttribute("transform", `translate(960,540) scale(${v.z.toFixed(5)}) translate(${(-v.ox).toFixed(2)},${(-v.oy).toFixed(2)})`);
    }
  };
  return { root, layers, place };
}
const put = (e, x, y, rot = 0, s = 1) => e.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(rot * 57.2958).toFixed(2)}) scale(${s})`);
const disc = (p, r, c, o) => well(p, 0, 0, r, r, c, { amp: 1.6, step: 14, ...o });

// 柠檬形：p = 0 为圆，1 为种子
function seedPath(rx, ry, p) {
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 6.2832, s = Math.sin(a);
    pts.push([rx * Math.cos(a), ry * s * Math.abs(s) ** (0.45 * p)]);
  }
  return curve(pts);
}

// ---- 开场 / 结尾：手心 ----
function buildPalm(svg, def, D) {
  const st = stage(svg, def), L = st.layers.hand, B = D.beats;
  const warm = g(L), cool = g(L, { opacity: 0 });
  wrect(warm, -3000, -3000, 8000, 7000, "#f3e3cc", { edge: 0, bloom: 0 });
  [[300, 260, 420, "#f6d9c4"], [1500, 220, 380, "#e9e2c8"], [1650, 900, 460, "#f2d7b8"], [200, 900, 380, "#efdcc0"]].forEach(([x, y, r, c]) => well(warm, x, y, r, r * 0.8, c, { edge: 0, a: 0.8 }));
  wrect(cool, -3000, -3000, 8000, 7000, "#e3ebee", { edge: 0, bloom: 0 });
  [[350, 300, 460, "#d6e4ea"], [1550, 260, 420, "#eef1ec"], [1600, 950, 420, "#d9e6e2"]].forEach(([x, y, r, c]) => well(cool, x, y, r, r * 0.8, c, { edge: 0, a: 0.8 }));
  const hand = g(L), sk = "#efbf9a", sd = "#dca47e";
  wpoly(hand, [[700, 1180], [760, 900], [1180, 880], [1290, 1180]], sd, { edge: 0 });
  [[-62, 690, 520, 640, 300], [-28, 820, 470, 790, 250], [8, 960, 455, 950, 235], [40, 1090, 480, 1105, 260]].forEach(([, bx, by, tx, ty]) => line(hand, [[bx, by + 60], [(bx + tx) / 2, (by + ty) / 2], [tx, ty]], sk, 84));
  [[690, 640, 640, 300], [820, 790, 790, 250], [960, 950, 950, 235], [1090, 1105, 1105, 260]].forEach(([bx, , tx, ty]) => well(hand, tx - (tx - bx) * 0.02, ty, 30, 26, shade(sk, 0.15), { edge: 0, a: 0.5 }));
  well(hand, 975, 660, 260, 190, sk, { edge: 1.5 });
  line(hand, [[1210, 760], [1300, 640], [1360, 520]], sk, 96);
  [[[800, 620], [930, 640], [1060, 600]], [[830, 700], [960, 730], [1090, 690]]].forEach((p) => line(hand, p, sd, 6, { "stroke-opacity": 0.6 }));
  const seed = g(L), seedP = el("path", { stroke: "#5e3b26", "stroke-width": 2, "stroke-opacity": 0.5 }, seed), seedHi = el("path", { fill: "#ffffff", "fill-opacity": 0.25 }, seed);
  return {
    root: st.root,
    update(t) {
      st.place(t);
      const s = def.seed(t), m = s.morph, end = t >= B.palm2;
      warm.setAttribute("opacity", end ? 0 : 1); cool.setAttribute("opacity", end ? 1 : 0);
      hand.setAttribute("opacity", end ? 1 : 1 - seg(t, B.push0 + 1.0, B.push1, E.lin));
      const rx = lerp(30, 24, m), ry = lerp(19, 24, m);
      seedP.setAttribute("d", seedPath(rx, ry, 1 - m)); seedP.setAttribute("fill", mixC("#8a5a3a", SUN, m));
      seedHi.setAttribute("d", seedPath(rx * 0.55, ry * 0.3, 1 - m)); seedHi.setAttribute("transform", `translate(${-rx * 0.15},${-ry * 0.35})`);
      put(seed, s.w[0], s.w[1], -0.35 * (1 - m) + s.spin);
    },
  };
}

function cloud(p, x, y, s, c = "#ffffff") {
  const gr = g(p);
  [[0, 0, 90, 46], [-80, 18, 64, 34], [80, 14, 70, 38], [30, -30, 56, 36]].forEach(([dx, dy, rx, ry]) => well(gr, x + dx * s, y + dy * s, rx * s, ry * s, c, { edge: 0, a: 0.85, bloom: 0.2 }));
  return gr;
}
function blocks(p, x0, x1, yTop, yBot, cols, win, r) {
  for (let x = x0; x < x1;) {
    const w = 140 + r() * 160, top = yTop + r() * (yBot - yTop) * 0.35, c = cols[Math.floor(r() * cols.length)];
    wrect(p, x, top, w, 1800, c, { amp: 1.5, edge: 1.5 });
    for (let wy = top + 30; wy < yBot + 400; wy += 46) for (let wx = x + 18; wx < x + w - 30; wx += 38) if (r() < 0.7) el("rect", { x: wx, y: wy, width: 18, height: 24, fill: win, "fill-opacity": 0.75 }, p);
    x += w + 10 + r() * 30;
  }
}

// ---- 春·阳台 ----
function buildSpring(svg, def, D) {
  const st = stage(svg, def), { sky, city, bal, near } = st.layers, B = D.beats, r = mulberry32(31);
  bands(sky, -1500, 3500, [-1700, -900, -300, 300, 800], ["#b7d6e6", "#c6e0ec", "#d6e9ef", "#e8f0ea"]);
  [[300, -220], [780, 40], [1750, -160], [2250, 180], [-300, 120]].forEach(([x, y]) => cloud(sky, x, y, 1));
  const sun = g(sky);
  disc(sun, 90, SUN); well(sun, -18, -20, 50, 44, "#fbe08a", { edge: 0, a: 0.6 }); put(sun, 1240, 120);
  blocks(city, -900, 3000, 520, 760, ["#c9d6dc", "#e3cdbd", "#b9cbd3", "#d8d0c4"], "#f4f1ea", r);
  for (let x = -800; x < 2900; x += 120 + r() * 120) {
    const y = 830 + r() * 40, s = 45 + r() * 30;
    line(city, [[x, y + s + 60], [x, y]], "#8a6a52", 8);
    for (let k = 0; k < 3; k++) well(city, x + (k - 1) * s * 0.6, y - k * 10 - (k === 1 ? 18 : 0), s * 0.7, s * 0.55, r() < 0.5 ? "#f2b8c2" : "#a9cf8a", { a: 0.95 });
  }
  // 阳台：地面、栏杆、晾衣绳
  wrect(bal, -800, 900, 3600, 700, "#d9c4a6", { amp: 1, bloom: 0.2 });
  for (let x = -760; x < 1300; x += 120) el("path", { d: `M${x},905L${x - 60},1300`, stroke: "#c8b394", "stroke-width": 3 }, bal);
  for (let y = 960; y < 1300; y += 70) el("path", { d: `M-800,${y}L1300,${y}`, stroke: "#c8b394", "stroke-width": 3 }, bal);
  for (let x = -780; x < 1295; x += 46) el("rect", { x, y: 618, width: 7, height: 280, fill: "#6a767e" }, bal);
  wrect(bal, -800, 604, 2100, 16, "#5f6b73", { amp: 0.6, edge: 1 });
  wrect(bal, -800, 888, 2100, 22, "#c9b495", { amp: 0.8 });
  line(bal, [[-300, 290], [500, 325], [1290, 296]], "#8a7a6a", 3);
  const clothes = [[380, 312, "#9cc7d8", 90, 120], [640, 322, "#f2a7b5", 110, 90], [880, 316, "#f2c14e", 50, 60]].map(([x, y, c, w, h]) => {
    const gr = g(bal); wrect(gr, -w / 2, 0, w, h, c, { amp: 2 }); el("rect", { x: -w / 2 + 6, y: -6, width: 6, height: 14, fill: "#c8564a" }, gr); return { gr, x, y };
  });
  // 邻居一侧：墙头露出的天竺葵与绿植
  const nbPlants = g(bal);
  [[1640, 660], [1700, 640], [1760, 666], [1820, 650]].forEach(([x, y]) => { well(nbPlants, x, y, 46, 30, "#6f9a5a"); well(nbPlants, x - 8, y - 18, 14, 12, "#d9483b", { edge: 1 }); well(nbPlants, x + 18, y - 10, 12, 10, "#e8645a", { edge: 1 }); });
  for (let k = 0; k < 5; k++) line(nbPlants, [[1900 + k * 14, 690], [1880 + k * 30, 600 - k * 18], [1860 + k * 40, 520 - k * 10]], "#5f8a4f", 14);
  const nb = makeRig(bal, { ...LOOKS.neighbor, kind: "adult" });
  const nbCan = g(nb.slot);
  wrect(nbCan, -30, 6, 60, 58, "#6f9a8a", { amp: 1 }); line(nbCan, [[24, 20], [60, 0], [88, -14]], "#5f8a7a", 9); line(nbCan, [[-26, 8], [0, -16], [26, 8]], "#5f8a7a", 6);
  wrect(bal, 1300, 688, 1400, 800, "#efd2b8", { amp: 1.2 }); wrect(bal, 1292, 676, 1420, 18, "#e2c2a6", { amp: 0.8 });
  el("path", { d: "M1300,1000L1300,1400L1180,1400Z", fill: "#3a2a24", "fill-opacity": 0.08 }, bal);
  // 凳子、花盆、小水壶
  wrect(bal, 1125, 936, 160, 14, "#b4825a", { amp: 0.8 }); wrect(bal, 1136, 948, 12, 52, "#9a6b45", { amp: 0.5 }); wrect(bal, 1262, 948, 12, 52, "#9a6b45", { amp: 0.5 });
  wpoly(bal, [[1163, 872], [1247, 872], [1237, 936], [1173, 936]], "#d9825a", { amp: 1 }); wrect(bal, 1157, 864, 96, 14, "#c96f48", { amp: 0.8 });
  well(bal, 1205, 868, 40, 6, "#6e4a30", { edge: 0, bloom: 0 });
  const girl = makeRig(bal, { ...LOOKS.spring });
  const can = g(bal);
  wrect(can, -22, 4, 44, 40, "#f2c14e", { amp: 0.8 }); line(can, [[18, 16], [40, 2], [50, -6]], "#e0ab3a", 7); el("circle", { cx: 52, cy: -7, r: 7, fill: "#e0ab3a" }, can);
  line(can, [[-15, 6], [0, -10], [15, 6]], "#e0ab3a", 5);
  const stream = el("path", { fill: "none", stroke: "#7cc4e4", "stroke-width": 4, "stroke-dasharray": "5 9", "stroke-linecap": "round" }, bal);
  const seedling = el("ellipse", { rx: 5, ry: 3.5, fill: "#8a5a3a" }, bal);
  const petals = [...Array(16)].map(() => ({ e: well(bal, 0, 0, 7, 4.5, "#f6c2cc", { edge: 0, bloom: 0, amp: 0.4, step: 6 }), x0: r() * 2400 - 200, y0: r() * 700, v: 40 + r() * 50, ph: r() * 6.28 }));
  // 前景：龟背竹
  [[-120, 1000, -0.6], [60, 1060, -0.2], [220, 1110, 0.3]].forEach(([x, y, a]) => {
    const lf = g(near); well(lf, 0, -130, 110, 150, "#4f7a52", { amp: 4 }); line(lf, [[0, 30], [0, -250]], "#3f6a44", 6); put(lf, x, y, a);
  });
  return {
    root: st.root,
    update(t) {
      st.place(t);
      const c = def.cast(t), J = solve(c.girl);
      girl.update(J); nb.update(solve(c.nb));
      const nc = def.nbCan(t); put(nbCan, 0, 0); nbCan.setAttribute("transform", `translate(${c.nb.hN[0]},${c.nb.hN[1]}) rotate(${(nc.tilt * 57.3).toFixed(1)})`);
      const cs = def.can(t), grip = cs.held ? J.handN : [def.CAN[0], def.CAN[1] - 44];
      put(can, grip[0], grip[1], cs.tilt);
      if (cs.pour) {
        const a = cs.tilt, tip = [grip[0] + 52 * Math.cos(a) + 7 * Math.sin(a), grip[1] + 52 * Math.sin(a) - 7 * Math.cos(a)];
        stream.setAttribute("d", `M${tip[0].toFixed(1)},${tip[1].toFixed(1)}Q${(tip[0] + 6).toFixed(1)},${(tip[1] + 6).toFixed(1)} ${(tip[0] + 4).toFixed(1)},870`);
        stream.setAttribute("stroke-dashoffset", (-t * 220).toFixed(1)); stream.setAttribute("display", "inline");
      } else stream.setAttribute("display", "none");
      const sd = t < B.drop ? J.handN : [1205, lerp(866, 880, seg(t, B.drop, B.drop + 0.15, E.in2))];
      seedling.setAttribute("cx", sd[0].toFixed(1)); seedling.setAttribute("cy", (sd[1] - (t < B.drop ? 6 : 0)).toFixed(1));
      seedling.setAttribute("display", t < B.drop + 0.16 ? "inline" : "none");
      clothes.forEach((cl, k) => put(cl.gr, cl.x, cl.y, 0.05 * Math.sin(t * 1.4 + k * 1.7)));
      petals.forEach((p) => {
        const y = (p.y0 + p.v * t) % 760 + 200, x = p.x0 - 30 * t + 30 * Math.sin(t * 1.3 + p.ph);
        put(p.e, x, y, t * 1.5 + p.ph);
      });
    },
  };
}

function melon(p, r) {
  const gr = g(p);
  disc(gr, r, "#4f9a4a");
  for (let k = -2; k <= 2; k++) el("path", { d: `M${k * r * 0.36},${-r * 0.96}C${k * r * 0.5 + r * 0.12},${-r * 0.3} ${k * r * 0.5 - r * 0.12},${r * 0.3} ${k * r * 0.36},${r * 0.96}`, fill: "none", stroke: "#2f6b34", "stroke-width": r * 0.13, "stroke-linecap": "round", "stroke-opacity": 0.85 }, gr);
  well(gr, -r * 0.35, -r * 0.4, r * 0.28, r * 0.18, "#ffffff", { edge: 0, a: 0.35, bloom: 0, amp: 0.5, step: 8 });
  return gr;
}

// ---- 夏·海边 ----
function buildSummer(svg, def, D) {
  const st = stage(svg, def), { sky, sea, beach, near } = st.layers, B = D.beats, r = mulberry32(41);
  bands(sky, -1500, 3500, [-1200, -300, 150, 520], ["#8fcbe3", "#a8d8ea", "#cfeaf1"]);
  [[200, 150], [900, 60], [1600, 200], [2300, 90]].forEach(([x, y]) => cloud(sky, x, y, 1.2));
  wrect(sea, -1500, 470, 5000, 400, "#4aa3c4", { amp: 3, bloom: 0.4 });
  wrect(sea, -1500, 640, 5000, 240, "#6fb9d2", { amp: 6, edge: 0, a: 0.8 });
  well(sea, 1650, 478, 260, 34, "#7aa6a0", { a: 0.9 });
  const boat = g(sea); wpoly(boat, [[-40, 0], [40, 0], [28, 14], [-28, 14]], "#f4f1e8"); wpoly(boat, [[0, -70], [0, -4], [44, -4]], "#ffffff");
  wrect(beach, -1500, 760, 5000, 800, "#f1d9a6", { amp: 2, bloom: 0.3 });
  wrect(beach, -1500, 758, 5000, 48, "#e3c38d", { amp: 3, edge: 0 });
  const foam = [0, 1, 2].map((k) => line(beach, [...Array(30)].map((_, i) => [-1500 + i * 180, 0 + 8 * Math.sin(i * 1.7 + k)]), "#ffffff", 7 - 2 * k, { "stroke-opacity": 0.85 }));
  for (let k = 0; k < 40; k++) well(beach, r() * 3000 - 400, 830 + r() * 400, 6 + r() * 6, 3 + r() * 3, "#e6c88f", { edge: 0, bloom: 0, step: 8 });
  // 遮阳伞、毛巾、冷藏箱、水桶
  el("ellipse", { cx: 1680, cy: 955, rx: 230, ry: 30, fill: "#d9bb84", "fill-opacity": 0.7 }, beach);
  wrect(beach, 1640, 930, 260, 46, "#5f86b8", { amp: 1 }); for (let x = 1660; x < 1900; x += 40) el("rect", { x, y: 932, width: 16, height: 42, fill: "#f4f1e8", "fill-opacity": 0.8 }, beach);
  wrect(beach, 1860, 860, 110, 80, "#e8645a", { amp: 1 }); wrect(beach, 1856, 852, 118, 16, "#f4f1e8", { amp: 0.6 });
  line(beach, [[1700, 950], [1700, 560]], "#f4f1e8", 9);
  const can = g(beach);
  for (let k = 0; k < 6; k++) { const a0 = Math.PI + (k * Math.PI) / 6, a1 = a0 + Math.PI / 6; wpoly(can, [[0, 0], [230 * Math.cos(a0), 90 * Math.sin(a0)], [230 * Math.cos(a1), 90 * Math.sin(a1)]], k % 2 ? "#f4f1e8" : "#d9483b", { amp: 1, step: 40 }); }
  put(can, 1700, 570);
  wpoly(beach, [[1452, 838], [1588, 838], [1572, 948], [1468, 948]], "#3f6fa8", { amp: 0.8 });
  el("ellipse", { cx: 1520, cy: 840, rx: 68, ry: 12, fill: "#2f5a8a" }, beach);
  const kids = g(beach), girl = makeRig(kids, LOOKS.summer), friend = makeRig(kids, LOOKS.friend);
  const shallow = wrect(beach, -1500, 792, 2600, 26, "#6fb9d2", { amp: 2, edge: 0, a: 0.55, bloom: 0 });
  const mel = melon(beach, 40);
  const water = el("ellipse", { rx: 66, ry: 11, fill: "#8fd0e8", "fill-opacity": 0.75 }, beach);
  const front = wpoly(beach, [[1452, 852], [1588, 852], [1572, 948], [1468, 948]], "#5a8fc8", { amp: 0.8 });
  el("path", { d: "M1452,852L1588,852", stroke: "#2f5a8a", "stroke-width": 6 }, front);
  const drops = def.drops.map((d) => ({ d, e: el("circle", { r: d.s, fill: "#bfe6f2" }, beach) }));
  const drips = [...Array(9)].map(() => el("circle", { r: 4.5, fill: "#bfe6f2" }, beach));
  [[60, 1100], [200, 1140], [1900, 1120]].forEach(([x, y]) => { for (let k = 0; k < 6; k++) line(near, [[x + k * 10, y], [x + k * 16 - 30, y - 90 - k * 8]], "#9aa86a", 7); });
  well(near, 1650, 1110, 30, 20, "#f2a7b5"); well(near, 1760, 1130, 22, 16, "#f4e4c8");
  return {
    root: st.root,
    update(t) {
      st.place(t);
      put(boat, 600 + 12 * t, 492);
      foam.forEach((f, k) => f.setAttribute("transform", `translate(${(Math.sin(t * 0.4 + k) * 30).toFixed(1)},${(772 + k * 12 + 10 * Math.sin(t * 1.1 + k * 0.9)).toFixed(1)})`));
      const c = def.cast(t), m = def.melon(t);
      girl.update(solve(c.girl)); friend.update(solve(c.friend));
      shallow.setAttribute("display", t < B.run0s + 0.5 ? "inline" : "none");
      put(mel, m[0], m[1], 0.06 * Math.sin(t * 1.3));
      const inB = t < B.lift0 + 0.15;
      water.setAttribute("cx", 1520); water.setAttribute("cy", inB ? 852 : 846); front.setAttribute("display", "inline");
      drops.forEach(({ d, e }) => {
        const u = t - d.t0, on = u > 0 && u < 0.75;
        e.setAttribute("display", on ? "inline" : "none");
        if (on) { e.setAttribute("cx", (d.x0 + d.vx * u).toFixed(1)); e.setAttribute("cy", (d.y0 + d.vy * u + 900 * u * u).toFixed(1)); }
      });
      const dp = def.drips(t);
      drips.forEach((e, k) => { const q = dp[k]; e.setAttribute("display", q && q[1] < 945 ? "inline" : "none"); if (q) { e.setAttribute("cx", q[0].toFixed(1)); e.setAttribute("cy", q[1].toFixed(1)); } });
    },
  };
}

function lantern(p, r) {
  const gr = g(p);
  el("path", { d: `M0,${-r - 18}L0,${-r}`, stroke: "#5a3a2a", "stroke-width": 3 }, gr);
  disc(gr, r, "#d9483b");
  well(gr, 0, 2, r * 0.55, r * 0.6, "#f2804f", { edge: 0, a: 0.6, bloom: 0 });
  for (const k of [-0.6, 0, 0.6]) el("path", { d: `M${k * r},${-r * 0.92}Q${k * r * 1.5},0 ${k * r},${r * 0.92}`, fill: "none", stroke: "#a8302a", "stroke-width": 2.5, "stroke-opacity": 0.7 }, gr);
  wrect(gr, -r * 0.42, -r - 6, r * 0.84, 10, "#e0b04a", { amp: 0.5, edge: 1 });
  wrect(gr, -r * 0.42, r - 4, r * 0.84, 10, "#e0b04a", { amp: 0.5, edge: 1 });
  line(gr, [[0, r + 6], [0, r + 34]], "#e0b04a", 5);
  return gr;
}
function ginkgo(p, x, y, s, r) {
  const gr = g(p);
  line(gr, [[x, y], [x + 4, y - 200 * s], [x - 6, y - 360 * s]], "#6e4a30", 22 * s);
  for (let k = 0; k < 7; k++) well(gr, x + (r() - 0.5) * 260 * s, y - 360 * s - r() * 200 * s, (70 + r() * 50) * s, (60 + r() * 40) * s, r() < 0.5 ? "#e9b949" : "#f2cf6a");
  return gr;
}

// ---- 秋·街道 ----
function buildAutumn(svg, def, D) {
  const st = stage(svg, def), { sky, far, mid, near } = st.layers, B = D.beats, r = mulberry32(53);
  bands(sky, -1500, 4500, [-1500, -500, 150, 520, 760], ["#d99a8e", "#e7ad8e", "#f2c58f", "#f7dcae"]);
  const v = view(def.c0, def.cam(B.raise1), 0.15), moonW = [(1390 - 960) / v.z + v.ox, (230 - 540) / v.z + v.oy];
  const moon = g(sky); disc(moon, 46, "#f8efd2"); well(moon, -12, -8, 10, 8, "#ece0bc", { edge: 0, bloom: 0 }); put(moon, moonW[0], moonW[1]);
  for (let x = -1000; x < 3600;) {
    const w = 200 + r() * 160, top = 430 + r() * 150;
    wpoly(far, [[x - 20, top + 30], [x + w / 2, top - 40], [x + w + 20, top + 30]], "#8f6560", { amp: 1.5 });
    wrect(far, x, top + 25, w, 900, r() < 0.5 ? "#b07a6a" : "#a4706a", { amp: 1.5 });
    for (let k = 0; k < 4; k++) if (r() < 0.75) el("rect", { x: x + 20 + k * (w / 4), y: top + 70 + r() * 80, width: 22, height: 28, fill: "#ffd38a" }, far);
    x += w + 14;
  }
  for (let x = -900; x < 3500; x += 46) el("circle", { cx: x, cy: 520 + 30 * Math.sin((x / 460) * Math.PI) ** 2, r: 7, fill: "#d9483b", "fill-opacity": 0.85 }, far);
  // 街边店铺
  const SHOP = ["#e9c9a0", "#d9a77f", "#c98f6b", "#e3b98a", "#d8b48c"], AWN = [["#d9483b", "#f4ead8"], ["#5f8a6a", "#f4ead8"], ["#e0a040", "#f4ead8"]];
  for (let x = -200, i = 0; x < 4600; i++) {
    const w = 420 + r() * 100, c = SHOP[i % SHOP.length], [a1, a2] = AWN[i % 3];
    wrect(mid, x, 360, w, 560, c, { amp: 1.5 });
    wrect(mid, x + 30, 620, w - 160, 220, "#ffe0a0", { amp: 1 });
    for (let k = 0; k < 4; k++) well(mid, x + 70 + k * ((w - 220) / 4), 790, 26, 18, i % 2 ? "#c98a4a" : "#8a5a8a", { amp: 0.8 });
    if (i % 3 === 1) for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) el("rect", { x: x + 44 + k * 26, y: 640 + row * 52, width: 18, height: 42, fill: ["#7a5a8a", "#4a7a8a", "#c8564a", "#e0a040"][(k + row) % 4], "fill-opacity": 0.8 }, mid);
    wrect(mid, x + w - 110, 640, 80, 260, "#7a5040", { amp: 1 });
    for (let k = 0; k * 40 < w; k++) wrect(mid, x + k * 40, 560, 40, 56, k % 2 ? a2 : a1, { amp: 0.6, edge: 1, bloom: 0 });
    x += w + 20;
  }
  [700, 1950, 3200, 4300].forEach((x) => ginkgo(mid, x, 905, 1, r));
  wrect(mid, -800, 900, 6000, 120, "#c9a27e", { amp: 1 });
  wrect(mid, -800, 1010, 6000, 20, "#a8825f", { amp: 0.8 });
  wrect(mid, -800, 1026, 6000, 400, "#8a7a70", { amp: 1 });
  for (let k = 0; k < 90; k++) well(mid, r() * 5200 - 400, 920 + r() * 85, 9, 5, r() < 0.5 ? "#e9b949" : "#f2cf6a", { edge: 0, bloom: 0, step: 8 });
  // 人物与灯笼
  const mom = makeRig(mid, { ...LOOKS.amom }), kid = makeRig(mid, LOOKS.akid);
  const rabbit = g(kid.slot); well(rabbit, 0, 0, 30, 22, "#f8f4ec"); well(rabbit, 20, -24, 6, 16, "#f8f4ec"); well(rabbit, 10, -26, 6, 16, "#f6c2cc"); el("circle", { cx: 22, cy: -4, r: 3, fill: "#d9483b" }, rabbit);
  const girl = makeRig(mid, LOOKS.autumn), stick = el("path", { stroke: "#9a6b45", "stroke-width": 5, "stroke-linecap": "round" }, girl.slot);
  const strg = el("path", { stroke: "#5a3a2a", "stroke-width": 2.5 }, mid), lan = lantern(mid, 40);
  // 前景：路灯、落叶
  for (let x = 200; x < 7000; x += 1150) {
    const p = g(near); line(p, [[x, 1300], [x, 420]], "#3e4a3e", 18); line(p, [[x, 430], [x + 60, 400], [x + 110, 420]], "#3e4a3e", 10);
    wrect(p, x + 90, 418, 44, 34, "#ffe0a0", { amp: 0.6 });
  }
  const leaves = [...Array(26)].map(() => ({ e: well(near, 0, 0, 12, 8, r() < 0.5 ? "#e9b949" : "#f0c24a", { edge: 1, bloom: 0, step: 8 }), x0: r() * 5000, y0: r() * 1000, v: 50 + r() * 60, ph: r() * 6.28 }));
  return {
    root: st.root,
    update(t) {
      st.place(t);
      const c = def.cast(t), L = def.lantern(t);
      mom.update(solve(c.mom));
      const kj = solve(c.kid); kid.update(kj); put(rabbit, kj.handN[0] - 30, kj.handN[1] + 40, 0.1 * Math.sin(t * 5));
      girl.update(solve(c.girl));
      stick.setAttribute("d", `M${L.hand[0].toFixed(1)},${L.hand[1].toFixed(1)}L${L.tip[0].toFixed(1)},${L.tip[1].toFixed(1)}`);
      strg.setAttribute("d", `M${L.tip[0].toFixed(1)},${L.tip[1].toFixed(1)}L${L.w[0].toFixed(1)},${(L.w[1] - 40).toFixed(1)}`);
      put(lan, L.w[0], L.w[1], -L.sw);
      leaves.forEach((l) => put(l.e, l.x0 + 40 * Math.sin(t * 1.1 + l.ph), ((l.y0 + l.v * t) % 1100) - 60, t * 2 + l.ph));
    },
  };
}

// ---- 冬·车站 ----
function buildWinter(svg, def, D) {
  const st = stage(svg, def), { sky, far, plat, near } = st.layers, B = D.beats, r = mulberry32(67);
  bands(sky, -1500, 4000, [-1800, -700, 0, 420, 700], ["#1f2a42", "#26324c", "#2f3d5a", "#3e4f6e"]);
  for (let k = 0; k < 60; k++) el("circle", { cx: r() * 4500 - 1200, cy: r() * 1100 - 1100 + 500, r: 1.5 + r() * 2, fill: "#f4ecd0", "fill-opacity": 0.5 + 0.4 * r() }, sky);
  const moon = g(sky); disc(moon, def.MOON_R, "#f4ecd0");
  [[-30, -20, 18], [28, 22, 12], [10, -42, 9], [-20, 38, 8]].forEach(([x, y, s]) => well(moon, x, y, s, s * 0.8, "#e4d9b6", { edge: 0, bloom: 0, step: 8 }));
  put(moon, def.MOON[0], def.MOON[1]);
  for (let x = -900; x < 3400;) {
    const w = 150 + r() * 170, top = 330 + r() * 200;
    wrect(far, x, top, w, 900, r() < 0.5 ? "#2f3b54" : "#36435f", { amp: 1.2, edge: 0 });
    wrect(far, x - 4, top - 8, w + 8, 16, "#dfe6ee", { amp: 1.5, edge: 0, bloom: 0 });
    for (let wy = top + 30; wy < 900; wy += 44) for (let wx = x + 16; wx < x + w - 24; wx += 34) if (r() < 0.32) el("rect", { x: wx, y: wy, width: 16, height: 22, fill: "#ffcf7a", "fill-opacity": 0.85 }, far);
    x += w + 8;
  }
  // 轨道与列车
  wrect(plat, -1500, 760, 5000, 60, "#3a3f4a", { amp: 1, edge: 0 });
  line(plat, [[-1500, 784], [3500, 784]], "#8a8f99", 5); line(plat, [[-1500, 800], [3500, 800]], "#8a8f99", 5);
  const train = g(plat), { CAR, GAP } = def;
  for (let c = 0; c < 3; c++) {
    const x0 = c * (CAR + GAP);
    wrect(train, x0, 430, CAR, 350, "#dfe4e8", { amp: 1.2 });
    wrect(train, x0, 640, CAR, 26, "#3f7f8f", { amp: 0.6, edge: 0 });
    for (let k = 0; k < 7; k++) {
      const wx = x0 + 40 + k * 130;
      if (k === 2 || k === 5) { wrect(train, wx, 470, 80, 300, "#b8c0c8", { amp: 0.8 }); el("rect", { x: wx + 14, y: 490, width: 52, height: 110, fill: "#ffd99a", "fill-opacity": 0.9 }, train); continue; }
      wrect(train, wx, 480, 96, 120, "#ffd99a", { amp: 0.8 });
      if (r() < 0.4) { well(train, wx + 30 + r() * 30, 560, 22, 30, "#5a4a44", { edge: 0 }); el("circle", { cx: wx + 44, cy: 525, r: 14, fill: "#5a4a44" }, train); }
    }
    wrect(train, x0 + 30, 776, 140, 26, "#2b2b30", { amp: 0.5, edge: 0 }); wrect(train, x0 + CAR - 170, 776, 140, 26, "#2b2b30", { amp: 0.5, edge: 0 });
  }
  wpoly(train, [[0, 430], [-60, 470], [-80, 780], [0, 780]], "#dfe4e8", { amp: 1 }); el("circle", { cx: -46, cy: 720, r: 12, fill: "#fff6d8" }, train);
  const face = g(train); // 车窗里的女孩
  well(face, 0, 30, 34, 28, "#d9483b", { edge: 0 }); el("circle", { cx: 2, cy: -6, r: 24, fill: SKIN }, face);
  el("path", { d: "M-24,-8C-26,-36 26,-40 25,-14Z", fill: "#f4efe6" }, face); el("ellipse", { cx: 12, cy: -4, rx: 2.5, ry: 3.5, fill: "#3a2e2a" }, face);
  put(face, def.winOff, 562);
  // 站台
  wrect(plat, -1500, 812, 5000, 700, "#e6ecf2", { amp: 1.5, bloom: 0.4 });
  for (let x = -1500; x < 3500; x += 70) el("rect", { x, y: 832, width: 44, height: 9, fill: "#e8c860" }, plat);
  for (let k = 0; k < 50; k++) well(plat, r() * 3200 - 600, 880 + r() * 300, 10, 4, "#cfd8e2", { edge: 0, bloom: 0, step: 8 });
  [300, 1650].forEach((x) => {
    el("ellipse", { cx: x, cy: 940, rx: 200, ry: 40, fill: "#f5e6c0", "fill-opacity": 0.5 }, plat);
    line(plat, [[x, 950], [x, 380]], "#4a5262", 12); wrect(plat, x - 34, 360, 68, 30, "#ffe8b0", { amp: 0.6 }); wrect(plat, x - 40, 350, 80, 12, "#4a5262", { amp: 0.4 });
  });
  wrect(plat, 440, 880, 180, 16, "#8a6a52", { amp: 0.8 }); wrect(plat, 440, 870, 180, 12, "#f4f7fa", { amp: 1, edge: 0 });
  wrect(plat, 455, 896, 10, 46, "#5a4a3a"); wrect(plat, 595, 896, 10, 46, "#5a4a3a");
  [[1395, 860, 110, 70], [1405, 790, 92, 70]].forEach(([x, y, w, h]) => { wrect(plat, x, y, w, h, "#c8a27a", { amp: 0.8 }); el("rect", { x: x + w / 2 - 6, y, width: 12, height: h, fill: "#e8d4a8" }, plat); });
  const mom = makeRig(plat, LOOKS.mom), suit = g(plat);
  wrect(suit, -36, -120, 72, 120, "#5f86b8", { amp: 0.8 }); line(suit, [[0, -120], [0, -200]], "#4a4f5e", 5);
  const dad = makeRig(plat, LOOKS.dad), box = g(dad.slot);
  wrect(box, -62, -48, 124, 96, "#c8a27a", { amp: 0.8 }); el("rect", { x: -6, y: -48, width: 12, height: 96, fill: "#e8d4a8" }, box);
  const girl = makeRig(plat, LOOKS.winter);
  const ball = g(plat); disc(ball, 16, "#f6f8fb", { edge: 1.5 });
  const puff = [...Array(14)].map(() => el("circle", { fill: "#f6f8fb" }, plat));
  wrect(near, -200, 1040, 600, 300, "#f2f5f8", { amp: 6 }); line(near, [[90, 1300], [90, 300]], "#2f3644", 22);
  const snow = g(st.root), sr = mulberry32(71);
  const flakes = [...Array(170)].map(() => ({ e: el("circle", { r: 2 + sr() * 4, fill: "#ffffff", "fill-opacity": 0.85 }, snow), x: sr() * 2000, y: sr() * 1200, v: 40 + sr() * 70, ph: sr() * 6.28 }));
  return {
    root: st.root,
    update(t) {
      st.place(t);
      train.setAttribute("transform", `translate(${def.frontX(t).toFixed(1)},0)`);
      const c = def.cast(t);
      mom.update(solve(c.mom)); put(suit, c.suit[0], c.suit[1], c.suitTilt * (c.mom.face < 0 ? 1 : -1));
      dad.update(solve(c.dad)); put(box, c.box[0], c.box[1]);
      girl.update(solve(c.girl));
      const bl = def.ball(t); ball.setAttribute("display", bl.on ? "inline" : "none"); put(ball, bl.w[0], bl.w[1]);
      const pf = def.puff(t);
      puff.forEach((e, k) => { const q = pf[k]; e.setAttribute("display", q ? "inline" : "none"); if (q) { e.setAttribute("cx", q[0].toFixed(1)); e.setAttribute("cy", q[1].toFixed(1)); e.setAttribute("r", Math.max(0.1, q[2]).toFixed(1)); } });
      flakes.forEach((f) => { f.e.setAttribute("cx", ((f.x + 30 * Math.sin(t * 0.7 + f.ph) - 20 * t) % 2000 + 2000) % 2000 - 40); f.e.setAttribute("cy", ((f.y + f.v * t) % 1200) - 60); });
    },
  };
}

// ---- 新家：窗前 ----
function buildRoom(svg, def, D) {
  const st = stage(svg, def), { out, room } = st.layers, r = mulberry32(83);
  bands(out, -800, 2800, [-400, 200, 600, 1000], ["#bcd6e4", "#d2e4ec", "#e6eeee"]);
  blocks(out, -400, 2600, 260, 520, ["#d7e2ea", "#c3d3df", "#e8dccf", "#cdd9e2"], "#f6f4ee", r);
  for (let k = 0; k < 6; k++) well(out, 1500 + r() * 300, 300 + r() * 200, 60, 40, "#f2b8c2");
  el("path", { d: "M-800,-400H2800V1600H-800ZM900,140V790H1720V140Z", fill: "#f0e2d0", "fill-rule": "evenodd" }, room);
  wrect(room, 885, 125, 850, 22, "#f7f3ec", { amp: 0.6 }); wrect(room, 1300, 140, 18, 650, "#f7f3ec", { amp: 0.4 });
  wrect(room, 860, 788, 900, 26, "#e8dcc8", { amp: 0.6 });
  wpoly(room, [[700, 110], [860, 110], [830, 900], [690, 900]], "#b9d6b0", { amp: 3 });
  wpoly(room, [[1470, 788], [1550, 788], [1540, 730], [1480, 730]], "#d9825a", { amp: 0.8 });
  // 刚搬来：墙上的小书架、相框，窗台下拆了一半的纸箱
  wrect(room, 400, 360, 270, 14, "#b4825a", { amp: 0.5 });
  ["#c8564a", "#5f86b8", "#e0a040", "#7aa36a", "#8a6aa0", "#d9a77f"].forEach((c, k) => wrect(room, 412 + k * 30, 360 - 70 - (k % 3) * 8, 24, 70 + (k % 3) * 8, c, { amp: 0.4 }));
  wrect(room, 460, 470, 150, 120, "#f7f3ec", { amp: 0.6 }); wrect(room, 474, 484, 122, 92, "#cfe6ef", { amp: 0.6 }); well(room, 535, 540, 26, 22, "#a9cf8a");
  wrect(room, 1060, 880, 260, 180, "#c8a27a", { amp: 0.8 }); wpoly(room, [[1060, 880], [1000, 820], [1120, 830]], "#d9b38a", { amp: 0.6 });
  wpoly(room, [[1320, 880], [1380, 830], [1260, 826]], "#d9b38a", { amp: 0.6 }); el("rect", { x: 1060, y: 880, width: 260, height: 10, fill: "#a8825f" }, room);
  const packet = g(room); wrect(packet, -26, -40, 52, 72, "#f4ead8", { amp: 0.6 }); well(packet, 0, -4, 12, 10, "#a9cf8a"); line(packet, [[0, 6], [0, 22]], "#7aa36a", 4);
  const phone = g(room); wrect(phone, -22, -40, 44, 80, "#2b2d33", { amp: 0.4 }); el("rect", { x: -18, y: -35, width: 36, height: 66, fill: "#eef1ea" }, phone);
  const girl = makeRig(room, LOOKS.room);
  return {
    root: st.root,
    update(t) {
      st.place(t);
      const c = def.cast(t), ph = def.phone(t), pk = def.packet(t);
      girl.update(solve(c.girl));
      put(phone, ph.w[0], ph.w[1], ph.rot);
      put(packet, pk.w[0], pk.w[1] - 30, pk.rot);
    },
  };
}

// ---- 手机：聊天界面，照片位留给 3D 画布 ----
export const PHOTO = { x: 760, y: 250, w: 400 };
function buildPhone(svg, D, T) {
  const root = g(svg, { display: "none" });
  wrect(root, -100, -100, 2200, 1300, "#efe2d0", { edge: 0, bloom: 0 });
  wpoly(root, [[1350, -50], [1900, -50], [1900, 700], [1500, 900]], "#f7ecd8", { edge: 0, a: 0.7 });
  const ph = g(root);
  [[600, 1150, 700, 870], [1320, 1150, 1220, 870]].forEach(([a, b, c, d]) => line(ph, [[a, b], [c, d]], "#9cc79a", 120));
  wrect(ph, 718, 98, 484, 904, "#2b2d33", { amp: 0.4, edge: 0 });
  el("rect", { x: 738, y: 118, width: 444, height: 864, rx: 18, fill: "#eef1ea" }, ph);
  el("rect", { x: 738, y: 118, width: 444, height: 90, fill: "#f7f7f4" }, ph);
  el("path", { d: "M772,148L756,163L772,178", fill: "none", stroke: "#4a4a4a", "stroke-width": 4, "stroke-linecap": "round" }, ph);
  const name = el("text", { x: 960, y: 176, "text-anchor": "middle", "font-size": 36, "font-weight": 500, fill: "#333" }, ph); name.textContent = T["n3.contact"];
  const bub = g(ph);
  el("rect", { x: 760, y: 500, width: 400, height: 72, rx: 16, fill: "#ffffff" }, bub);
  const msg = el("text", { x: 780, y: 549, "font-size": 36, "font-weight": 500, fill: "#333" }, bub); msg.textContent = T["n3.msg"];
  [[640, 760, 560, 880], [1280, 760, 1360, 880]].forEach(([a, b]) => { well(ph, a, b, 70, 110, SKIN); well(ph, a + (a < 960 ? 90 : -90), b - 40, 26, 22, SKIN); });
  return { root, ph, bub };
}

export function buildScenes(svg, SC, D, T) {
  return {
    palm: buildPalm(svg, SC.palm, D), spring: buildSpring(svg, SC.spring, D), summer: buildSummer(svg, SC.summer, D),
    autumn: buildAutumn(svg, SC.autumn, D), winter: buildWinter(svg, SC.winter, D), room: buildRoom(svg, SC.room, D), phone: buildPhone(svg, D, T),
  };
}
