"""P1 视锥与相机环绕 Manim 版（ThreeDScene）：场景参数、节拍、文字取自 P1-hyperframes 的 build.py 产物。
世界系 y 向上、视线 −z；Manim 为 z 向上，换算 (x, y, z) → (x, −z, y)。"""
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from manim import (DashedLine, Dot3D, Line, Polygon, ThreeDScene, ValueTracker, VGroup, rate_functions)  # noqa: E402
from common import load_text, read_js  # noqa: E402
from manim_common import G, INK, INK_DIM, P, SW, U, track, txt  # noqa: E402

HF = HERE.parent / "P1-hyperframes"
D = read_js(HF / "assets/data/p1.js", "P1")
TX = load_text(HF / "assets/text/zh-CN.js")
B, O = D["beats"], D["orbit"]
VIEW = "#45C4E0"


def M(p):
    t = O["target"]  # 环绕中心平移到原点：Cairo 下 frame_center 对 3D 内容会重复生效
    return np.array([p[0] - t[0], -(p[2] - t[2]), p[1] - t[1]], dtype=float)


class P1(ThreeDScene):
    def construct(self):
        cam = self.renderer.camera
        half_h = O["dist"] * math.tan(math.radians(O["fov"] / 2))
        self.set_camera_orientation(phi=math.radians(90 - O["pitch"]), theta=math.radians(O["az0"] - 90),
                                    focal_distance=O["dist"], zoom=4 / half_h)

        edges = []
        for e in D["edges"]:
            a, b = M(e["a"]), M(e["b"])
            mk = (lambda a, b: DashedLine(a, b, dash_length=0.06, dashed_ratio=0.55)) if e.get("dashed") else Line
            edges.append({"a": a, "b": b, "mk": mk, "m": mk(a, a + (b - a) * 1e-3), "at": e["at"]})
            edges[-1]["m"].set_stroke(VIEW, 3 * SW, 0)
        planes = [Polygon(*[M(p) for p in D[k]], stroke_width=0, fill_color=VIEW, fill_opacity=0) for k in ("near", "far")]
        c, h = M(D["cube"]["c"]), D["cube"]["s"] / 2
        cv = [c + np.array([x, y, z]) for x in (-h, h) for y in (-h, h) for z in (-h, h)]
        cube = VGroup(*[Line(cv[i], cv[j]) for i in range(8) for j in range(i + 1, 8)
                        if np.count_nonzero(np.abs(cv[i] - cv[j]) > 1e-9) == 1]).set_stroke(INK_DIM, 3 * SW)
        eye = Dot3D(M([0, 0, 0]), radius=0.06, color=INK, resolution=(12, 6))
        # Cairo 渲染器把首个带 updater 对象之前的内容缓存为静态底图，故更新器挂在最先加入的空对象上
        ticker = VGroup()
        self.add(ticker)
        self.add(*[e["m"] for e in edges], *planes, cube, eye)

        labs = [(txt(TX["p1.eye"], 36, INK, "MEDIUM"), M([0, -0.12, 0]), 34),
                (txt(TX["p1.near"], 36, VIEW, "MEDIUM"), M([0, D["near"][2][1], -0.5]), -34),
                (txt(TX["p1.far"], 36, VIEW, "MEDIUM"), M([0, D["far"][2][1], -3]), -34)]
        tag = txt(TX["p1.tag"], 36, INK_DIM, "MEDIUM")
        tag.move_to(P(96 + tag.width / U / 2, 80 + 25))
        cap = txt(TX["p1.cap"], 44).move_to(P(960, 900 + 31))
        cap_c = cap.get_center()
        self.add_fixed_in_frame_mobjects(tag, cap, *[l for l, _, _ in labs])

        clock = ValueTracker(0)
        k_orbit = lambda t: G["power2.inOut"](min(max((t - B["orbit"]) / (B["orbitEnd"] - B["orbit"]), 0), 1))  # noqa: E731

        def frame(_):
            t = clock.get_value()
            cam.set_theta(math.radians(O["az0"] + 360 * k_orbit(t) - 90))
            cam.reset_rotation_matrix()  # 否则要到截帧时才刷新，投影会晚一帧
            for e in edges:
                k = G["power2.out"](min(max((t - e["at"]) / D["draw"], 0), 1))
                e["m"].become(e["mk"](e["a"], e["a"] + (e["b"] - e["a"]) * max(k, 1e-3)))
                e["m"].set_stroke(VIEW, 3 * SW, 1 if k > 0 else 0)
            for p in planes:
                p.set_fill(opacity=0.15 * G["power2.out"](min(max((t - B["planes"]) / 0.5, 0), 1)))
            a = G["power3.out"](min(max((t - B["labels"]) / 0.5, 0), 1))
            for m, p, dy in labs:
                q = cam.project_point(p)
                m.move_to(q + np.array([0, -dy * U, 0])).set_opacity(a)
            ca = track(t, [(B["cap"], 0.5, 0, 1, G["power3.out"]), (B["capOut"], 0.3, 1, 0, G["power2.in"])])
            k = min(max((t - B["cap"]) / 0.5, 0), 1)
            cap.move_to(cap_c + [0, -16 * (1 - G["power3.out"](k)) * U, 0])  # 不用 become：会换掉子对象，丢失屏幕固定
            cap.set_opacity(ca if t >= B["cap"] else 0)

        ticker.add_updater(frame)
        frame(None)
        self.play(clock.animate.set_value(D["duration"]), run_time=D["duration"], rate_func=rate_functions.linear)

