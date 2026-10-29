"""N3「种子」唯一时间源：assets/data/n3.js（节拍、3D 布局）、assets/sfx/n3.wav、assets/bgm/n3.wav。"""
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import SR, load_text, read_need, set_duration, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
BAR = 3 * 60 / 80  # 3/4 拍，80 BPM
bar = lambda n: n * BAR  # noqa: E731

# ---- 节拍（秒）：换季的匹配剪辑落在小节线上，形变窗口为小节线前后各 0.3s ----
b = dict(seed0=0.0, push0=1.2, push1=3.0, title=3.4)
b["titleOut"] = b["title"] + 0.8 + read_need(TX["n3.title"])
# 春·阳台
b.update(tilt0=3.6, tilt1=6.0, poke=6.3, drop=6.85, pat1=7.35, pat2=7.75, canUp=8.25, pour0=8.6, pour1=9.9, canDown=10.3,
         nbLook=10.2, stand0=10.6, girlLook=10.75, wave0=11.0, nod=11.2, wave1=11.8, run0=12.2, nbBack=12.4, tiltUp0=13.6, cut1=bar(7))
b["run1"] = b["run0"] + 0.6 + 1060 / 600
# 夏·海边
b.update(pull0=b["cut1"] + 0.3, pull1=18.0, hop=18.5, kickF=19.3, pan1=19.8, kickG=20.1, point=20.6, run0s=21.1, run1s=22.8,
         crouch=23.0, lift0=23.45, lift1=24.25, clap0=24.4, push0s=25.0, cut2=bar(12))
# 秋·街道
b.update(pull0a=b["cut2"] + 0.3, pull1a=28.8, stop0=34.6, stop1=35.2, raise0=35.4, raise1=36.2, push0a=36.3, cut3=bar(17))
# 冬·车站
b.update(pull0w=b["cut3"] + 0.3, pull1w=40.3, wind=40.5, throw=40.9, hit=41.35, turn=41.75, train0=42.2, trainStop=45.0, doors=45.3,
         board0=45.7, board1=47.5, close=47.7, depart=47.9, winPass=49.6, tiltUp0w=50.0, departEnd=50.3, cut4=bar(23))
# 邻居线（3D）：一年的延时，季节 s 从 0（春）到 4（第二年春）
b.update(tiltDown0=b["cut4"] + 0.3, tiltDown1=54.0, lapse0=54.0, lapse1=65.0, reveal1=67.0, phoneUp=66.5, povCut=67.6, shutter=68.4,
         shrink0=68.6, shrink1=69.9)
st = lambda s: b["lapse0"] + s * (b["lapse1"] - b["lapse0"]) / 4  # noqa: E731
b.update(sprout=st(0.15), w1=st(0.45), w1e=st(0.95), w2=st(1.35), w2e=st(1.85), w3=st(2.1), w3e=st(2.5), umb=st(3.15), umbE=st(3.7))
# 照片 → 新家 → 手心
b.update(phone0=68.8, buzz=70.2, msg=70.7)
b["room"] = b["msg"] + 0.4 + read_need(TX["n3.msg"]) + 0.4
b.update(rSmile=b["room"] + 0.5, rPhoneDown=b["room"] + 1.0, rLook=b["room"] + 1.35, rTake=b["room"] + 2.1, palm2=b["room"] + 3.3, endTitle=bar(35))
duration = 85.0
b.update(fade0=duration - 1.4, fade1=duration - 0.4)
assert b["palm2"] + 0.45 <= b["endTitle"] + 1e-6 and b["endTitle"] + 1.2 + read_need(TX["n3.title"]) < b["fade0"]

# 各场内部节拍名在 acts.js 中统一为 pull0 / pull1 / run0 / run1 / push0 / tiltUp0：按场切换
SCENE_KEYS = {"summer": {"run0": "run0s", "run1": "run1s", "push0": "push0s"}, "autumn": {"pull0": "pull0a", "pull1": "pull1a", "push0": "push0a"},
              "winter": {"pull0": "pull0w", "pull1": "pull1w", "tiltUp0": "tiltUp0w"}}

# ---- 3D 阳台（米）：从女孩家阳台向外看，右侧隔墙后是邻居 ----
LAY3 = dict(railZ=-1.3, railH=1.1, wallZ=1.5, divX=1.0, divT=0.12, divH=1.2, balX0=-2.4, nbX1=3.6,
            stool=[0.62, -0.9, 0.22], pot=[0.62, -0.9, 0.22, 0.28, 0.15, 0.11], can=[0.3, -0.95], nb=[1.42, -0.85, 0.95],
            treeTop=1.75)
# 镜头关键位置：[时刻, 机位, 看向]
# 延时段固定机位（人眼高度，能越过隔墙看到邻居正侧面）；结尾轻推到能同时看到树与邻居；最后切到邻居手机的视角
CAM3 = [[b["cut4"], [0.05, 1.5, 1.25], None], [b["tiltDown1"], [0.05, 1.5, 1.25], [0.75, 1.0, -0.9]],
        [b["lapse1"], [0.05, 1.5, 1.25], [0.75, 1.0, -0.9]], [b["reveal1"], [-0.1, 1.6, 1.3], [0.9, 1.15, -0.85]],
        [b["povCut"], [2.3, 1.5, -0.6], [0.62, 1.25, -0.95]]]


def check3d():
    L, err = LAY3, []
    nx, nz, s = L["nb"]
    sh = np.array([nx, 1.46 * s, nz + 0.3 * s])  # 朝 −x 站立时右肩在 +z 一侧
    hand = np.array([L["pot"][0] + 0.38, 1.27, L["pot"][1]])
    if np.linalg.norm(hand - sh) > 0.62 * s:
        err.append(f"邻居够不到花盆 {np.linalg.norm(hand - sh):.3f}")
    x_wall = L["divX"] + L["divT"] / 2
    y_arm = sh[1] + (hand[1] - sh[1]) * (sh[0] - x_wall) / (sh[0] - hand[0])
    if y_arm - 0.06 < L["divH"]:
        err.append(f"手臂穿过隔墙 {y_arm:.3f}")
    if nx - 0.25 < x_wall:
        err.append("邻居身体进墙")
    if L["pot"][2] + L["pot"][3] + 1.25 < L["railH"] + 0.3:
        err.append("树没高过栏杆")
    for t, p, _ in CAM3[:-1]:
        if not (L["balX0"] + 0.1 < p[0] < L["divX"] - 0.1 and L["railZ"] + 0.1 < p[2] < L["wallZ"] - 0.1):
            err.append(f"{t:.2f} 镜头出阳台 {p}")
    p = CAM3[-1][1]
    if not (x_wall + 0.1 < p[0] < L["nbX1"]):
        err.append("手机视角不在邻居阳台")
    return err


errs = check3d()
assert not errs, errs
data = {"duration": duration, "bar": BAR, "beats": {k: round(v, 4) for k, v in b.items()}, "sceneKeys": SCENE_KEYS, "C": [960, 470], "R": 120,
        "lay3": LAY3, "cam3": CAM3, "sun3": {"dir": [0.35, 0.5, -1.0], "depth": 60, "fov": 45}}
write_js(ROOT / "assets/data/n3.js", "N3", data)
set_duration(ROOT / "index.html", duration)
print("duration", duration, {k: round(v, 2) for k, v in b.items()})

# ---- 音效：全部程序化合成，时刻取自上面的节拍 ----
from scipy.signal import lfilter  # noqa: E402
from common import Track, mallet, thump  # noqa: E402

rng = np.random.default_rng(33)
tr = Track(duration)
TT = lambda d: np.arange(int(d * SR)) / SR  # noqa: E731


def noise(d, cut, amp=1.0):
    a = math.exp(-2 * math.pi * cut / SR)
    y = lfilter([1 - a], [1, -a], rng.standard_normal(int(d * SR)))
    return amp * y / (np.abs(y).max() + 1e-9)


def env(d, att=0.01, rel=0.1):
    t = TT(d)
    return np.minimum(t / att, 1) * np.minimum((d - t) / rel, 1).clip(0)


def click(amp, cut=5000, d=0.04):
    return noise(d, cut, amp) * np.exp(-TT(d) / (d / 5))


def chirp(amp):
    t, f0 = TT(0.09), 3000 + 1400 * rng.random()
    return amp * np.sin(2 * np.pi * np.cumsum(f0 + 1500 * np.sin(2 * np.pi * 22 * t)) / SR) * np.sin(np.pi * t / 0.09)


def gull(amp):
    t = TT(0.5)
    return amp * np.sin(2 * np.pi * np.cumsum(1500 - 700 * t / 0.5 + 60 * np.sin(2 * np.pi * 9 * t)) / SR) * np.sin(np.pi * t / 0.5) ** 2


def bed(t0, t1, cut, amp, mod=0.0, rate=0.2):
    d = t1 - t0
    tr.place(t0, noise(d, cut, amp) * env(d, 1.0, 1.0) * (1 + mod * np.sin(2 * np.pi * rate * TT(d))))


def trickle(t0, d, amp):
    tr.place(t0, noise(d, 2500, amp) * env(d, 0.08, 0.15) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7 * TT(d)))))


def tone(f, d, amp):
    return amp * np.sin(2 * np.pi * f * TT(d)) * env(d, 0.01, 0.15)


SFX_MATCH = [b["cut1"], b["cut2"], b["cut3"], b["cut4"]]  # 匹配剪辑：木琴音 + 轻风
for k, t in enumerate([b["push1"]] + SFX_MATCH):
    tr.place(t - 0.05, mallet([698.46, 880.0, 1046.5, 783.99, 698.46][k], 0.22, 0.6, rng))
    tr.place(t - 0.4, noise(0.8, 1200, 0.06) * np.sin(np.pi * TT(0.8) / 0.8))
tr.place(b["seed0"] + 0.45, click(0.25, 3000, 0.05)); tr.place(b["palm2"] + 0.45, click(0.25, 3000, 0.05))
# 春
bed(3.0, b["cut1"] + 0.3, 700, 0.03)
for t in np.arange(3.0, b["cut1"], 0.8): tr.place(float(t + 0.4 * rng.random()), chirp(0.08))
tr.place(b["poke"] + 0.15, noise(0.12, 1500, 0.12) * env(0.12, 0.01, 0.08))
for t in (b["pat1"], b["pat2"]): tr.place(t, thump(0.25, 140)); tr.place(t, click(0.1, 1500, 0.05))
tr.place(b["canUp"], click(0.12, 4000, 0.03)); trickle(b["pour0"] + 0.25, b["pour1"] - b["pour0"] - 0.2, 0.08); tr.place(b["canDown"] + 0.25, click(0.15, 4000, 0.03))
trickle(3.6, b["nbLook"] - 3.6, 0.025)
s1 = b["run0"]
for k in range(8): tr.place(s1 + 0.15 + 0.24 * k, click(0.12, 900, 0.05) * (1 - k / 9))
# 夏
bed(b["cut1"] - 0.3, b["cut2"] + 0.3, 500, 0.16, 0.7, 0.12)
for t in (17.0, 20.4, 23.8): tr.place(t, gull(0.06))
for t in (b["hop"] + 0.42, b["kickF"], b["kickG"]): tr.place(t, noise(0.35, 3500, 0.22) * np.exp(-TT(0.35) / 0.08))
for k in range(9): tr.place(b["run0s"] + 0.1 + 0.2 * k, noise(0.08, 1200, 0.08) * env(0.08, 0.005, 0.05))
tr.place(b["lift0"] + 0.1, noise(0.6, 2200, 0.18) * env(0.6, 0.02, 0.3))
for k in range(4): tr.place(b["clap0"] + 0.05 + 0.3 * k, click(0.16, 3500, 0.03))
# 秋
bed(b["cut2"] - 0.3, b["cut3"] + 0.3, 900, 0.06, 0.4, 1.3)
for t in np.arange(b["pull0a"], b["stop1"], 0.72): tr.place(float(t), click(0.07, 1100, 0.05))
for t in np.arange(b["cut2"], b["cut3"], 1.1): tr.place(float(t + 0.5 * rng.random()), noise(0.25, 4000, 0.02) * env(0.25, 0.05, 0.15))
# 冬
bed(b["cut3"] - 0.3, b["cut4"] + 0.3, 350, 0.12, 0.6, 0.1)
tr.place(b["throw"] - 0.05, noise(0.25, 2000, 0.08) * np.sin(np.pi * TT(0.25) / 0.25)); tr.place(b["hit"], thump(0.35, 110)); tr.place(b["hit"], noise(0.2, 2500, 0.15) * np.exp(-TT(0.2) / 0.05))
d = b["trainStop"] - b["train0"] + 0.6
tr.place(b["train0"], noise(d, 220, 0.3) * np.linspace(0.3, 1, int(d * SR)) * env(d, 0.6, 0.6))
tr.place(b["trainStop"] - 0.9, (tone(1800, 0.9, 0.02) + tone(2100, 0.9, 0.015)) * np.linspace(1, 0, int(0.9 * SR)))
tr.place(b["doors"], tone(784, 0.35, 0.08)); tr.place(b["doors"] + 0.35, tone(659, 0.5, 0.08)); tr.place(b["close"], tone(988, 0.25, 0.06))
d = b["departEnd"] - b["depart"] + 1.2
tr.place(b["depart"], noise(d, 220, 0.3) * env(d, 0.4, 1.0))
for t in np.arange(b["board0"], b["board1"], 0.27): tr.place(float(t), noise(0.12, 1800, 0.08) * np.exp(-TT(0.12) / 0.04))
# 邻居线
bed(b["cut4"], b["shutter"], 600, 0.03)
for t in np.arange(b["cut4"], b["lapse0"] + 2.5, 0.7): tr.place(float(t + 0.3 * rng.random()), chirp(0.07))
tr.place(b["sprout"], mallet(1396.9, 0.12, 0.35, rng))
for a, e in ((b["w1"], b["w1e"]), (b["w2"], b["w2e"]), (b["w3"], b["w3e"])): trickle(a + 0.35, e - a - 0.6, 0.07)
bed(st(2.2), st(2.9), 1500, 0.06, 0.5, 2.0)
bed(st(3.0), st(3.75), 400, 0.1, 0.5, 0.3)
tr.place(b["shutter"], click(0.35, 6000, 0.03)); tr.place(b["shutter"] + 0.08, click(0.25, 3000, 0.05))
# 手机与新家
for k in (0, 0.4): tr.place(b["buzz"] + k, noise(0.25, 180, 0.25) * np.abs(np.sin(2 * np.pi * 30 * TT(0.25))) * env(0.25, 0.01, 0.05))
tr.place(b["msg"], tone(1318.5, 0.12, 0.08)); tr.place(b["msg"] + 0.1, tone(1760, 0.2, 0.07))
for t in np.arange(b["room"], b["fade0"], 0.9): tr.place(float(t + 0.4 * rng.random()), chirp(0.05))
tr.place(b["rPhoneDown"] + 0.35, click(0.12, 2500, 0.04)); tr.place(b["rTake"] + 0.8, noise(0.3, 5000, 0.04) * env(0.3, 0.02, 0.2))
tr.write(ROOT / "assets/sfx/n3.wav")

import music  # noqa: E402
music.compose(BAR, duration, SR, ROOT / "assets/bgm/n3.wav")
print("audio ok")
