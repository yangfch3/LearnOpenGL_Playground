"""P2 矩阵乘向量 Manim 版：MathTex 公式 + xeCJK 中文（字重取自 VF 切出的静态实例）；数据、文字、音效取自 P2-hyperframes。
中文烘焙进片段：换语言需重渲。"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from manim import (UP, AnimationGroup, FadeIn, FadeOut, MathTex, Matrix, RoundedRectangle, ReplacementTransform,  # noqa: E402
                   Succession, Tex, TexTemplate, Transform, VGroup, Wait)
from common import load_text, read_js  # noqa: E402
from manim_common import EASE, INK, INK_DIM, P, SW, U, TimedScene, cjk_static, px  # noqa: E402

HF = HERE.parent / "P2-hyperframes"
D = read_js(HF / "assets/data/p2.js", "P2")
TX = load_text(HF / "assets/text/zh-CN.js")
B = D["beats"]
CJK = TexTemplate(tex_compiler="xelatex", output_format=".xdv")
_dir, _w400 = cjk_static(400)
_, _w500 = cjk_static(500)
CJK.add_to_preamble(r"\usepackage{xeCJK}\setCJKmainfont{" + _w400 + "}[Path=" + _dir + r"]"
                    r"\newCJKfontfamily\cjkmedium{" + _w500 + "}[Path=" + _dir + "]")
_ref = {}


def cjk(s, size, color=INK, medium=False):
    """size：汉字宽 px"""
    if "k" not in _ref:
        r = Tex("国" * 10, tex_template=CJK)
        _ref["k"] = 10 * size * U / r.width / size
    return Tex((r"{\cjkmedium " + s + "}") if medium else s, tex_template=CJK, color=color).scale(_ref["k"] * size)


def hl_box(m, px_=5, py=2):
    return RoundedRectangle(corner_radius=px(12), width=m.width + px(2 * px_ + 20), height=m.height + px(2 * py + 24),
                            stroke_width=3 * SW, stroke_color=INK, fill_color=INK, fill_opacity=0.12).move_to(m)


class P2(TimedScene):
    def construct(self):
        e3, e2i, e2o = EASE["power3.out"], EASE["power2.in"], EASE["power2.out"]
        mT = Matrix(D["M"])
        vP = Matrix([[v] for v in D["V"]])
        res = Matrix([[v] for v in D["R"]])
        eq = VGroup(mT, MathTex(r"\cdot"), vP, MathTex("="), res).arrange(buff=0.4)
        eq.scale(px(775) / eq.width).move_to(P(960, 312))
        ents = mT.get_entries()
        m = lambda r, k: ents[r * 4 + k]  # noqa: E731
        v = vP.get_entries()
        rs = res.get_entries()
        q = MathTex("?").scale(eq[0].get_entries()[0].height / MathTex("0").height).move_to(res)
        labT = cjk(TX["p2.labT"], 36, INK_DIM, True).next_to(mT, -UP, buff=px(18))
        labP = cjk(TX["p2.labP"], 36, INK_DIM, True).next_to(vP, -UP, buff=px(18))
        rs.set_opacity(0)
        res.get_brackets().set_opacity(0)

        exps = []
        for r, y in [(0, 625), (1, 725)]:
            parts = []
            for k in range(4):
                if k:
                    parts.append("+")
                parts += [str(D["M"][r][k]), r"\cdot", str(D["V"][k])]
            parts += ["=", str(D["R"][r])]
            e = MathTex(*parts)
            e.scale(px(720) / e.width).move_to(P(960, y))
            exps.append(e)

        def term(e, k):  # 第 k 项：a、·、b、前置 +
            i = 0 if k == 0 else 3 + 4 * (k - 1) + 1
            return e[i], e[i + 1], e[i + 2], (e[i - 1] if k else None)

        cap1 = cjk(TX["p2.cap1"], 44).move_to(P(960, 867))
        cap2 = cjk(TX["p2.cap2"], 44).move_to(P(960, 867))
        self.add(eq, q, labT, labP)
        self.play(*[FadeIn(x, shift=px(16) * UP) for x in (eq[0], eq[1], eq[2], eq[3], q, labT, labP)], run_time=0.5, rate_func=e3)
        self.at(B["cap1"])
        self.play(FadeIn(cap1, shift=px(16) * UP), run_time=0.5, rate_func=e3)
        self.at(B["cap1Out"])
        self.play(FadeOut(cap1), run_time=0.3, rate_func=e2i)

        hA, hB = hl_box(m(0, 0)).set_opacity(0), hl_box(v[0]).set_opacity(0)
        self.add(hA, hB)

        def focus(r):
            return [ents[i].animate(run_time=0.3, rate_func=e2o).set_opacity(1 if i // 4 == r else 0.4) for i in range(16)]

        def move(h, target, first=False):
            t = hl_box(target) if not isinstance(target, RoundedRectangle) else target
            return Transform(h, t, run_time=0.25, rate_func=e2o)

        for row in D["rows"]:
            r, e = row["r"], exps[row["r"]]
            self.at(row["start"])
            anims = focus(r)
            if r == 0:
                anims += [FadeOut(q, run_time=0.3, rate_func=e2i), res.get_brackets().animate(run_time=0.5, rate_func=e3).set_opacity(1)]
            else:
                anims += [x.animate(run_time=0.3).set_opacity(0.4) for x in exps[0]]
            self.play(*anims)
            for k, t in enumerate(row["terms"]):
                self.at(t)
                a, dot, b, plus = term(e, k)
                fly = [ReplacementTransform(m(r, k).copy(), a, run_time=D["fly"], rate_func=EASE["power2.inOut"]),
                       ReplacementTransform(v[k].copy(), b, run_time=D["fly"], rate_func=EASE["power2.inOut"]),
                       FadeIn(dot, run_time=0.2)]
                if plus is not None:
                    fly.append(Succession(Wait(0.2), FadeIn(plus, run_time=0.3)))
                self.play(AnimationGroup(move(hA, m(r, k)), move(hB, v[k]), Succession(Wait(0.15), AnimationGroup(*fly))))
            self.at(row["sumAt"])
            self.play(hA.animate(run_time=0.3, rate_func=e2i).set_opacity(0), hB.animate(run_time=0.3, rate_func=e2i).set_opacity(0),
                      FadeIn(VGroup(e[-2], e[-1]), scale=0.8, run_time=0.35, rate_func=e3))
            self.at(row["sumFly"])
            c = e[-1].copy()
            self.play(Transform(c, rs[r].copy().set_opacity(1), run_time=D["sumFlyDur"], rate_func=EASE["power2.inOut"]))
            self.remove(c)
            rs[r].set_opacity(1)

        for n, d in enumerate(D["direct"]):
            self.at(d["start"])
            row_g = VGroup(*[m(d["r"], k) for k in range(4)])
            anims = focus(d["r"]) + [move(hA, row_g), move(hB, vP.get_entries())]
            if n == 0:
                anims += [x.animate(run_time=0.3).set_opacity(0.4) for x in exps[1]]
            self.play(*anims)
            self.at(d["pop"])
            self.play(FadeIn(rs[d["r"]].set_opacity(1), scale=0.6, run_time=0.35, rate_func=e3))

        self.at(B["col"])
        col = VGroup(*[m(r, 3) for r in range(4)])
        hC, hD = [hl_box(VGroup(*term(e, 3)[:3])) for e in exps]
        self.play(*[ents[i].animate(run_time=0.3).set_opacity(1 if i % 4 == 3 else 0.4) for i in range(16)],
                  *[v[k].animate(run_time=0.3).set_opacity(1 if k == 3 else 0.4) for k in range(4)],
                  *[x.animate(run_time=0.3).set_opacity(1) for e in exps for x in term(e, 3)[:3]],
                  move(hA, col), move(hB, v[3]), FadeIn(hC, run_time=0.25), FadeIn(hD, run_time=0.25))
        self.at(B["cap2"])
        self.play(FadeIn(cap2, shift=px(16) * UP), run_time=0.5, rate_func=e3)
        self.at(D["duration"])
