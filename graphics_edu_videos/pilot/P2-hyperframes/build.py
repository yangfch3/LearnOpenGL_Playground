"""P2 唯一时间源：assets/data/p2.js（矩阵、节拍）、assets/sfx/p2.wav。Manim 版也读这里的产物。"""
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import Track, load_text, mallet, read_need, set_duration, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
rng = np.random.default_rng(2)
M = [[1, 0, 0, 2], [0, 1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]]
V = [1, 1, 0, 1]
R = [sum(M[r][k] * V[k] for k in range(4)) for r in range(4)]
assert R == [3, 2, 0, 1]


def need(s):  # 字幕内只有坐标、单个数，按普通字数计
    return read_need(s.replace("$", ""))


b = {"cap1": 0.4}
b["cap1Out"] = b["cap1"] + 0.5 + need(TX["p2.cap1"])
TERM, FLY, SUM_FLY = 0.65, 0.45, 0.5
rows = []
for r, start in enumerate([5.0, 9.0]):
    terms = [round(start + 0.15 + k * TERM, 4) for k in range(4)]
    sum_at = start + 0.15 + 4 * TERM
    rows.append({"r": r, "start": start, "terms": terms, "lands": [round(t + 0.15 + FLY, 4) for t in terms],
                 "sumAt": round(sum_at, 4), "sumFly": round(sum_at + 0.4, 4), "sumLand": round(sum_at + 0.4 + SUM_FLY, 4)})
direct = [{"r": 2, "start": 13.0, "pop": 13.3}, {"r": 3, "start": 14.0, "pop": 14.3}]
b["col"] = 15.0
b["cap2"] = 15.3
b["cap2Out"] = b["cap2"] + 0.5 + need(TX["p2.cap2"])
duration = 20.0
assert b["cap1Out"] <= 5.0 and b["cap2Out"] <= duration, b

data = {"duration": duration, "M": M, "V": V, "R": R, "beats": {k: round(v, 4) for k, v in b.items()},
        "fly": FLY, "sumFlyDur": SUM_FLY, "rows": rows, "direct": direct}
write_js(ROOT / "assets/data/p2.js", "P2", data)
set_duration(ROOT / "index.html", duration)

tr = Track(duration)
for row in rows:
    for k, t in enumerate(row["lands"]):
        tr.place(t, mallet(880 * 2 ** (k * 2 / 12), 0.22, 0.12, rng))
    tr.place(row["sumLand"], mallet(523.25, 0.4, 0.3, rng))
for d in direct:
    tr.place(d["pop"], mallet(523.25 * 2 ** (-(d["r"] - 1) * 2 / 12), 0.35, 0.25, rng))
for f in (392.0, 587.33):
    tr.place(b["col"], mallet(f, 0.3, 0.5, rng))
tr.write(ROOT / "assets/sfx/p2.wav")
print("duration", duration, b, [r["sumLand"] for r in rows])
