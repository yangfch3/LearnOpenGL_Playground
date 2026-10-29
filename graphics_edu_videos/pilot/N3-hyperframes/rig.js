// 平面人物：按 acts.solve 解出的关节逐帧更新 SVG。look 决定发型、衣着与配色
import { el, g, shade } from "./paint.js";

const SKIN = "#f2d2b6", INK = "#3a2e2a";
const f1 = (v) => v.toFixed(1);
const seg = (a, b, c) => `M${f1(a[0])},${f1(a[1])}L${f1(b[0])},${f1(b[1])}` + (c ? `L${f1(c[0])},${f1(c[1])}` : "");
const lerp = (a, b, k) => a + (b - a) * k;
const at = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

// 头部（单位：头半径），面朝 +x
const HAIR = {
  pony: "M0.62,-0.8C0.2,-1.25-1,-1.15-1.05,-0.1C-1.08,0.35-0.9,0.6-0.7,0.7C-0.75,0.2-0.45,-0.25-0.1,-0.45C0.2,-0.5 0.5,-0.5 0.72,-0.6Z",
  short: "M0.7,-0.62C0.4,-1.2-0.9,-1.2-1.05,-0.2C-1.1,0.2-1,0.45-0.85,0.55C-0.8,0.15-0.55,-0.3-0.1,-0.42C0.25,-0.48 0.5,-0.45 0.75,-0.5Z",
  old: "M0.15,-0.92C-0.6,-1.05-1.05,-0.5-1,0.1C-0.95,0.45-0.8,0.62-0.62,0.66C-0.75,0.2-0.62,-0.38-0.1,-0.72Z",
  bun: "M0.66,-0.7C0.3,-1.22-0.95,-1.15-1.05,-0.15C-1.08,0.3-0.95,0.55-0.8,0.62C-0.78,0.15-0.5,-0.3-0.05,-0.45C0.25,-0.5 0.5,-0.5 0.72,-0.56Z",
};
function head(parent, L) {
  const H = g(parent), hair = L.hair;
  const pony = L.hairStyle === "pony" ? g(H) : null;
  if (pony) el("path", { d: "M-0.75,-0.55C-1.35,-0.6-1.6,0.1-1.45,0.75C-1.35,1.05-1.1,0.95-1.12,0.6C-1.15,0.15-1,-0.2-0.7,-0.25Z", fill: hair }, pony);
  if (L.hairStyle === "bun") el("circle", { cx: -0.82, cy: -0.62, r: 0.4, fill: hair }, H);
  el("circle", { cx: -0.08, cy: 0.12, r: 0.18, fill: shade(L.skin, -0.08) }, H);
  el("circle", { cx: 0, cy: 0, r: 1, fill: L.skin }, H);
  el("circle", { cx: 0.93, cy: 0.12, r: 0.17, fill: L.skin }, H);
  el("path", { d: HAIR[L.hairStyle] || HAIR.short, fill: hair }, H);
  const eye = el("ellipse", { cx: 0.5, cy: 0, rx: 0.085, ry: 0.12, fill: INK }, H);
  el("path", { d: "M0.36,-0.26L0.64,-0.29", stroke: L.hairStyle === "old" ? "#b8b2aa" : hair, "stroke-width": 0.06, "stroke-linecap": "round" }, H);
  el("circle", { cx: 0.42, cy: 0.33, r: 0.16, fill: "#f29a8a", "fill-opacity": 0.45 }, H);
  const mouth = el("path", { fill: "none", stroke: "#8a4a3a", "stroke-width": 0.06, "stroke-linecap": "round" }, H);
  if (L.glasses) {
    el("circle", { cx: 0.52, cy: 0.0, r: 0.2, fill: "none", stroke: "#4a4a4a", "stroke-width": 0.05 }, H);
    el("path", { d: "M0.32,-0.02L-0.1,0", stroke: "#4a4a4a", "stroke-width": 0.04 }, H);
  }
  if (L.hat === "straw") {
    el("ellipse", { cx: 0.05, cy: -0.72, rx: 1.65, ry: 0.28, fill: "#e8c97a" }, H);
    el("path", { d: "M-0.75,-0.75C-0.7,-1.35 0.75,-1.35 0.8,-0.75Z", fill: "#e2bd68" }, H);
    el("path", { d: "M-0.74,-0.82L0.79,-0.82", stroke: "#d9483b", "stroke-width": 0.12 }, H);
  }
  if (L.hat === "beanie") {
    el("path", { d: "M-1.06,-0.18C-1.15,-1.25 0.85,-1.3 0.86,-0.42Z", fill: L.hatColor }, H);
    el("path", { d: "M-1.08,-0.2L0.88,-0.44", stroke: shade(L.hatColor, -0.12), "stroke-width": 0.24, "stroke-linecap": "round" }, H);
    el("circle", { cx: -0.3, cy: -1.12, r: 0.2, fill: L.hatColor }, H);
  }
  return { H, eye, mouth, pony };
}

// look: skin, hair, hairStyle, top, sleeve('long'|'short'), bottom{kind:'skirt'|'dress'|'shorts'|'pants'|'coat', color}, legs, shoes,
//       hat, hatColor, scarf, mitten, pack, glasses
export function makeRig(parent, look) {
  const L = { skin: SKIN, hair: "#4a2f22", hairStyle: "pony", top: "#f2c14e", sleeve: "long", bottom: { kind: "skirt", color: "#f2c14e" }, legs: SKIN, shoes: "#8a5a3a", ...look };
  const root = g(parent), dim = (c) => shade(c, -0.14), kind = L.bottom.kind;
  const S = (stroke, p = root) => el("path", { fill: "none", stroke, "stroke-linecap": "round", "stroke-linejoin": "round" }, p);
  const legC = kind === "pants" || kind === "coat" ? L.bottom.color : L.legs, armC = L.sleeve === "long" ? L.top : L.skin;
  const E = {};
  E.legF = S(dim(legC)); E.shortsF = kind === "shorts" ? S(dim(L.bottom.color)) : null; E.shoeF = el("path", { fill: dim(L.shoes) }, root);
  E.armF = S(dim(armC)); E.sleeveF = L.sleeve === "short" ? S(dim(L.top)) : null; E.handF = el("circle", { fill: dim(L.mitten || L.skin) }, root);
  E.legN = S(legC); E.shortsN = kind === "shorts" ? S(L.bottom.color) : null; E.shoeN = el("path", { fill: L.shoes }, root);
  E.pack = L.pack ? el("path", { fill: L.pack, stroke: shade(L.pack, -0.3), "stroke-width": 2, "stroke-linejoin": "round" }, root) : null;
  E.skirt = kind === "skirt" || kind === "dress" ? el("path", { fill: L.bottom.color, stroke: L.bottom.color, "stroke-linejoin": "round" }, root) : null;
  const topC = kind === "coat" ? L.coat || L.top : L.top;
  E.torso = el("path", { fill: topC, stroke: topC, "stroke-linejoin": "round" }, root);
  E.neck = S(L.skin);
  E.scarf = L.scarf ? S(L.scarf) : null; E.scarfTail = L.scarf ? S(shade(L.scarf, -0.08)) : null;
  E.head = head(root, L);
  const slot = g(root);
  E.armN = S(armC); E.sleeveN = L.sleeve === "short" ? S(L.top) : null; E.handN = el("circle", { fill: L.mitten || L.skin }, root);

  function update(J) {
    const H = J.H, f = J.f, adult = J.kind === "adult", legW = (adult ? 0.062 : 0.072) * H, armW = (adult ? 0.046 : 0.052) * H;
    const limb = (p, a, b, c, w) => { p.setAttribute("d", seg(a, b, c)); p.setAttribute("stroke-width", w); };
    limb(E.legF, J.hip, J.kneeF, J.footF, legW); limb(E.legN, J.hip, J.kneeN, J.footN, legW);
    if (E.shortsF) { limb(E.shortsF, J.hip, at(J.hip, J.kneeF, 0.6), null, legW * 1.3); limb(E.shortsN, J.hip, at(J.hip, J.kneeN, 0.6), null, legW * 1.3); }
    // 鞋：脚跟在踝下，鞋头朝前，鞋底平
    for (const [e, ft] of [[E.shoeF, J.footF], [E.shoeN, J.footN]]) {
      const h = 0.036 * H, x0 = ft[0] - 0.03 * H * f, x1 = ft[0] + 0.07 * H * f, y1 = ft[1] + 0.008 * H, y0 = y1 - h;
      e.setAttribute("d", `M${f1(x0)},${f1(y1)}L${f1(x1)},${f1(y1)}Q${f1(x1 + 0.012 * H * f)},${f1(y1 - h * 0.5)} ${f1(x1 - 0.02 * H * f)},${f1(y0 + h * 0.2)}L${f1(x0 + 0.01 * H * f)},${f1(y0)}Q${f1(x0 - 0.008 * H * f)},${f1(y0 + h * 0.5)} ${f1(x0)},${f1(y1)}Z`);
    }
    limb(E.armF, J.sh, J.elbF, J.handF, armW); limb(E.armN, J.sh, J.elbN, J.handN, armW);
    if (E.sleeveF) { limb(E.sleeveF, J.sh, at(J.sh, J.elbF, 0.6), null, armW * 1.3); limb(E.sleeveN, J.sh, at(J.sh, J.elbN, 0.6), null, armW * 1.3); }
    for (const [e, h] of [[E.handF, J.handF], [E.handN, J.handN]]) { e.setAttribute("cx", f1(h[0])); e.setAttribute("cy", f1(h[1])); e.setAttribute("r", f1((L.mitten ? 0.036 : 0.03) * H)); }
    // 躯干：沿髋 → 肩的轴线
    const ux = J.sh[0] - J.hip[0], uy = J.sh[1] - J.hip[1], ul = Math.hypot(ux, uy), u = [ux / ul, uy / ul], n = [-u[1], u[0]];
    const coat = kind === "coat", wS = (adult ? 0.15 : 0.13) * H * (coat ? 1.25 : 1), wH = (adult ? 0.15 : 0.14) * H * (coat ? 1.35 : 1);
    const top = [J.sh[0] + u[0] * 0.02 * H, J.sh[1] + u[1] * 0.02 * H], bot = [J.hip[0] - u[0] * (coat ? 0.12 : 0.03) * H, J.hip[1] - u[1] * (coat ? 0.12 : 0.03) * H];
    const q = [[top[0] + n[0] * wS / 2, top[1] + n[1] * wS / 2], [top[0] - n[0] * wS / 2, top[1] - n[1] * wS / 2], [bot[0] - n[0] * wH / 2, bot[1] - n[1] * wH / 2], [bot[0] + n[0] * wH / 2, bot[1] + n[1] * wH / 2]];
    E.torso.setAttribute("d", `M${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join("L")}Z`); E.torso.setAttribute("stroke-width", f1(0.05 * H));
    if (E.skirt) {
      const wa = [J.hip[0] + u[0] * 0.05 * H, J.hip[1] + u[1] * 0.05 * H], hemY = J.hip[1] + (kind === "dress" ? 0.19 : 0.15) * H, fl = 0.03 * H * (J.sway || 0);
      // 蹲下时裙摆搭在膝上：前摆移到膝盖前，后摆贴着臀部
      const c = J.crouch || 0, kn = J.kneeN;
      const front = [lerp(J.hip[0] + 0.14 * H * f + fl, kn[0] + 0.03 * H * f, c), lerp(hemY, kn[1] + 0.02 * H, c)];
      const back = [lerp(J.hip[0] - 0.14 * H * f + fl, J.hip[0] - 0.09 * H * f, c), lerp(hemY, J.hip[1] + 0.07 * H, c)];
      const s = [[wa[0] - 0.075 * H * f, wa[1]], [wa[0] + 0.075 * H * f, wa[1]], front, back];
      E.skirt.setAttribute("d", `M${s.map((p) => `${f1(p[0])},${f1(p[1])}`).join("L")}Z`); E.skirt.setAttribute("stroke-width", f1(0.03 * H));
    }
    if (E.pack) {
      const bk = [-f * n[0], -f * n[1]], P = (a, b) => [J.hip[0] + u[0] * (0.2 * H + b) + bk[0] * (0.075 * H + a), J.hip[1] + u[1] * (0.2 * H + b) + bk[1] * (0.075 * H + a)];
      const p = [P(-0.035 * H, -0.11 * H), P(0.06 * H, -0.1 * H), P(0.06 * H, 0.1 * H), P(-0.035 * H, 0.11 * H)];
      E.pack.setAttribute("d", `M${p.map((v) => `${f1(v[0])},${f1(v[1])}`).join("L")}Z`);
    }
    limb(E.neck, J.neck, at(J.neck, J.head, 0.5), null, 0.05 * H);
    if (E.scarf) {
      limb(E.scarf, [J.neck[0] - 0.05 * H * f, J.neck[1]], [J.neck[0] + 0.035 * H * f, J.neck[1] + 0.006 * H], null, 0.065 * H);
      limb(E.scarfTail, [J.neck[0] - 0.035 * H * f, J.neck[1]], [J.neck[0] - 0.07 * H * f - 0.02 * H * (J.sway || 0), J.neck[1] + 0.12 * H], null, 0.045 * H);
    }
    const r = J.K.headR * H, hf = J.headFace;
    E.head.H.setAttribute("transform", `translate(${f1(J.head[0])},${f1(J.head[1])}) rotate(${(J.tilt * hf * 57.3).toFixed(2)}) scale(${(hf * r).toFixed(2)},${r.toFixed(2)})`);
    E.head.eye.setAttribute("ry", J.blink ? 0.02 : 0.12);
    const s = J.smile || 0;
    E.head.mouth.setAttribute("d", `M0.6,${0.47 - 0.04 * s}Q0.72,${(0.5 + 0.12 * s).toFixed(3)} 0.85,${0.43 - 0.04 * s}`);
    if (E.head.pony) E.head.pony.setAttribute("transform", `rotate(${((J.sway || 0) * 30 - J.tilt * 40).toFixed(2)} -0.8 -0.4)`);
  }
  return { root, slot, update, show: (v) => root.setAttribute("display", v ? "inline" : "none") };
}
