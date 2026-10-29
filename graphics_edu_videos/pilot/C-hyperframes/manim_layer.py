"""C 上层：Manim 透明背景片段。P2 的结果 p′ 在 2s 淡入；右下画色块与帧号条码。"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from manim import MathTex, Rectangle, ValueTracker, VGroup, rate_functions  # noqa: E402
from manim_common import GL_ORANGE, INK, G, P, TimedScene, px  # noqa: E402

D = json.loads((HERE / "assets/data/c.json").read_text(encoding="utf-8"))


def rect(x, y, w, h, color):
    return Rectangle(width=px(w), height=px(h), stroke_width=0, fill_color=color, fill_opacity=1).move_to(P(x + w / 2, y + h / 2))


class Top(TimedScene):
    def construct(self):
        x, y = D["calib"]["manim"]
        bits = [rect(x + D["bitX"] + b * D["bitStep"], y + D["bitY"], D["bit"], D["bit"], "#000000") for b in range(8)]
        ticker = VGroup()
        self.add(ticker, rect(x, y, D["block"], D["block"], GL_ORANGE), *bits)
        pv = MathTex(r"p' = \begin{bmatrix} 3 \\ 2 \\ 0 \\ 1 \end{bmatrix}", color=INK).scale(1.3).move_to(P(*D["pPos"]))
        self.add(pv)
        clock = ValueTracker(0)

        def frame(_):
            t = clock.get_value()
            f = round(t * D["fps"])
            for b, m in enumerate(bits):
                m.set_fill("#FFFFFF" if (f >> (7 - b)) & 1 else "#000000", 1)
            a = G["power3.out"](min(max((t - D["pFadeAt"]) / D["pFadeDur"], 0), 1))
            pv.set_opacity(a)
        ticker.add_updater(frame)
        frame(None)
        self.play(clock.animate.set_value(D["duration"]), run_time=D["duration"], rate_func=rate_functions.linear)
