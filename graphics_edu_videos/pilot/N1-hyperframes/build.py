"""N1 剧情探针唯一时间源：assets/data/n1.js（节拍、步伐、版式、覆盖像素）、assets/sfx/n1.wav，回写 index.html 时长。"""
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import SR, Track, load_text, mallet, read_need, set_duration, sweep, thump, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
rng = np.random.default_rng(11)
b = {}

# ---- A 房间：走入、放杯、坐下、推镜、双击、弹窗、拉镜、冒想法 ----
WALK = {"t0": 0.2, "t1": 3.6, "x0": -120, "x1": 700, "stride": 150}
b.update(cupReach=3.6, cupDown=4.15, armBack=4.2, turn=4.5, sit=4.9, sitLand=5.55, mouse=5.8,
         push=6.0, pushEnd=8.2, cursor=8.3, cursorEnd=9.0, click1=9.1, click2=9.25, popup=9.5,
         pull=13.0, pullEnd=14.6, bubble=14.8, think1=15.1)
ease_out1 = lambda k: 1 - (1 - k) ** 2  # noqa: E731  GSAP power1.out
steps = []
for k in range(1, 20):
    x = WALK["x0"] + k * WALK["stride"]
    if x >= WALK["x1"]:
        break
    q = (x - WALK["x0"]) / (WALK["x1"] - WALK["x0"])  # 解 power1.out 的反函数
    steps.append(round(WALK["t0"] + (1 - math.sqrt(1 - q)) * (WALK["t1"] - WALK["t0"]), 4))
need1, need2 = read_need(TX["n1.think1"]), read_need(TX["n1.think2"])
b["think2"] = b["think1"] + 0.5 + 1.0
b["bubbleOut"] = max(b["think1"] + 0.5 + need1, b["think2"] + 0.5 + need2)
b["trans"] = b["bubbleOut"] + 0.05
b["B"] = b["trans"] + 0.6                         # 场景 B 开始

# ---- B 左文右动画：管线 6 步，步名停留满足阅读时长 ----
b["ask"] = b["B"] + 0.2
plan = [("st1", 1.6), ("st2", 4.6), ("st3", 1.6), ("st4", 2.6), ("st5", 1.6), ("st6", 3.4)]  # 每步动画所需
t, st = b["B"] + 0.3, []
for key, dur in plan:
    st.append({"key": key, "at": round(t, 4)})
    t += max(dur, 0.5 + read_need(TX[f"n1.{key}"]))
b["end"] = t
duration = math.ceil((b["end"] + 0.4) * 10) / 10
S = {s["key"]: s["at"] for s in st}
b.update(v1=S["st1"] + 0.15, cam=S["st2"] + 0.1, rays=S["st2"] + 0.7, fly=S["st2"] + 1.6, flyEnd=S["st2"] + 3.6,
         edges=S["st3"] + 0.1, grid=S["st4"] + 0.05, raster=S["st4"] + 0.4, color=S["st5"] + 0.1, monitor=S["st6"] + 0.1)
assert b["ask"] + 0.5 + read_need(TX["n1.ask1"] + TX["n1.ask2"]) <= duration

# 屏幕平面：16×9 示意网格，面板内 800×450；三个顶点（网格坐标，y 向上）与各自深度
IMG = {"x": 1012, "y": 325, "w": 800, "h": 450, "nx": 16, "ny": 9}
VERTS = [(3.2, 1.4), (13.1, 2.3), (7.6, 7.8)]
DEPTH = [3.0, 3.6, 2.6]


def edge(a, c, p):
    return (c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0])


rows = []
for j in range(IMG["ny"]):
    cols = [i for i in range(IMG["nx"])
            if all(edge(a, c, (i + 0.5, j + 0.5)) > 0 for a, c in zip(VERTS, VERTS[1:] + VERTS[:1]))]
    if cols:
        rows.append({"j": j, "cols": cols})
RASTER_STEP = 1.6 / len(rows)
for r, row in enumerate(rows):
    row["at"] = round(b["raster"] + r * RASTER_STEP, 4)
covered = sum(len(r["cols"]) for r in rows)

data = {"duration": duration, "beats": {k: round(v, 4) for k, v in b.items()}, "steps": st, "walk": WALK, "footsteps": steps,
        "img": IMG, "verts": VERTS, "depth": DEPTH, "fovV": 40, "rows": rows, "rasterStep": round(RASTER_STEP, 4), "covered": covered,
        "panel": {"x": 1000, "y": 160, "w": 824, "h": 780}}
write_js(ROOT / "assets/data/n1.js", "N1", data)
set_duration(ROOT / "index.html", duration)

# ---- 音效 ----
tr = Track(duration)


def noise_burst(dur, amp, lp, decay):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    a = math.exp(-2 * math.pi * lp / SR)
    y = np.zeros(n)
    for i in range(1, n):  # 一阶低通
        y[i] = (1 - a) * x[i] + a * y[i - 1]
    tt = np.arange(n) / SR
    return amp * y / (np.abs(y).max() + 1e-9) * np.exp(-tt / decay)


def blip(f0, f1, dur, amp):
    return sweep(f0, f1, dur, amp)


for s in steps:
    tr.place(s, noise_burst(0.12, 0.25, 400, 0.03))
    tr.place(s, thump(0.12, 70))
tr.place(b["cupDown"], mallet(2093, 0.18, 0.08, rng))
tr.place(b["cupDown"], mallet(3136, 0.1, 0.05, rng))
tr.place(b["sitLand"], thump(0.35, 60))
tr.place(b["sitLand"], noise_burst(0.3, 0.12, 900, 0.08))
for c in ("click1", "click2"):
    tr.place(b[c], noise_burst(0.03, 0.35, 5000, 0.006))
tr.place(b["popup"], blip(500, 1100, 0.18, 0.25))
for k, f in enumerate([1318.5, 1760.0]):
    tr.place(b["bubble"] + 0.09 * k, mallet(f, 0.3, 0.25, rng))
tr.place(b["trans"], noise_burst(0.6, 0.15, 2500, 0.25) * np.sin(np.pi * np.arange(int(0.6 * SR)) / (0.6 * SR)))
for k in range(3):
    tr.place(b["v1"] + 0.3 * k, mallet([523.25, 659.25, 783.99][k], 0.3, 0.2, rng))
tr.place(b["cam"], mallet(196.0, 0.3, 0.35, rng))
tr.place(b["rays"], blip(400, 900, 0.5, 0.12))
tr.place(b["fly"], noise_burst(2.0, 0.12, 1200, 0.9) * np.sin(np.pi * np.arange(int(2.0 * SR)) / (2.0 * SR)))
for k in range(3):
    tr.place(b["edges"] + 0.25 * k, mallet(987.77, 0.22, 0.1, rng))
for r, row in enumerate(rows):
    tr.place(row["at"], mallet(1046.5 * 2 ** (r / 12), 0.15, 0.06, rng))
for f in (523.25, 659.25, 783.99):
    tr.place(b["color"], mallet(f, 0.2, 0.6, rng))
for k, f in enumerate([392.0, 523.25, 659.25, 1046.5]):
    tr.place(b["monitor"] + 0.06 * k, mallet(f, 0.28, 0.7, rng))
tr.write(ROOT / "assets/sfx/n1.wav")
print("duration", duration, "steps", steps, "covered", covered, {k: round(v, 2) for k, v in b.items()})
