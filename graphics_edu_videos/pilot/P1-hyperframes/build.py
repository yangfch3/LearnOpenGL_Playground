"""P1 唯一时间源：assets/data/p1.js（场景参数、节拍），回写 index.html 时长。Manim 版也读这里的产物。无音效。"""
import math
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import load_text, read_need, set_duration, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
FOV, ASPECT, NEAR, FAR = 45, 16 / 9, 0.5, 3.0
hn = NEAR * math.tan(math.radians(FOV / 2))
hf = FAR * math.tan(math.radians(FOV / 2))
near = [[sx * hn * ASPECT, sy * hn, -NEAR] for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
far = [[sx * hf * ASPECT, sy * hf, -FAR] for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
r4 = lambda pts: [[round(c, 5) for c in p] for p in pts]  # noqa: E731

# 棱线绘制顺序：视点到近平面（虚线，示意锥顶）→ 近平面 → 侧棱 → 远平面
edges = ([{"a": [0, 0, 0], "b": near[i], "dashed": True} for i in range(4)]
         + [{"a": near[i], "b": near[(i + 1) % 4]} for i in range(4)]
         + [{"a": near[i], "b": far[i]} for i in range(4)]
         + [{"a": far[i], "b": far[(i + 1) % 4]} for i in range(4)])
DRAW, STAGGER = 0.35, 0.1
for k, e in enumerate(edges):
    e["at"] = round(k * STAGGER, 4)
    e["a"], e["b"] = r4([e["a"], e["b"]])
b = {"planes": 1.5, "labels": 1.9, "orbit": 2.0, "orbitEnd": 14.0, "cap": 2.0}
b["capOut"] = b["cap"] + 0.5 + read_need(TX["p1.cap"])
assert edges[-1]["at"] + DRAW <= 2.0 and b["capOut"] <= 8.0, b
duration = 16.0

data = {"duration": duration, "fov": FOV, "aspect": ASPECT, "near": r4(near), "far": r4(far), "edges": edges, "draw": DRAW,
        "cube": {"c": [0, 0, -1.8], "s": 0.6}, "beats": b,
        "orbit": {"target": [0, -0.75, -1.5], "dist": 10.0, "pitch": 20, "az0": 40, "fov": 35}}
write_js(ROOT / "assets/data/p1.js", "P1", data)
set_duration(ROOT / "index.html", duration)
print("duration", duration, b)
