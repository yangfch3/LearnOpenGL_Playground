"""S1 管线地图 Manim 版：节拍、版式、文字、音效均取自 S1-hyperframes 的 build.py 产物。"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from manim import (UP as UPV, AnimationGroup, Create, Dot, DashedVMobject, FadeIn, FadeOut, LaggedStart, Line,  # noqa: E402
                   RoundedRectangle, Succession, UpdateFromAlphaFunc, VGroup, VMobject, Wait)
from common import load_text, read_js  # noqa: E402
from manim_common import (DISABLED, EASE, INK, INK_DIM, P, SHADER, SHADER_15, SURFACE, SW, U, TimedScene, px, txt)  # noqa: E402

HF = HERE.parent / "S1-hyperframes"
D = read_js(HF / "assets/data/s1.js", "S1")
T = load_text(HF / "assets/text/zh-CN.js")
B, Y = D["beats"], D["trackY"]


def recolor_pulse(m, fill, stroke, dur):
    """换色 + 放大 1.08 再回落；同一对象只能有一个动画，故合成一个"""
    src = m.copy()
    end = m.copy().set_fill(fill).set_stroke(stroke)
    c = m.get_center()

    def f(mob, a):
        mob.interpolate(src, end, EASE["power2.out"](a))
        e = EASE["power2.out"](a * 2) if a < 0.5 else EASE["power2.out"](2 - a * 2)
        mob.scale(1 + 0.08 * e, about_point=c)
    return UpdateFromAlphaFunc(m, f, run_time=dur)


def label(s, x, top, size=36, color=INK, weight="MEDIUM", lh=50):
    t = txt(s, size, color, weight)
    t.move_to(P(x, top + lh / 2))
    return t


class S1(TimedScene):
    def construct(self):
        xs = [D["srcX"], *D["stX"], D["dstX"]]
        half = lambda k: 40 if k == 0 else 62 if k == len(xs) - 1 else 24  # noqa: E731

        segs, lits = VGroup(), []
        for k in range(len(xs) - 1):
            a, b = P(xs[k] + half(k) + 6, Y), P(xs[k + 1] - half(k + 1) - 6, Y)
            segs.add(Line(a, b, stroke_width=3 * SW, color=INK_DIM, stroke_opacity=0.4))
            if k < 9:
                lits.append(Line(a, b, stroke_width=3 * SW, color=INK))
        nodes = [RoundedRectangle(corner_radius=px(12), width=px(48), height=px(48), stroke_width=3 * SW,
                                  stroke_color=INK_DIM, fill_color=SURFACE, fill_opacity=1).move_to(P(x, Y))
                 for x in D["stX"]]
        src = VGroup(*[Dot(P(D["srcX"] + dx, Y + dy), radius=px(8), color=INK) for dx, dy in [(-22, 18), (22, 18), (0, -20)]])
        screen = RoundedRectangle(corner_radius=px(8), width=px(120), height=px(76), stroke_width=3 * SW,
                                  stroke_color=INK_DIM).move_to(P(D["dstX"], Y))
        mapg = VGroup(segs, *lits, *nodes, src, screen)
        labels = [label(T[f"s1.st{i}"], x, 520 if i % 2 else 390) for i, x in enumerate(D["stX"])]
        anno = VGroup(*labels, label(T["s1.src"], D["srcX"], 536), label(T["s1.dst"], D["dstX"], 536),
                      label(T["s1.st7note"], D["stX"][7], 570, 32, INK_DIM, lh=44))
        self.add(segs, *lits[:8], *nodes, src, screen, anno)
        nodes[8].set_opacity(0.4)
        labels[8].set_opacity(0.4)

        # 帧缓冲点亮：光点沿最后一段流过去
        self.at(B["flow"])
        flow = Dot(P(D["stX"][7] + 32, Y), radius=px(8), color=INK)
        dur = B["lit"] - B["flow"]
        self.play(Create(lits[8], rate_func=EASE["none"]),
                  flow.animate(rate_func=EASE["power1.in"]).move_to(P(D["stX"][8] - 24, Y)), run_time=dur)
        self.remove(flow)
        self.play(nodes[8].animate.set_fill(opacity=1).set_stroke(opacity=1).scale(1.08),
                  labels[8].animate.set_opacity(1), run_time=0.125, rate_func=EASE["power2.out"])
        self.play(nodes[8].animate.scale(1 / 1.08), run_time=0.125, rate_func=EASE["power2.out"])

        # 可选阶段虚线框
        self.at(B["opt"])
        mid = (D["stX"][1] + D["stX"][2]) / 2
        ot = txt(T["s1.opt"], 36, INK_DIM, "MEDIUM")
        box = DashedVMobject(RoundedRectangle(corner_radius=px(12), width=ot.width + px(56), height=px(80),
                                              stroke_width=3 * SW, stroke_color=DISABLED), num_dashes=60)
        opt = VGroup(box, ot).move_to(P(mid, 260))
        links = VGroup(DashedVMobject(Line(P(mid - 30, Y - 6), P(mid - 30, 300), stroke_width=3 * SW, color=DISABLED), num_dashes=10),
                       DashedVMobject(Line(P(mid + 30, 300), P(mid + 30, Y - 6), stroke_width=3 * SW, color=DISABLED), num_dashes=10))
        cap = txt(T["s1.cap.opt"], 44).move_to(P(960, 836 + 31))
        self.play(FadeIn(opt, shift=px(40) * UPV), FadeIn(links), FadeIn(cap, shift=px(16) * UPV),
                  run_time=0.5, rate_func=EASE["power3.out"])

        self.at(B["capOptOut"])
        self.play(FadeOut(cap), opt[0].animate.set_stroke(opacity=0.4), opt[1].animate.set_opacity(0.4), links.animate.set_stroke(opacity=0.4),
                  run_time=0.3, rate_func=EASE["power2.in"])

        # 着色器两站
        self.at(B["shader"])
        arrows, groups = [], []
        for i in D["shader"]:
            x = D["stX"][i]
            a = VGroup(Line(P(x, Y + 130), P(x, Y + 40)), VMobject().set_points_as_corners([P(x - 14, Y + 54), P(x, Y + 40), P(x + 14, Y + 54)]))
            a.set_stroke(SHADER, 4 * SW)
            arrows.append(a)
            groups.append(AnimationGroup(
                recolor_pulse(nodes[i], SHADER_15, SHADER, 0.25),
                labels[i].animate(run_time=0.25, rate_func=EASE["power2.out"]).set_color(SHADER),
                FadeIn(a, shift=px(30) * UPV, rate_func=EASE["power3.out"], run_time=0.5)))
        cap = txt(T["s1.cap.shader"], 44).move_to(P(960, 836 + 31))
        self.play(AnimationGroup(groups[0], Succession(Wait(B["shaderGap"]), groups[1]),
                                 FadeIn(cap, shift=px(16) * UPV, rate_func=EASE["power3.out"], run_time=0.5)))

        self.at(B["capShaderOut"])
        self.play(FadeOut(cap), *[a.animate.set_stroke(opacity=0.4) for a in arrows], run_time=0.3, rate_func=EASE["power2.in"])

        # 固定站标签
        self.at(B["fixed"])
        tags = []
        for i in D["fixed"]:
            tt = txt(T["s1.fixed"], 32, INK_DIM, "MEDIUM")
            pill = RoundedRectangle(corner_radius=px(12), width=px(76), height=px(48), stroke_width=3 * SW,
                                    stroke_color=INK_DIM, fill_color=SURFACE, fill_opacity=1)
            tags.append(VGroup(pill, tt).move_to(P(D["stX"][i], (392 if i % 2 else 520) + 24)))
        cap = txt(T["s1.cap.fixed"], 44).move_to(P(960, 836 + 31))
        dirs = [UPV * px(12) if i % 2 else -UPV * px(12) for i in D["fixed"]]
        e = EASE["power3.out"]
        self.play(AnimationGroup(
            LaggedStart(*[FadeIn(t, shift=d, run_time=0.5, rate_func=e) for t, d in zip(tags, dirs)], lag_ratio=B["fixedGap"] / 0.5),
            FadeIn(cap, shift=px(16) * UPV, run_time=0.5, rate_func=e)))

        # 收拢成进度条
        self.at(B["capFixedOut"])
        self.play(FadeOut(VGroup(anno, opt, links, *arrows, *tags, cap)), run_time=0.3, rate_func=EASE["power2.in"])
        self.at(B["shrink"])
        bar = D["bar"]
        self.play(mapg.animate.scale(bar["scale"], about_point=P(960, Y)).shift((Y - bar["y"]) * U * UPV),
                  run_time=B["shrinkDur"], rate_func=EASE["power2.inOut"])
        self.at(D["duration"])
