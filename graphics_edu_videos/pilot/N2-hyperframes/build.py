"""N2「慢递」唯一时间源：assets/data/n2.js（布局、节拍、镜头、角色路径）、assets/sfx/n2.wav、assets/bgm/n2.wav。"""
import math
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import SR, load_text, read_need, set_duration, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")

from layout import BAKER_DOOR, LAY, MARKET, ROAD, make_pines  # noqa: E402
import collide  # noqa: E402

# ---- 节拍（镜内秒）----
b = {}
b.update(open=0.0, bell=1.4, pigeons=1.6, title=1.8)
b["titleOut"] = b["title"] + 0.8 + read_need(TX["n2.title"]) + 1.5
b.update(dive=6.4, diveEnd=8.2)
# 春·室内（2D）
b.update(inA=7.6, write=8.4, writeEnd=11.2, env=11.6, envText=12.2)
b["stamp"] = b["envText"] + 0.6 + read_need(TX["n2.envTo"])
b.update(standUp=b["stamp"] + 1.2)
b["outA"] = b["standUp"] + 0.9
# 春·街道
b["spring"] = b["outA"] + 0.5
b.update(post=b["spring"] + 2.6, bikeIn=b["spring"] + 2.6, pickUp=b["spring"] + 5.0, toDock=b["spring"] + 6.0,
         boat=b["spring"] + 9.4, boatGone=b["spring"] + 12.6)
# 夏
b["summer"] = b["boatGone"] - 0.6
b.update(lapse1=b["summer"], lapse1End=b["summer"] + 3.2, market=b["summer"] + 3.2)
b["ask"] = b["market"] + 3.0
b["reply"] = b["ask"] + 0.5 + read_need(TX["n2.ask"]) + 0.2
b["summerEnd"] = b["reply"] + 0.5 + read_need(TX["n2.reply"]) + 0.6
# 秋
b.update(lapse2=b["summerEnd"], lapse2End=b["summerEnd"] + 3.2)
b.update(geese=b["lapse2End"] + 0.2, fish=b["lapse2End"] + 2.6, dockSit=b["lapse2End"] + 4.6, leaf=b["lapse2End"] + 7.6)
b["leafEnd"] = b["leaf"] + 3.0
# 冬
b.update(winter=b["leafEnd"] - 0.6, dusk=b["leafEnd"] + 2.0, night=b["leafEnd"] + 4.5, boatBack=b["leafEnd"] + 4.0)
b.update(boatDock=b["boatBack"] + 3.5, walk=b["boatBack"] + 4.0)
b["knock"] = b["walk"] + 6.0
b["inB"] = b["knock"] + 1.2
# 冬·室内：信逐行
b["letter"] = b["inB"] + 1.8
lines, t = [], b["letter"]
for k in ("l1", "l2", "l3", "l4"):
    lines.append(round(t, 4))
    t += 0.6 + read_need(TX[f"n2.{k}"]) * 0.75
b["letterEnd"] = t + 1.2
# 尾声
b.update(outB=b["letterEnd"], dawn=b["letterEnd"] + 0.6, bud=b["letterEnd"] + 2.4, pull=b["letterEnd"] + 1.0)
b["endText"] = b["bud"] + 1.6
duration = math.ceil((b["endText"] + 0.6 + read_need(TX["n2.end"]) + 1.8) * 10) / 10

# ---- 季节系数：s ∈ [0, 4)，0 春 1 夏 2 秋 3 冬；n 夜晚系数 ----
SEASON = [[0, 0.0], [b["lapse1"], 0.0], [b["lapse1End"], 1.0], [b["lapse2"], 1.0], [b["lapse2End"], 2.0],
          [b["winter"], 2.0], [b["winter"] + 1.6, 3.0], [b["bud"], 3.0], [b["bud"] + 3.0, 3.6]]
NIGHT = [[0, 0.0], [b["dusk"], 0.0], [b["night"], 1.0], [b["dawn"], 1.0], [b["dawn"] + 2.4, 0.0]]

# ---- 镜头：除开场与结尾外均为人眼高度（约 1.6m），镜头内只做轻摇轻推，段间直接切 ----
W = LAY["window"]
DR = LAY["door"]
E1 = 1.6
SHOTS = [
    {"k": "orbit", "t0": 0, "t1": b["dive"], "c": [0, 1, 0], "r": [34, 32], "h": [10, 9], "a": [200, 214], "fov": 38, "e": "sine"},
    {"k": "cut", "t0": b["dive"], "p": [-5.0, E1, 7.6], "l": [W[0], W[1], W[2]], "fov": 40},
    {"k": "move", "t0": b["dive"], "t1": b["inA"] + 0.6, "p1": [-6.0, 1.58, 5.6], "l1": [W[0], W[1], W[2]], "fov": 40, "e": "io2"},
    {"k": "cut", "t0": b["inA"] + 0.7, "p": [-1.8, 5.2, 12.2], "l": [-5.6, 0.8, 4.4], "fov": 40},
    {"k": "move", "t0": b["spring"], "t1": b["post"] + 0.5, "p1": [-1.8, 5.2, 12.2], "l1": [-5.8, 0.8, 4.6], "fov": 40, "e": "io2"},
    {"k": "move", "t0": b["bikeIn"], "t1": b["pickUp"], "p1": [-1.4, 5.2, 12.0], "l1": [-4.8, 0.8, 4.9], "fov": 40, "e": "io2"},
    {"k": "cut", "t0": b["toDock"] + 0.2, "p": [7.0, 10.5, -4.0], "l": [6.0, 0.3, 5.0], "fov": 46},
    {"k": "move", "t0": b["boat"] - 0.4, "t1": b["boatGone"], "p1": [7.4, 10.5, -4.2], "l1": [24.0, -2.0, -3.0], "fov": 46, "e": "io2"},
    {"k": "cut", "t0": b["summer"], "p": [-1.2, E1, 8.6], "l": [1.0, 1.1, 3.2], "fov": 40},
    {"k": "move", "t0": b["market"] + 1.6, "t1": b["summerEnd"], "p1": [-1.1, 1.65, 8.8], "l1": [0.2, 1.3, 5.2], "fov": 40, "e": "io2"},
    {"k": "cut", "t0": b["lapse2"], "p": [7.0, 9.0, -17.0], "l": [0.0, 0.0, -6.4], "fov": 40},
    {"k": "move", "t0": b["geese"] - 0.2, "t1": b["geese"] + 2.4, "p1": [7.0, 9.0, -17.0], "l1": [-1.0, 4.0, -6.0], "fov": 40, "e": "io2"},
    {"k": "cut", "t0": b["fish"], "p": [8.2, 3.8, -5.6], "l": [5.2, 0.3, -9.4], "fov": 38},
    {"k": "move", "t0": b["fish"], "t1": b["dockSit"], "p1": [7.9, 3.6, -5.9], "l1": [5.2, 0.3, -9.4], "fov": 38, "e": "io2"},
    {"k": "cut", "t0": b["dockSit"], "p": [10.2, 4.6, 9.8], "l": [15.0, 0.6, 4.0], "fov": 38},
    {"k": "move", "t0": b["dockSit"], "t1": b["leaf"] + 1.0, "p1": [10.6, 4.6, 9.6], "l1": [17.0, 1.0, 2.6], "fov": 38, "e": "io2"},
    {"k": "cut", "t0": b["winter"], "p": [3.0, 9.0, 9.0], "l": [-5.5, 0.5, -3.5], "fov": 42},
    {"k": "move", "t0": b["winter"], "t1": b["boatBack"], "p1": [3.0, 9.0, 9.0], "l1": [-5.0, 0.5, -3.0], "fov": 42, "e": "io2"},
    {"k": "cut", "t0": b["boatBack"], "p": [9.6, 5.2, 11.0], "l": [16.0, 0.2, 1.8], "fov": 40},
    {"k": "move", "t0": b["boatBack"], "t1": b["boatDock"], "p1": [9.8, 5.0, 10.8], "l1": [15.0, 0.4, 3.0], "fov": 40, "e": "io2"},
    {"k": "follow", "t0": b["walk"], "t1": b["walk"] + 2.99, "who": "postman", "off": [-3.4, 3.4, 2.6], "lu": 1.1, "blend": 1.0},
    {"k": "cut", "t0": b["walk"] + 3.0, "p": [-2.4, 3.6, 8.8], "l": [-5.6, 1.0, 3.8], "fov": 38},
    {"k": "move", "t0": b["knock"] - 1.0, "t1": b["knock"] + 0.6, "p1": [-3.2, 3.2, 7.8], "l1": [DR[0], 1.2, 3.4], "fov": 38, "e": "io2"},
    {"k": "cut", "t0": b["inB"] + 0.7, "p": [W[0], E1, W[2] + 0.5], "l": [-5.0, 1.5, 9.0], "fov": 42},
    {"k": "move", "t0": b["outB"], "t1": b["bud"], "p1": [W[0] + 0.1, E1, W[2] + 1.2], "l1": [-5.0, 1.5, 9.0], "fov": 42, "e": "io2"},
    {"k": "cut", "t0": b["bud"], "p": [-5.6, E1, -2.2], "l": [-8.0, 3.8, -5.0], "fov": 40},
    {"k": "move", "t0": b["bud"], "t1": b["bud"] + 2.6, "p1": [-6.0, E1, -2.8], "l1": [-8.0, 3.8, -5.0], "fov": 40, "e": "io2"},
    {"k": "move", "t0": b["bud"] + 3.0, "t1": duration, "p1": [22, 8, 24], "l1": [-1, 1, -1], "fov": 38, "e": "io2"},
]

# ---- 角色路径：[t, x, z]，段内 smoothstep；朝向取速度方向 ----
ACT = {
    "girl": {"path": [[0, DR[0], 3.6], [b["spring"] + 0.6, DR[0], 3.6], [b["post"] - 0.6, -6.0, 4.4],
                      [b["summer"], -6.0, 4.4], [b["summer"] + 0.1, -0.6, 5.4], [b["summerEnd"], -0.6, 5.4],
                      [b["summerEnd"] + 0.1, 14.8, 4.2]],
             "show": [[b["spring"], b["lapse1"]], [b["lapse1End"], b["summerEnd"]], [b["lapse2End"], b["leafEnd"]]], "sitAt": b["lapse2End"]},
    "postman": {"path": [[0, 5.0, 5.6], [b["bikeIn"], 5.0, 5.6], [b["pickUp"] - 0.4, -5.0, 5.1], [b["toDock"], -5.0, 5.1],
                         [b["toDock"] + 1.2, 0.0, 5.6], [b["toDock"] + 2.0, 3.0, 5.6], [b["toDock"] + 2.8, 7.0, 5.3],
                         [b["toDock"] + 3.6, 11.0, 4.6], [b["boat"] - 0.6, 13.0, 4.3], [b["summer"], 13.0, 4.3],
                         [b["summer"] + 0.1, 0.5, 5.5], [b["summerEnd"], 0.5, 5.5], [b["summerEnd"] + 0.1, 13.0, 4.3],
                         [b["walk"], 13.0, 4.3], [b["walk"] + 2.99, 9.4, 4.9], [b["walk"] + 3.0, -2.4, 5.5],
                         [b["knock"] - 0.3, DR[0], 3.75]],
                "show": [[b["spring"], b["lapse1"]], [b["lapse1End"], b["summerEnd"]], [b["winter"] + 3.5, b["inB"]]],
                "bike": [[b["spring"], b["summerEnd"]]]},
    "baker": {"path": [[0, round(BAKER_DOOR[0], 3), 6.15]], "show": [[b["spring"], b["summerEnd"]]]},
    "fisher": {"path": [[0, LAY["bridge"][0] + 0.45, LAY["bridge"][1]]], "show": [[b["lapse2"], b["leafEnd"]]]},
}
BOAT = [[0, 15.4, 2.6], [b["boat"], 15.4, 2.6], [b["boatGone"], 34, -6], [b["boatBack"], 34, -6], [b["boatDock"], 15.4, 2.6]]
SUN = [[0, 40], [b["lapse1"], 40], [b["lapse1End"], 220], [b["lapse2"], 220], [b["lapse2End"], 400]]
DEER = [[LAY["tree"][0] + 2.5 + 1.6 * i, LAY["tree"][1] + 2.0 - 0.8 * i] for i in range(2)]
DUCKS = [{"cx": cx, "ax": 1.8, "az": 0.35, "w": 0.22, "ph": ph} for cx, ph in [(-5.2, 0.0), (-4.6, 2.1), (-0.8, 1.0), (0.2, 4.0), (5.0, 2.6), (5.8, 5.0)]]


def path_at(p, t):
    if t <= p[0][0]:
        return p[0][1:]
    for (t0, x0, z0), (t1, x1, z1) in zip(p, p[1:]):
        if t < t1:
            k = (t - t0) / (t1 - t0)
            k = k * k * (3 - 2 * k)
            return [x0 + (x1 - x0) * k, z0 + (z1 - z0) * k]
    return p[-1][1:]


def footsteps(p, t0, t1, stride=0.62):
    """按路程每 stride 一步，与 JS 步行相位同一公式（相位 = 路程 / stride × π）"""
    out, acc, prev = [], 0.0, path_at(p, t0)
    for i in range(1, int((t1 - t0) * 240) + 1):
        t = t0 + i / 240
        q = path_at(p, t)
        acc += math.hypot(q[0] - prev[0], q[1] - prev[1])
        prev = q
        if acc >= stride * (len(out) + 1):
            out.append(round(t, 4))
    return out


snow_steps = footsteps(ACT["postman"]["path"], b["walk"], b["walk"] + 2.98) + footsteps(ACT["postman"]["path"], b["walk"] + 3.0, b["knock"] - 0.3)
girl_steps = footsteps(ACT["girl"]["path"], b["spring"] + 0.4, b["post"] - 0.2, 0.5)
PINES = make_pines([s.get("p", [99, 0, 99]) for s in SHOTS if s.get("p", [0, 9])[1] < 3], np.random.default_rng(5))
errs = collide.check(b, ACT, SHOTS, PINES, DEER, duration)
first = {}
for e in errs:  # 同一问题只记首次时刻与次数
    t_, msg = e.split(" ", 1)
    key = msg.rsplit(" ", 1)[0] if ("重叠" in msg or "出岛" in msg) else msg
    first.setdefault(key, [t_, 0])[1] += 1
(ROOT.parent.parent / "Temp/n2_collide.txt").write_text("\n".join(f"{v[0]} ×{v[1]} {k}" for k, v in first.items()), encoding="utf-8")
assert not errs, f"{len(errs)} 处碰撞"
data = {"duration": duration, "beats": {k: round(v, 4) for k, v in b.items()}, "lay": LAY, "road": ROAD, "shots": SHOTS,
        "act": ACT, "boat": BOAT, "pines": PINES, "market": MARKET, "sun": SUN, "deer": DEER, "ducks": DUCKS, "season": SEASON, "night": NIGHT, "letterLines": lines, "stride": 0.62}
write_js(ROOT / "assets/data/n2.js", "N2", data)
set_duration(ROOT / "index.html", duration)
print("duration", duration, "snow steps", len(snow_steps), {k: round(v, 2) for k, v in b.items()})

# ---- 音效 ----
from common import Track, mallet, sweep, thump  # noqa: E402

rng = np.random.default_rng(22)
tr = Track(duration)
TT = lambda d: np.arange(int(d * SR)) / SR  # noqa: E731


def lp_noise(d, cut, amp=1.0):
    x = rng.standard_normal(int(d * SR))
    a = math.exp(-2 * math.pi * cut / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):  # 一阶低通
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return amp * y / (np.abs(y).max() + 1e-9)


def bell(f, amp):
    t = TT(5.0)
    parts = [(0.5, 1.0, 4.0), (1.0, 0.8, 3.0), (1.19, 0.5, 2.0), (1.5, 0.4, 1.6), (2.0, 0.35, 1.2), (2.74, 0.2, 0.8)]
    return amp * sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in parts) * np.minimum(t / 0.003, 1)


def flutter(d, amp, rate):
    t = TT(d)
    return lp_noise(d, 2500, amp) * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t)) ** 2 * np.sin(np.pi * t / d)


def chirp(amp):
    t = TT(0.09)
    f0 = 3200 + 1200 * rng.random()
    return amp * np.sin(2 * np.pi * np.cumsum(f0 + 1500 * np.sin(2 * np.pi * 22 * t)) / SR) * np.sin(np.pi * t / 0.09)


def honk(f, amp, d=0.22):
    t = TT(d)
    sq = np.sign(np.sin(2 * np.pi * f * t + 2 * np.sin(2 * np.pi * 7 * t)))
    return amp * np.convolve(sq, np.ones(12) / 12, mode="same") * np.sin(np.pi * t / d) ** 0.5


def horn(d, amp):
    t = TT(d)
    s = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(110, 1), (220, 0.5), (330, 0.3), (165, 0.4)])
    return amp * s * np.minimum(t / 0.25, 1) * np.minimum((d - t) / 0.6, 1)


def crunch(amp):
    return lp_noise(0.16, 1800, amp) * np.exp(-TT(0.16) / 0.05)


def click(amp, cut=6000, d=0.03):
    return lp_noise(d, cut, amp) * np.exp(-TT(d) / (d / 5))


def bed(t0, t1, cut, amp, mod=0.0, rate=0.3):
    d = t1 - t0
    t = TT(d)
    env = np.minimum(t / 1.2, 1) * np.minimum((d - t) / 1.2, 1) * (1 + mod * np.sin(2 * np.pi * rate * t))
    tr.place(t0, lp_noise(d, cut, amp) * env)


for k in range(3):
    tr.place(b["bell"] + 1.1 * k, bell(392.0, 0.5))
tr.place(b["pigeons"], flutter(1.6, 0.35, 11))
for t in np.arange(0.4, b["dive"], 0.9):
    tr.place(float(t + 0.3 * rng.random()), chirp(0.12))
for t in np.arange(b["write"], b["writeEnd"], 0.21):
    tr.place(float(t + 0.05 * rng.random()), lp_noise(0.14, 7000, 0.07) * np.sin(np.pi * TT(0.14) / 0.14))
tr.place(b["stamp"], thump(0.5, 80))
tr.place(b["stamp"], click(0.35, 3000, 0.05))
for t in girl_steps:
    tr.place(t, click(0.12, 900, 0.05))
tr.place(b["post"], click(0.3, 2500, 0.08))
for k in range(2):
    tr.place(b["bikeIn"] + 0.6 + 0.14 * k, bell(1568.0, 0.18))
bed(b["spring"], b["boatGone"], 600, 0.05)
for t in np.arange(b["spring"], b["boatGone"], 0.7):
    tr.place(float(t + 0.4 * rng.random()), chirp(0.09))
tr.place(b["boat"], horn(1.8, 0.28))
bed(b["market"], b["summerEnd"], 900, 0.16, 0.4, 1.7)
for t in np.arange(b["market"], b["summerEnd"], 1.3):
    tr.place(float(t + 0.6 * rng.random()), honk(520 + 80 * rng.random(), 0.06, 0.12))
bed(b["lapse2End"], b["leafEnd"], 400, 0.08, 0.5, 0.15)
for k in range(5):
    tr.place(b["geese"] + 0.6 + 0.55 * k + 0.2 * rng.random(), honk(330 + 30 * rng.random(), 0.1))
tr.place(b["fish"] + 0.8, lp_noise(0.5, 3500, 0.3) * np.exp(-TT(0.5) / 0.12))
tr.place(b["leaf"], sweep(300, 1200, 2.4, 0.04) + lp_noise(2.4, 1500, 0.12) * np.sin(np.pi * TT(2.4) / 2.4))
bed(b["winter"], b["inB"], 500, 0.14, 0.6, 0.12)
tr.place(b["boatBack"] + 0.4, horn(2.2, 0.3))
for t in snow_steps:
    tr.place(t, crunch(0.22))
for k in range(3):
    tr.place(b["knock"] + 0.22 * k, thump(0.4, 120))
    tr.place(b["knock"] + 0.22 * k, click(0.25, 2000, 0.04))
bed(b["inB"], b["letterEnd"], 300, 0.06)
for t in np.arange(b["inB"], b["letterEnd"], 0.23):
    if rng.random() < 0.45:
        tr.place(float(t), click(0.1 + 0.1 * rng.random(), 4000, 0.02))
for t in np.arange(b["dawn"], duration - 1, 0.55):
    tr.place(float(t + 0.3 * rng.random()), chirp(0.11))
tr.place(b["bud"], mallet(1046.5, 0.25, 0.5, rng))
tr.place(b["bud"] + 0.12, mallet(1567.98, 0.2, 0.6, rng))
tr.write(ROOT / "assets/sfx/n2.wav")

# ---- 背景音乐：循环段首尾无缝，平铺到片长，片头片尾淡入淡出 ----
with wave.open(str(ROOT / "assets/bgm/loop.wav"), "rb") as w:
    loop = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2).astype(float) / 32767
n = int(duration * SR)
bgm = np.tile(loop, (n // len(loop) + 1, 1))[:n]
t = np.arange(n) / SR
bgm *= (np.minimum(t / 3.0, 1) * np.minimum((duration - t) / 4.0, 1))[:, None]
with wave.open(str(ROOT / "assets/bgm/n2.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((bgm * 32767).astype("<i2").tobytes())
