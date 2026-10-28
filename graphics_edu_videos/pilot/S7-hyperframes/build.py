"""S7 唯一时间源：生成 assets/data/s7.js（动画事件）、assets/sfx/s7.wav（音效轨），并回写 index.html 的时长。"""
import json
import math
import re
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
SR, FPS = 48000, 60
VERTS = [(4, 3), (12, 3), (8, 9)]
ROWS = [3, 4, 5, 6, 7]
EMPTY_ROW = 8
SCAN_IN = 0.4
HOVER_DELAY, APPEAR_STEP, APPEAR_DUR, FLOAT = 0.35, 0.035, 0.3, 0.3
SPREAD, CASCADE_P = 0.13, 1.4      # 掉落起点间隔基数；>1 时间隔逐个缩短
H_LOW, H_HIGH, FALL_BASE = 1.25, 1.8, 0.30
AFTER = 1.0                        # 末个落地到下一行开始

text = json.loads(re.search(r"window\.TEXT = (\{.*\});", (ROOT / "assets/text/zh-CN.js").read_text(encoding="utf-8"), re.S).group(1))
rng = np.random.default_rng(7)


def read_need(s):
    n = len(re.findall(r"[\u4e00-\u9fff]", s)) + len(re.findall(r"[A-Za-z0-9_.]+", s))
    return max(2.0, 1.0 + 0.25 * n)


def edge(a, b, p):
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def covered(j):
    e = list(zip(VERTS, VERTS[1:] + VERTS[:1]))
    return [i for i in range(16) if all(edge(a, b, (i + 0.5, j + 0.5)) > 0 for a, b in e)]


t, rows = 0.0, []
for r, j in enumerate(ROWS):
    cols = covered(j)
    n = len(cols)
    appear0 = t + HOVER_DELAY
    drop0 = appear0 + APPEAR_STEP * (n - 1) + APPEAR_DUR + FLOAT
    span = SPREAD * (n - 1)
    px = []
    for k, i in enumerate(cols):
        u = k / (n - 1)
        h = (H_HIGH if k % 2 else H_LOW) + 0.1 * rng.random()
        drop = drop0 + span * (1 - (1 - u) ** CASCADE_P)
        land = drop + FALL_BASE * math.sqrt(h / H_LOW)
        px.append({"i": i, "h": round(h, 3), "appear": round(appear0 + APPEAR_STEP * k, 4),
                   "drop": round(drop, 4), "land": round(land, 4), "accent": False})
    last = max(px, key=lambda p: p["land"])
    last["accent"] = True
    accent = last["land"]
    rows.append({"j": j, "start": round(t, 4), "pixels": px, "accentAt": accent,
                 "countAt": round(accent + 0.2, 4), "count": n})
    t = accent + AFTER

assert not covered(EMPTY_ROW)
empty = {"j": EMPTY_ROW, "start": round(t, 4), "restAt": round(t + 0.6, 4), "countAt": round(t + 0.7, 4), "count": 0}
caption_at = t + 0.9
out_at = caption_at + 0.5 + read_need(text["s7.empty"])
formula_at, sumline_at = out_at + 0.35, out_at + 0.6
sum_at = sumline_at + 0.4
total = sum(r["count"] for r in rows)
assert total == 24 and [r["count"] for r in rows] == [8, 6, 4, 4, 2]
formula = " + ".join(str(r["count"]) for r in rows + [empty]) + f" = {total}"
end = sumline_at + 0.5 + max(read_need(text["s7.total"].replace("{n}", str(total))), read_need(formula)) + 0.3
duration = math.ceil(end * 10) / 10

data = {"duration": duration, "cell": 56, "verts": VERTS, "scanIn": SCAN_IN, "appearDur": APPEAR_DUR,
        "rows": rows, "empty": empty, "total": total, "formula": formula,
        "captionAt": round(caption_at, 4), "outAt": round(out_at, 4), "formulaAt": round(formula_at, 4),
        "sumLineAt": round(sumline_at, 4), "sumAt": round(sum_at, 4)}
(ROOT / "assets/data").mkdir(parents=True, exist_ok=True)
(ROOT / "assets/data/s7.js").write_text("window.S7 = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
html = ROOT / "index.html"
html.write_text(re.sub(r'data-duration="[\d.]+"', f'data-duration="{duration:g}"', html.read_text(encoding="utf-8")), encoding="utf-8")

# ---- 音效：落地木琴音（越往右越高），空行低音，合计琶音 ----
PENT = [261.63 * 2 ** ((12 * (k // 5) + [0, 2, 4, 7, 9][k % 5]) / 12) for k in range(20)]
buf = np.zeros(int(duration * SR))


def mallet(f, amp, decay):
    dur = decay * 5
    tt = np.arange(int(dur * SR)) / SR
    sig = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / decay)
           + 0.35 * np.sin(2 * np.pi * 3.93 * f * tt) * np.exp(-tt / (decay * 0.3))
           + 0.1 * np.sin(2 * np.pi * 9.2 * f * tt) * np.exp(-tt / (decay * 0.12)))
    sig += 0.15 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.002)
    return amp * sig * np.minimum(tt / 0.001, 1) * np.minimum((dur - tt) / 0.03, 1)


def thump(amp):
    tt = np.arange(int(0.25 * SR)) / SR
    return amp * np.sin(2 * np.pi * (90 - 40 * tt) * tt) * np.exp(-tt / 0.06)


def place(at, sig):
    i = int(round((at + 1 / FPS) * SR))  # 声音晚画面 1 帧
    buf[i:i + len(sig)] += sig[:len(buf) - i]


for r, row in enumerate(rows):
    for p in row["pixels"]:
        f = PENT[p["i"] - 4 + 2 * r]
        place(p["land"], mallet(f, 0.5 if p["accent"] else 0.32, 0.35 if p["accent"] else 0.2))
        if p["accent"]:
            place(p["land"], thump(0.35))
place(empty["restAt"], mallet(130.81, 0.3, 0.15))
for k, f in enumerate([523.25, 659.25, 783.99, 1046.50]):
    place(sum_at + 0.06 * k, mallet(f, 0.35, 0.6))

buf *= 0.5 / np.abs(buf).max()     # 峰值归一到 -6 dBFS
pcm = (buf * 32767).astype("<i2")
(ROOT / "assets/sfx").mkdir(parents=True, exist_ok=True)
with wave.open(str(ROOT / "assets/sfx/s7.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(np.repeat(pcm, 2).tobytes())
print("counts", [r["count"] for r in rows], "total", total, "duration", duration,
      "row starts", [r["start"] for r in rows], "empty", empty["start"], "sum", round(sum_at, 2))
