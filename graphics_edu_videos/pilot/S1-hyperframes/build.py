"""S1 唯一时间源：生成 assets/data/s1.js（节拍与版式）、assets/sfx/s1.wav，回写 index.html 时长。Manim 版也读这里的产物。"""
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import Track, load_text, mallet, read_need, set_duration, sweep, thump, write_js  # noqa: E402

T = load_text(ROOT / "assets/text/zh-CN.js")
rng = np.random.default_rng(1)
IN, OUT = 0.5, 0.3

# 版式：9 站一行，标签上下交错
ST_X = [360 + 150 * i for i in range(9)]
TRACK_Y, SRC_X, DST_X = 480, 180, 1740
SHADER, FIXED = [0, 6], [1, 2, 3, 4, 5, 7]

# 节拍（镜内秒，对应分镜镜头 1 的 20s 起）
b = {}
b["flow"] = 0.2                       # 光点从逐样本操作流向帧缓冲
b["lit"] = b["flow"] + 0.7            # 帧缓冲点亮
b["opt"] = 3.6                        # 可选阶段虚线框浮出
b["optLand"] = b["opt"] + IN
b["capOptOut"] = b["optLand"] + read_need(T["s1.cap.opt"])
b["shader"] = b["capOptOut"] + OUT    # 两站变着色器样式，依次间隔 0.4s
b["shaderGap"] = 0.4
b["capShaderOut"] = b["shader"] + IN + read_need(T["s1.cap.shader"])
b["fixed"] = b["capShaderOut"] + OUT
b["fixedGap"] = 0.08
b["capFixedOut"] = b["fixed"] + IN + read_need(T["s1.cap.fixed"])
b["shrink"] = b["capFixedOut"] + 0.15
b["shrinkDur"] = 0.8
duration = math.ceil((b["shrink"] + b["shrinkDur"] + 0.6) * 10) / 10
assert 19 <= duration <= 21, duration

data = {"duration": duration, "beats": {k: round(v, 4) for k, v in b.items()}, "stX": ST_X, "trackY": TRACK_Y,
        "srcX": SRC_X, "dstX": DST_X, "shader": SHADER, "fixed": FIXED,
        "bar": {"y": 110, "scale": 0.6}}
write_js(ROOT / "assets/data/s1.js", "S1", data)
set_duration(ROOT / "index.html", duration)

# 音效：点亮（第 9 站，逐站升调的最高音）、低音、着色器两声、收拢
MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14]
tr = Track(duration)
tr.place(b["lit"], mallet(523.25 * 2 ** (MAJOR[8] / 12), 0.45, 0.25, rng))
tr.place(b["optLand"], mallet(130.81, 0.4, 0.3, rng))
tr.place(b["optLand"], thump(0.3, 70))
for k in range(2):
    tr.place(b["shader"] + k * b["shaderGap"], mallet([659.25, 880.0][k], 0.38, 0.3, rng))
tr.place(b["shrink"], sweep(900, 300, b["shrinkDur"], 0.25))
tr.place(b["shrink"] + b["shrinkDur"], mallet(392.0, 0.3, 0.12, rng))
tr.write(ROOT / "assets/sfx/s1.wav")
print("duration", duration, {k: round(v, 2) for k, v in b.items()})
