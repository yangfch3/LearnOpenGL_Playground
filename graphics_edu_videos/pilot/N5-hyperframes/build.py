"""N5「另一半」唯一时间源：assets/data/n5.js、assets/sfx/n5.wav。规则与镜头表见 SPEC.md。
世界只有一条边界 y = h(x, t)：线下墨色，线上纸色。墨（g=+1）头朝 +y，纸（g=−1）头朝 −y。"""
import math
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import load_text, read_need, set_duration, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
DIG = 0.6  # 一铲；各相位占比
PH = dict(plunge=0.3, pry0=0.38, pry1=0.48, lift=0.6, toss=0.75)
pry = lambda t0: t0 + PH["pry0"] * DIG  # noqa: E731

# ---- 节拍 ----
b = dict(emerge0=0.5, emerge1=2.0, blink1=2.25, stretch0=2.4, stretch1=3.3, walk0=3.5, walk1=7.0,
         up0=9.1, up1=9.6, kneel0=11.5, flip0=12.5, flip1=15.1, wipe0=14.3, wipe1=15.3,
         climb0=17.9, climb1=19.0, drop=23.2, zwalk0=23.8, zwalk1=24.9, both=26.4, back0=27.8, back1=28.4,
         kneelK=28.6, push0=28.2, push1=29.6, grow0=47.0, grow1=55.0, pull0=47.0, pull1=51.0,
         fruit0=55.0, fruit1=56.5, fall=57.0, close0=59.3, close1=61.0, rot0=62.5, rot1=66.5, reveal0=68.2, reveal1=74.6, title0=75.2)
# 纸的每一铲 [起, 挖后坑深]；墨在山顶的每一脚 [时刻, 踩后坑深]
DIGS = [[5.5, 0.06], [6.1, 0.12], [6.7, 0.18], [7.3, 0.42], [8.5, 0.46], [10.8, 0.5], [15.6, 0.52], [16.2, 0.54], [16.8, 0.55],
        [20.8, 0.25], [21.4, 0.42]]
HILL = [[19.3, 0.38], [19.8, 0.2], [20.3, 0.06], [22.2, 0.2], [22.7, 0.0]]
b["trip0"] = pry(7.3); b["trip1"] = b["trip0"] + 0.4; b["blink2"] = b["trip1"] + 0.45
b["title1"] = b["title0"] + 0.8
duration = round(b["title1"] + read_need(TX["n5.title"]) + 2.5, 2)

PIT = sorted([[pry(t0), t0 + PH["pry1"] * DIG, a] for t0, a in DIGS] + [[t, t + 0.08, a] for t, a in HILL])
cur = 0.0
for t0, _, a in PIT:  # 坑深序列：挖只会加深，踩只会变浅
    is_dig = any(abs(pry(d) - t0) < 1e-6 for d, _ in DIGS)
    assert (a > cur) if is_dig else (a < cur), (t0, cur, a)
    cur = a
assert all(q[0] - p[0] >= DIG - 1e-9 for p, q in zip(DIGS, DIGS[1:]))

# ---- 布局（单位：角色身高 = 1）----
M = 0.40
LAY = dict(pit=dict(x=0.35, sig=0.3), mound=dict(x=1.15, sig=0.22, d=0.42), digX=0.45, shovel=1.05, seed0=1.15, M=M, treeX=-0.5,
           fruitR=0.075, seedR=0.045)
STRIDE = 0.5
TRACK = {
    "mo": [[0, -3.5], [b["walk0"], -3.5], [b["walk1"], -0.05], [b["trip0"], -0.05], [b["trip1"], -0.35], [b["climb0"], -0.35],
           [b["climb1"], 0.35], [b["back0"], 0.35], [b["back1"], 0.10], [44.0, 0.10], [44.5, -0.3], [46.6, -0.3], [47.4, 0.10], [duration, 0.10]],
    "zhi": [[0, 1.1], [b["zwalk0"], 1.1], [b["zwalk1"], 0.45], [b["back0"], 0.45], [b["back1"], 0.70], [39.0, 0.70], [39.35, 0.95],
            [40.6, 0.95], [40.95, 0.70], [duration, 0.70]],
}
SLIDE = {"mo": [b["trip0"]], "zhi": []}
G = {"mo": 1, "zhi": -1}
# 朝向：初值 + [起, 止, 目标]；转身 = 横向压扁再展开
FACE = {"mo": [1, [[43.7, 43.95, -1], [57.3, 57.55, 1]]], "zhi": [-1, [[38.7, 38.95, 1], [40.3, 40.55, -1]]]}
EMERGE = [b["emerge0"], b["emerge1"], 1.15]  # 墨从地下 1.15 处长出来

# 动作 [谁, 名, 起, 止, 渐入, 渐出, 参数]
f1 = pry(10.8)
ACTS = [["mo", "stretch", b["stretch0"], b["stretch1"], 0.35, 0.35], ["mo", "sit", b["trip0"], b["up1"], 0.3, 0.5],
        ["mo", "flinch", f1, f1 + 0.4, 0.05, 0.05], ["mo", "kneelEar", b["kneel0"], 17.6, 0.8, 0.4],
        ["zhi", "wipe", b["wipe0"], b["wipe1"], 0.3, 0.3], ["zhi", "flinch", 19.3, 19.7, 0.05, 0.05]]
ACTS += [["mo", "flinch", pry(t), pry(t) + 0.4, 0.05, 0.05] for t in (20.8, 21.4)]
ACTS += [[w, "lookDown", 26.5, 27.6, 0.2, 0.4] for w in ("mo", "zhi")]
ACTS += [["mo", "kneelK", b["kneelK"], 43.6, 0.6, 0.4], ["zhi", "kneelK", b["kneelK"], 38.6, 0.6, 0.4],
         ["zhi", "crouch", 39.4, 40.25, 0.3, 0.3], ["zhi", "reach", 39.45, 40.2, 0.3, 0.3, dict(h=0, x=LAY["seed0"], dy=0.06)],
         ["zhi", "kneelK", 41.0, 46.7, 0.5, 0.4], ["zhi", "reach", 41.6, 42.6, 0.3, 0.3, dict(h=0, x=M, dy=0.03)],
         ["mo", "reach", 42.5, 43.4, 0.3, 0.3, dict(h=0, x=M, dy=0.06)],
         ["mo", "kneelK", 44.6, 46.5, 0.4, 0.4], ["mo", "reach", 45.0, 46.1, 0.3, 0.3, dict(h=0, x=LAY["treeX"], dy=0.04)]]
ACTS += [[w, "lookUp", 48.0, 55.5, 1.0, 0.6] for w in ("mo", "zhi")]
ACTS += [[w, "kneelK", b["close0"] + 0.1, duration, 0.6, 0.1] for w in ("mo", "zhi")]
ACTS += [[w, "reach", 60.0, duration, 0.8, 0.1, dict(h=0, x=M, dy=LAY["fruitR"])] for w in ("mo", "zhi")]
STOMPS = {"mo": [10.0, 10.45] + [t for t, _ in HILL] + [25.8, b["both"]], "zhi": [25.3, b["both"]]}
KNOCKS = {"mo": [29.8, 30.1, 30.4, 32.6, 32.9, 33.05, 33.35, 35.4, 35.8, 36.2, 36.8],
          "zhi": [31.2, 31.5, 31.8, 34.0, 34.3, 34.45, 34.75, 35.6, 36.0, 36.4, 36.8]}
PATS = {"mo": [45.75, 46.0], "zhi": []}
# 种子：在土丘上 → 纸手里 → 按进线里、穿到墨那边 → 墨手里 → 种下 → 长进树里
SEED = [[0, "ground"], [39.85, "zhi"], [42.15, "push"], [42.9, "mo"], [45.4, "planted"]]
SEED_PUSH = [42.15, 42.3, 42.6]
BLINKS = {"mo": [b["blink1"], b["blink2"], 27.0, 61.6, 67.3], "zhi": [27.05, 39.0, 61.7]}
# 彩蛋：线其实是一只鲁宾杯的杯口。杯身半宽 w(y)（y < 0 向下）：杯口 → 额 → 眉 → 眼窝 → 鼻 → 唇 → 下巴 → 颈 → 杯座。
# 杯外的纸色就是两张相对的侧脸。全片的镜头都看不到杯沿以外（check.mjs 校验）
VASE = [[-0.05, 8.0], [-0.6, 8.0], [-0.95, 7.5], [-3.2, 7.4], [-5.0, 6.75], [-6.1, 7.35], [-7.4, 6.1], [-8.9, 4.3], [-9.6, 5.5],
        [-10.5, 5.7], [-11.3, 5.0], [-11.9, 5.5], [-12.6, 5.1], [-13.6, 6.0], [-15.0, 5.3], [-16.2, 6.7], [-17.8, 8.6], [-20.3, 10.0],
        [-23.5, 10.7], [-60.0, 10.7]]
assert all(q[0] < p[0] for p, q in zip(VASE, VASE[1:]))
REVEAL = dict(top=None, bottom=-25.0, titleY=-20.8)  # top 在树生成后按树冠顶 + 0.6 定


def x_at(who, t):
    tr = TRACK[who]
    for (t0, x0), (t1, x1) in zip(tr, tr[1:]):
        if t < t1: return x0 + (x1 - x0) * max(0.0, (t - t0) / (t1 - t0))
    return tr[-1][1]


# 跺脚 / 敲击让线向对方鼓一下 [时刻, x, 幅度]；同一时刻同一点相反的两下正好抵消
DIMPLES = []
for who, ts in STOMPS.items():
    for t in ts:
        if any(abs(t - th) < 1e-6 for th, _ in HILL): continue
        DIMPLES.append([t, round(x_at(who, t) + 0.05 * FACE[who][0], 4), -0.07 * G[who] * (0.6 if t < 12 else 1)])
for who, ts in KNOCKS.items():
    DIMPLES += [[t, round(x_at(who, t) + 0.2 * FACE[who][0], 4), -0.025 * G[who]] for t in ts]
fm, fz = x_at("mo", b["both"]) + 0.05, x_at("zhi", b["both"]) - 0.05
assert abs(fm - fz) <= 0.02, (fm, fz)


# ---- 树：局部坐标（上 = 离开线的方向），两边同一结构镜像。段 [x0, y0, x1, y1, 粗0, 粗1, 长起, 长止]（生长进度 0–1）----
def hs(n):
    s = math.sin(n * 127.1 + 311.7) * 43758.5453
    return s - math.floor(s)


SEGS, LEAVES = [], []


def branch(x, y, ang, ln, w, depth, s0, key):
    a = math.radians(ang); x1, y1 = x + ln * math.sin(a), y + ln * math.cos(a)
    span = [0.3, 0.28, 0.22, 0.2][min(depth, 3)]
    SEGS.append([round(v, 4) for v in (x, y, x1, y1, w, w * 0.72, s0, s0 + span)])
    if depth == 3:
        LEAVES.append([round(x1, 4), round(y1, 4), round(0.2 + 0.09 * hs(key), 4), round(0.8 + 0.08 * hs(key + 7), 4), 1.0])
        return
    for k, da in enumerate((-26, 24)):
        branch(x1, y1, ang + da + 8 * (hs(key * 3 + k) - 0.5), ln * (0.64 + 0.06 * hs(key + k)), w * 0.66, depth + 1, s0 + span * 0.9, key * 4 + k + 1)


SEGS.append([0, 0, 0, 1.1, 0.15, 0.11, 0, 0.3])
for i, (ang, ln) in enumerate(((-48, 0.8), (-4, 0.75), (56, 1.08))): branch(0, 1.1, ang, ln, 0.095, 1, 0.27, i + 1)
FRUIT_TIP = SEGS[next(i for i, s in enumerate(SEGS) if s[6] == 0.27 and s[2] > 0.5)][2:4]  # 右主枝末端
TREE = dict(segs=SEGS, leaves=LEAVES, tip=FRUIT_TIP, stem=0.1)
REVEAL["top"] = round(max(y + r for _, y, r, _, _ in LEAVES) + 0.6, 3)
assert abs(LAY["treeX"] + FRUIT_TIP[0] - M) < 0.01, FRUIT_TIP

# ---- 果子：落下、穿线，在两侧都被拉回线上；每次穿线振幅乘 FR ----
FA, FR = 6.0, 0.35
fy0 = FRUIT_TIP[1] - TREE["stem"] - LAY["fruitR"]
CROSS, t, amp = [], b["fall"] + math.sqrt(2 * fy0 / FA), fy0 * FR
CROSS.append(round(t, 4))
while amp >= 0.03:
    t += 2 * math.sqrt(2 * amp / FA); CROSS.append(round(t, 4)); amp *= FR
FRUIT = dict(a=FA, r=FR, y0=round(fy0, 4), cross=CROSS)
assert CROSS[-1] < b["close0"] + 0.1, CROSS

# ---- 镜头：中心 c、s 像素/单位、rot 度。主镜头线在画面 y=1030 ----
CY = 490 / 180
MASTER = dict(c=[-1.6, CY], s=180, rot=0)
CAM = [[3.4, 7.3, dict(c=[0.2, CY])], [b["flip0"], b["flip1"], dict(c=[0.4, 0.0], s=200, rot=180)],
       [b["push0"], b["push1"], dict(s=330)], [b["pull0"], b["pull1"], dict(c=[-0.05, 0.0], s=165)],
       [b["close0"], b["close1"], dict(c=[M, 0.0], s=320)], [b["rot0"], b["rot1"], dict(c=[-0.25, CY], s=180, rot=360)],
       [b["reveal0"], b["reveal1"], dict(c=[0.0, (REVEAL["top"] + REVEAL["bottom"]) / 2], s=round(1080 / (REVEAL["top"] - REVEAL["bottom"]), 3))]]
io2 = lambda u: 2 * u * u if u < 0.5 else 1 - 2 * (1 - u) ** 2  # noqa: E731


def cam_rot(t):
    r = MASTER["rot"]
    for t0, t1, tgt in CAM:
        if t <= t0: break
        if "rot" in tgt: r += (tgt["rot"] - r) * io2(min(1.0, (t - t0) / (t1 - t0)))
    return r


# ---- 行走：每个步行段单独起相位；落脚 = 段内距离每过半步幅一次（与 world.js 同式）----
STEPS = {}
for who, tr in TRACK.items():
    out = []
    for (t0, x0), (t1, x1) in zip(tr, tr[1:]):
        d = abs(x1 - x0)
        assert t1 > t0 and d / (t1 - t0) <= 1.2, (who, t0, round(d / (t1 - t0), 2))
        if d < 1e-9 or any(abs(t0 - s) < 1e-6 for s in SLIDE[who]): continue
        out += [round(t0 + m * STRIDE / 2 / d * (t1 - t0), 4) for m in range(1, int(d / (STRIDE / 2) + 1e-9) + 1)]
    STEPS[who] = out

data = dict(duration=duration, beats={k: round(v, 4) for k, v in b.items()}, dig=DIG, ph=PH, digs=DIGS, pit=PIT, lay=LAY,
            stride=STRIDE, track=TRACK, slide=SLIDE, g=G, face=FACE, emerge=EMERGE, acts=ACTS, stomps=STOMPS, knocks=KNOCKS,
            pats=PATS, blinks=BLINKS, vase=VASE, reveal=REVEAL, dimples=DIMPLES, seed=SEED, seedPush=SEED_PUSH, tree=TREE, fruit=FRUIT, master=MASTER, cam=CAM)
write_js(ROOT / "assets/data/n5.js", "N5", data)
set_duration(ROOT / "index.html", duration)
print("duration", duration, "steps", {k: len(v) for k, v in STEPS.items()}, "tree", len(SEGS), "fruit cross", CROSS)

# ---- 声音：墨的世界在高音区（木琴），纸的世界在低音区（拨弦），同一动机互为倒影。
# 听的位置跟着镜头：哪一侧朝上，哪一侧的声音就清楚，另一侧隔着地面变闷 ----
from functools import partial  # noqa: E402
import numpy as np  # noqa: E402
import common as C  # noqa: E402
from common import SR, Track, env, lp, mallet, thump  # noqa: E402

rng = np.random.default_rng(55)
tr = Track(duration)
TT, sine = C.tt, C.glide
noise, pluck = partial(C.noise, rng), partial(C.pluck, rng)


def up(t):  # 1 = 墨这一侧朝上，0 = 纸这一侧朝上
    return (1 + math.cos(math.radians(cam_rot(t)))) / 2


def put(who, t, sig):
    c = up(t) if who == "mo" else 1 - up(t)
    tr.place(t, (0.35 + 0.65 * c) * (c * sig + (1 - c) * lp(sig, 500)))


NOTE = {"C3": 130.81, "E3": 164.81, "F3": 174.61, "A3": 220.0, "B3": 246.94, "C4": 261.63, "E4": 329.63, "G4": 392.0,
        "C5": 523.25, "D5": 587.33, "E5": 659.26, "G5": 783.99, "A5": 880.0, "C6": 1046.5}
MOTIF = ["E5", "G5", "A5", "G5", "E5", "D5", "C5"]
INV = ["A3", "F3", "E3", "F3", "A3", "B3", "C4"]  # 以 C 为轴的音级倒影
tick = lambda f, a: noise(0.04, f, a) * np.exp(-TT(0.04) / 0.01)  # noqa: E731

# 出生：地里拱出来，最后「啵」一下
d = b["emerge1"] - b["emerge0"]
put("mo", b["emerge0"], noise(d, 380, 0.07) * env(d, 0.4, 0.3)); put("mo", b["emerge0"], sine(110, 300, d, 0.05))
put("mo", b["emerge1"] - 0.05, mallet(NOTE["C5"], 0.1, 0.15, rng))
for t in (b["stretch0"] + 0.2, b["stretch0"] + 0.55): put("mo", t, mallet(NOTE["G5"] if t < b["stretch0"] + 0.3 else NOTE["C6"], 0.06, 0.25, rng))
for who, ts in BLINKS.items():
    for t in ts:
        for dt in (0.0, 0.16): put(who, t + dt, mallet(2093.0 if who == "mo" else 1046.5, 0.02, 0.03, rng))
# 脚步：墨开场那段路每两步落一个动机音
for who, ts in STEPS.items():
    for i, t in enumerate(ts):
        put(who, t, tick(2500 if who == "mo" else 900, 0.05))
        if who == "mo" and t < b["walk1"] + 0.1 and i % 2 == 0 and i // 2 < len(MOTIF): put(who, t, mallet(NOTE[MOTIF[i // 2]], 0.11, 0.18, rng))
# 纸的每一铲：铲入（嚓）、撬起时墨那边的地面一跳（闷响）、甩土
for t0, _ in DIGS:
    put("zhi", t0 + PH["plunge"] * DIG, noise(0.07, 5000, 0.12) * np.exp(-TT(0.07) / 0.02))
    put("mo", pry(t0), thump(0.22, 75)); put("mo", pry(t0), lp(noise(0.12, 700, 0.12), 300) * np.exp(-TT(0.12) / 0.04))
    put("zhi", t0 + PH["toss"] * DIG, noise(0.18, 1800, 0.05) * env(0.18, 0.02, 0.12))
put("mo", b["trip0"] + 0.02, mallet(NOTE["G5"], 0.1, 0.12, rng)); put("mo", b["trip0"] + 0.16, mallet(NOTE["C5"] * 0.75, 0.1, 0.2, rng))
put("mo", b["trip1"], thump(0.2, 110))
# 跺脚：在山顶上是「噗」一声把山踩下去；平地上是闷响。两人同一刻跺同一点：一声很低的合响，然后安静
for who, ts in STOMPS.items():
    for t in ts:
        if abs(t - b["both"]) < 1e-6: continue
        if any(abs(t - th) < 1e-6 for th, _ in HILL): put(who, t, thump(0.24, 120)); put(who, t, sine(320, 110, 0.18, 0.08)); continue
        put(who, t, thump(0.24, 130 if who == "mo" else 80)); put(who, t, tick(3000 if who == "mo" else 1200, 0.05))
tr.place(b["both"], thump(0.42, 60)); tr.place(b["both"], lp(noise(0.5, 400, 0.1), 200) * np.exp(-TT(0.5) / 0.15))
for a in ACTS:
    if a[1] == "flinch": put(a[0], a[2] + 0.03, mallet(1760.0, 0.05, 0.06, rng) if a[0] == "mo" else pluck(440.0, 0.12, 0.4))
d = 1.0; put("zhi", b["drop"] + 0.45, noise(0.2, 6000, 0.08) * np.exp(-TT(0.2) / 0.04))
put("zhi", b["drop"] + 0.45, sum(np.sin(2 * np.pi * f * TT(d)) for f in (2400, 3720)) * 0.02 * np.exp(-TT(d) / 0.15))
for who, (_, keys) in FACE.items():  # 转身：纸片翻面的「唰」
    for t0, t1, _ in keys: put(who, t0, noise(t1 - t0, 3500, 0.05) * np.sin(np.pi * TT(t1 - t0) / (t1 - t0)))

# 敲击即旋律：墨的每一下取动机下一个音，纸取倒影；最后同时敲是一个八度合音
for who, ts in KNOCKS.items():
    for i, t in enumerate(ts):
        put(who, t, tick(2200 if who == "mo" else 700, 0.06))
        put(who, t, mallet(NOTE[MOTIF[i % 7]], 0.1, 0.2, rng) if who == "mo" else pluck(NOTE[INV[i % 7]], 0.24, 0.9))
# 种子：拾起一声亮音；按进线里时从低滑到高（从纸那边到墨那边）
put("zhi", 39.85, sine(1568, 1568, 0.5, 0.03) * np.exp(-TT(0.5) / 0.12))
tr.place(SEED_PUSH[1], sine(220, 880, SEED_PUSH[2] - SEED_PUSH[1] + 0.15, 0.06))
put("mo", 42.9, mallet(NOTE["C6"], 0.04, 0.05, rng))
put("mo", 45.4, lp(noise(0.3, 600, 0.06), 300) * env(0.3, 0.02, 0.2))
for t in PATS["mo"]: put("mo", t, thump(0.1, 140))


def canon(t0, beat, amp, last=None):
    """镜像卡农：动机与倒影同时奏响。"""
    for k, (hi, lo) in enumerate(zip(MOTIF, INV)):
        t = t0 + k * beat
        tr.place(t, mallet(NOTE[hi], amp, 0.3, rng)); tr.place(t, pluck(NOTE[lo], amp * 2.2, 1.4))
    if last:
        tr.place(last, mallet(NOTE["C5"], amp, 0.6, rng)); tr.place(last, pluck(NOTE["C3"], amp * 2.4, 2.4))
        tr.place(last, sum(np.sin(2 * np.pi * f * TT(3.0)) for f in (NOTE["C4"], NOTE["E4"], NOTE["G4"])) * 0.012 * env(3.0, 0.3, 2.0))


# 树：生长时第一次合奏；叶子长出时沙沙
canon(b["grow0"] + 0.5, 0.5, 0.07); canon(b["grow0"] + 4.3, 0.55, 0.06, last=b["grow0"] + 4.3 + 7 * 0.55)
d = b["grow1"] - b["grow0"]
tr.place(b["grow0"], sum(np.sin(2 * np.pi * f * TT(d)) for f in (NOTE["C3"], NOTE["G4"])) * 0.01 * env(d, 3.0, 2.0))
lo_, hi_ = b["grow0"] + 0.8 * d, b["grow1"]
for t in np.arange(lo_, hi_, 0.17): tr.place(float(t + 0.08 * rng.random()), noise(0.25, 5000, 0.012) * env(0.25, 0.05, 0.18))
# 果子：长大、落下；每次穿线换一种音色（在墨那边是木琴，在纸那边是拨弦），越来越轻
d = b["fruit1"] - b["fruit0"]; put("mo", b["fruit0"], sine(600, 900, d, 0.02))
put("mo", b["fall"], tick(4000, 0.05))
for k, t in enumerate(CROSS):
    a = 0.12 * FR ** (k * 0.6)
    tr.place(t, pluck(NOTE["C4"], a * 2.4, 1.0) if k % 2 == 0 else mallet(NOTE["C5"], a, 0.25, rng))
tr.place(CROSS[-1] + 0.25, mallet(NOTE["G5"], 0.04, 0.4, rng)); tr.place(CROSS[-1] + 0.25, pluck(NOTE["G4"] / 2, 0.08, 1.2))
# 两只手隔着果子碰到
tt = b["close1"]
tr.place(tt, mallet(NOTE["E5"], 0.07, 0.6, rng)); tr.place(tt, pluck(NOTE["A3"], 0.16, 2.0))
# 转回开场：一阵风；结尾完整的镜像卡农，最后的和弦与片名同时落下
d = b["rot1"] - b["rot0"] + 0.6
tr.place(b["rot0"], lp(noise(d, 1500, 0.08) * np.sin(np.pi * TT(d) / d) ** 2, 900))
d = b["flip1"] - b["flip0"] + 0.6
tr.place(b["flip0"], lp(noise(d, 1500, 0.09) * np.sin(np.pi * TT(d) / d) ** 2, 900))
# 拉远见杯：一层慢慢升起的低音，卡农在拉远途中奏完，最后的和弦落在片名上
d = b["title0"] - b["reveal0"] + 1.5
tr.place(b["reveal0"], sum(np.sin(2 * np.pi * f * TT(d)) for f in (NOTE["C3"] / 2, NOTE["C3"], NOTE["G4"] / 2)) * 0.014 * env(d, d * 0.7, 1.5))
canon(b["title0"] - 7 * 0.8, 0.8, 0.075, last=b["title0"])
# 环境：一层很轻的风；两人同时跺脚后静下来约一秒
for t0 in np.arange(-0.5, duration, 0.5):  # 1s 三角窗、半重叠，叠加后音量恒定
    duck = 0.15 if b["both"] + 0.1 < t0 + 0.5 < b["both"] + 1.3 else 1.0
    tr.place(max(0.0, float(t0)), duck * noise(1.0, 1200 - 600 * (1 - up(t0 + 0.5)), 0.012) * env(1.0, 0.5, 0.5))
tr.write(ROOT / "assets/sfx/n5.wav")
print("audio ok")
