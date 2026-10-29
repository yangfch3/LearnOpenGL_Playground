"""S7 光栅化计数 Manim 版：数据、文字、音效取自 S7-hyperframes 的 build.py 产物。
逐像素动画相互重叠，Manim 的 play 串行模型排不开，改用「一个时钟 + 每帧按时刻求值」。"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from manim import (DashedVMobject, Dot, Line, Polygon, Rectangle, RoundedRectangle, Text, ValueTracker,  # noqa: E402
                   VGroup, rate_functions)
from common import load_text, read_js  # noqa: E402
from manim_common import (G, GL_ORANGE, INK, INK_DIM, LINE, P, SW, U, TimedScene, back_out, elastic_out, px,  # noqa: E402
                          track, txt)

HF = HERE.parent / "S7-hyperframes"
D = read_js(HF / "assets/data/s7.js", "S7")
T = load_text(HF / "assets/text/zh-CN.js")
C = D["cell"]
GX, GY = 960 - 8 * C - 60, 120
sx = lambda x: GX + x * C  # noqa: E731
sy = lambda y: GY + (12 - y) * C  # noqa: E731
FADE_OUT_DEFAULT = lambda t: 1 - (1 - t) ** 2  # noqa: E731  GSAP 默认 power1.out


def mono(s, size, color=INK):
    t = Text(s, font="JetBrains Mono", font_size=100, color=color, weight="MEDIUM")
    ref = Text("0" * 10, font="JetBrains Mono", font_size=100, weight="MEDIUM")
    return t.scale(size * 0.6 * 10 * U / ref.width)  # JetBrains Mono 字宽 0.6em：按 10 个数字的宽度标定


class S7(TimedScene):
    def construct(self):
        grid = VGroup(*[Line(P(sx(i), sy(0)), P(sx(i), sy(12))) for i in range(17)],
                      *[Line(P(sx(0), sy(j)), P(sx(16), sy(j))) for j in range(13)]).set_stroke(LINE, 2 * SW)
        dots = VGroup(*[Dot(P(sx(i + 0.5), sy(j + 0.5)), radius=px(6), color=INK_DIM) for j in range(12) for i in range(16)])
        outline = Polygon(*[P(sx(x), sy(y)) for x, y in D["verts"]]).set_stroke(INK, 3 * SW)
        n1 = txt(T["s7.note"].split("\n")[0], 36, INK_DIM, "MEDIUM")
        n2 = txt(T["s7.note"].split("\n")[1], 36, INK_DIM, "MEDIUM")
        n1.move_to(P(1500, 120 + 25), aligned_edge=[-1, 0, 0]).align_to(P(1500, 0), [-1, 0, 0])
        n2.move_to(P(1500, 170 + 25)).align_to(P(1500, 0), [-1, 0, 0])

        scan_base = VGroup(Rectangle(width=px(16 * C), height=px(C), stroke_width=0, fill_color=INK, fill_opacity=0.07),
                           Line(P(sx(0), sy(1)), P(sx(16), sy(1))), Line(P(sx(0), sy(0)), P(sx(16), sy(0))))
        scan_base[0].move_to(P(sx(8), sy(0.5)))
        scan_base[1:].set_stroke(INK_DIM, 3 * SW)
        scan = scan_base.copy()
        scan_y = lambda j: sy(j + 1) - sy(1)  # noqa: E731
        sy_segs = []
        prev = scan_y(D["rows"][0]["j"])
        for r, row in enumerate(D["rows"][1:] + [D["empty"]]):
            sy_segs.append((row["start"], D["scanIn"], prev, scan_y(row["j"]), G["power2.inOut"]))
            prev = scan_y(row["j"])
        so_segs = [(0, D["scanIn"], 0, 1, G["power2.out"]), (D["outAt"], 0.3, 1, 0, G["power2.in"])]

        # 像素：方块 + 白色亮光层；虚线目标框
        pixels, glow_segs_all = [], []
        for row in D["rows"]:
            for k, p in enumerate(row["pixels"]):
                cx, top = sx(p["i"]) + 28, sy(row["j"] + 1) + 4
                sq = RoundedRectangle(corner_radius=px(4), width=px(C - 8), height=px(C - 8), stroke_width=0,
                                      fill_color=GL_ORANGE, fill_opacity=1).move_to(P(cx, top + (C - 8) / 2))
                glow = sq.copy().set_fill("#FFFFFF", 0)
                ghost = DashedVMobject(sq.copy().set_fill(opacity=0).set_stroke(GL_ORANGE, 3 * SW, 0.6), num_dashes=16)
                up, ad = -p["h"] * C, D["appearDur"]
                sq_x, sq_y = (1.2, 0.72) if p["accent"] else (1.14, 0.8)
                el = 0.7 if p["accent"] else 0.45
                ein = back_out(2)
                pixels.append({
                    "sq": sq, "glow": glow, "ghost": ghost, "base": sq.copy(), "gbase": ghost.copy(),
                    "bottom": (cx, top + C - 8),
                    "op": [(p["appear"], ad, 0, 1, ein)],
                    "y": [(p["appear"], ad, up + 14, up, ein),
                          (p["appear"] + ad, p["drop"] - p["appear"] - ad, up, up - 6, G["sine.inOut"]),
                          (p["drop"], p["land"] - p["drop"], up - 6, 0, G["power2.in"])],
                    "sx": [(p["appear"], ad, 0.7, 1.12, ein), (p["drop"], p["land"] - p["drop"], 1.12, 1, G["power2.in"]),
                           (p["land"], 0.06, 1, sq_x, G["power2.out"]), (p["land"] + 0.06, el, sq_x, 1, elastic_out(1, 0.35))],
                    "sy": [(p["appear"], ad, 0.7, 1.12, ein), (p["drop"], p["land"] - p["drop"], 1.12, 1, G["power2.in"]),
                           (p["land"], 0.06, 1, sq_y, G["power2.out"]), (p["land"] + 0.06, el, sq_y, 1, elastic_out(1, 0.35))],
                    "ghost_op": [(p["appear"], 0.25, 0, 1, G["power2.out"]), (p["land"], 0.12, 1, 0, FADE_OUT_DEFAULT)],
                    "glow_op": [(row["accentAt"] + 0.08 + k * 0.035, 0.1, 0, 0.45, G["power2.out"]),
                                (row["accentAt"] + 0.08 + k * 0.035 + 0.1, 0.3, 0.45, 0, G["power2.in"])],
                })
        for n, px_ in enumerate(pixels):
            t0 = D["sumAt"] + n * 0.02
            px_["glow_op"] += [(t0, 0.1, 0, 0.45, G["power2.out"]), (t0 + 0.1, 0.3, 0.45, 0, G["power2.in"])]

        counts = []
        for row, cls in [(r, INK) for r in D["rows"]] + [(D["empty"], INK_DIM)]:
            c = mono(str(row["count"]), 40, cls)
            c.move_to(P(sx(16) + 28 + 40, sy(row["j"] + 1) + 28)).align_to(P(sx(16) + 28, 0), [-1, 0, 0])
            counts.append({"m": c, "base": c.copy(), "c": P(sx(16) + 28 + 40, sy(row["j"] + 1) + 28), "at": row["countAt"]})

        def slide(m, at, top, out=None):
            m.move_to(P(960, top + 31))
            segs = [(at, 0.5, 0, 1, G["power3.out"])] + ([(out, 0.3, 1, 0, G["power2.in"])] if out else [])
            return {"m": m, "base": m.copy(), "at": at, "segs": segs}
        texts = [slide(txt(T["s7.empty"], 44), D["captionAt"], 836, D["outAt"]),
                 slide(mono(D["formula"], 44), D["formulaAt"], 816),
                 slide(txt(T["s7.total"].replace("{n}", str(D["total"])), 44, weight="MEDIUM"), D["sumLineAt"], 892)]

        clock = ValueTracker(0)

        def frame(_):
            t = clock.get_value()
            scan.become(scan_base).shift([0, -track(t, sy_segs, scan_y(D["rows"][0]["j"])) * U, 0])
            o = track(t, so_segs)
            scan[0].set_fill(opacity=0.07 * o)
            scan[1:].set_stroke(opacity=o)
            for p in pixels:
                op = min(max(track(t, p["op"]), 0), 1)
                y, kx, ky = track(t, p["y"]), track(t, p["sx"]), track(t, p["sy"])
                bx, by = P(*p["bottom"])[:2]
                for m in (p["sq"], p["glow"]):
                    m.become(p["base"])
                    m.stretch(kx, 0, about_point=[bx, by, 0]).stretch(ky, 1, about_point=[bx, by, 0]).shift([0, -y * U, 0])
                p["sq"].set_fill(GL_ORANGE, op)
                p["glow"].set_fill("#FFFFFF", op * track(t, p["glow_op"]))
                p["ghost"].set_stroke(opacity=0.6 * track(t, p["ghost_op"]))
            for c in counts:
                k = min((t - c["at"]) / 0.35, 1) if t >= c["at"] else 0
                e = back_out(3)(k) if k > 0 else 0
                c["m"].become(c["base"]).scale(0.6 + 0.4 * e, about_point=c["c"]).set_opacity(min(max(e, 0), 1))
            for s in texts:
                a = track(t, s["segs"]) if t >= s["at"] else 0
                k = min(max((t - s["at"]) / 0.5, 0), 1)
                s["m"].become(s["base"]).shift([0, -16 * (1 - G["power3.out"](k)) * U, 0]).set_opacity(a)

        root = VGroup(grid, *[p["ghost"] for p in pixels], scan, dots,
                      *[m for p in pixels for m in (p["sq"], p["glow"])], outline,
                      *[c["m"] for c in counts], n1, n2, *[s["m"] for s in texts])
        root.add_updater(frame)
        frame(None)
        self.add(root)
        self.play(clock.animate.set_value(D["duration"]), run_time=D["duration"], rate_func=rate_functions.linear)
