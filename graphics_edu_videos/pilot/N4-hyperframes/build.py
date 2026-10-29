"""N4「分辨率」唯一时间源：assets/data/n4.js（节拍、轨迹、动作、镜头、分辨率表）、assets/sfx/n4.wav、assets/bgm/n4.wav。
全片只有一个画框（主镜头 x∈[-8,8]）；开场与结尾是同一帧。"""
import math
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import load_text, read_need, set_duration, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
BAR = 3.0  # 80 BPM 4/4：前四次翻倍落在小节线上，之后加速

b = dict(blink1=1.0, r32=3.0, r64=6.0, r128=9.0, r256=12.0, r512=13.5, r1024=14.25, vec=15.0)
# 春：出门，蝴蝶引路，石头上的橙斑；矢量到来后推近，橙斑是猫
b.update(walk1=3.6, walk1e=5.7, bfly0=4.2, walk2=8.6, walk2e=11.0, bflyLand=10.4, push0=15.6, push1=17.6, ear=15.9, bflyOff=16.0,
         headUp=16.3, stand=16.9, stretch0=17.1, stretch1=18.0, meow1=18.2, hop=18.5, rub0=19.0, rub1=19.9, pet0=19.1, pet1=20.1,
         pull0=20.2, pull1=22.8, s1a=20.0, s1b=23.0)
# 夏：猫跑进集市；女孩放风筝失败；男孩捡起风筝帮她放起
b.update(meow2=22.5, dash0=22.9, dash1=25.5, mkt0=23.0, mkt1=26.6, jog0=23.4, jog1=28.4, try0=24.6, try1=25.4, kiteFall=26.2,
         sad0=26.2, sad1=27.6, catSit=27.0, gpet0=27.4, gpet1=29.0, pick0=28.6, pick1=29.2, raise0=29.6, release=31.8,
         back0=29.8, back1=30.8, kiteUp=34.4, camUp0=31.8, camUp1=34.6, run0=32.4, run1=33.6, cheer0=33.8, cheer1=34.8)
# 秋：光打开，风筝影子掠过麦田；树下看日落
b.update(s2a=34.6, s2b=37.6, lit0=35.4, lit1=37.4, walkA0=36.0, walkA1=44.4, camA0=35.6, camA1=40.6, camT0=41.0, camT1=45.6,
         gust1=38.6, gust2=41.2, reel0=43.0, reel1=44.6, sit0=45.6, dusk0=46.6, dusk1=51.0)
# 冬：落雪，堆雪人；滑动变焦出纵深，绕雪人一圈；各自回家
b.update(s3a=50.6, s3b=53.6, snow0=50.8, rise0=52.0, rise1=52.6, home0=52.8, home1=56.4, camW0=52.8, camW1=56.4,
         roll0=56.0, roll1=59.0, shape0=56.6, shape1=58.6, lift0=59.2, lift1=60.0, poke0=60.0, poke1=60.5,
         dolly0=60.8, dolly1=63.4, orbit0=63.4, orbit1=70.6, pounce1=65.0, pounce2=67.6, back0w=70.6, back1w=73.2, snowEnd=74.0,
         wave0=73.4, wave1=74.4, gwave0=73.6, gwave1=74.6, walkH0=74.4, walkH1=79.2, gwalk0=74.9, gwalk1=80.0, cwalk0=75.0, cwalk1=79.0)
# 尾声：逐级降回 16×9 → 雪化回春天，正是开场那一帧 → 再眨眼 → 逐格显出全分辨率 → 片名
b.update(c1024=76.4, c512=76.9, c256=77.4, c128=77.9, c64=78.4, c32=78.9, c16=79.4, melt0=79.8, melt1=81.8, blink2=82.4,
         tile0=83.0, tile1=85.4, title0=85.6, title1=87.0)
b["fade0"] = b["title1"] + read_need(TX["n4.title"]) + 0.2
b["fade1"] = b["fade0"] + 1.0
duration = round(b["fade1"] + 0.2, 2)

# 分辨率表：[起始, 低 N, 高 N（0 = 原生 + MSAA）, 波前时长, +1 自主角向外裂开 / −1 自外向主角合并]
RES = [[b["r32"], 16, 32, 0.9, 1], [b["r64"], 32, 64, 0.9, 1], [b["r128"], 64, 128, 0.9, 1], [b["r256"], 128, 256, 0.8, 1],
       [b["r512"], 256, 512, 0.6, 1], [b["r1024"], 512, 1024, 0.5, 1], [b["vec"], 1024, 0, 0.4, 1],
       [b["c1024"], 1024, 0, 0.45, -1]] + [[b[f"c{n}"], n, 2 * n, 0.45, -1] for n in (512, 256, 128, 64, 32, 16)]
QUANT = [[0, 1], [b["vec"] - 0.3, 1], [b["vec"] + 0.4, 0], [b["c1024"], 0], [b["c1024"] + 0.6, 1]]

# ---- 布局（世界单位 ≈ 米；x 向右，z 朝镜头，y 向上）----
LAY = dict(house=dict(x=-6.6, z=-1.6, w=2.8, d=2.4, h=2.0), tree=dict(x=-3.8, z=-4.6, r=1.3), stone=dict(x=-1.0, z=-0.8, r=0.42, top=0.42),
           field=dict(x0=-1.6, x1=3.2, z0=-6.0, z1=-2.4, h=0.8), stalls=[dict(x=5.4, z=-2.8, w=1.6, d=1.0), dict(x=7.6, z=-2.8, w=1.6, d=1.0)],
           snowman=dict(x=0.4, z=1.4, r=0.42, rh=0.22), ball0=1.86, kiteRest=[5.0, 0.4], kiteZ=-8.0, kiteL=6.0)
R = dict(hero=0.2, girl=0.2, cat=0.15)

# ---- 轨迹 [t, x, z]：相邻两点位置相同即站立 ----
TRACK = {
    "hero": [[0, -6.5, 0], [b["walk1"], -6.5, 0], [b["walk1e"], -4.4, 0], [b["walk2"], -4.4, 0], [b["walk2e"], -1.75, 0],
             [b["jog0"], -1.75, 0], [b["jog1"], 4.4, 0], [b["run0"], 4.4, 0], [b["run1"], 7.2, 0], [b["walkA0"], 7.2, 0],
             [42.6, -2.4, 0], [b["walkA1"], -3.3, -3.6], [b["home0"], -3.3, -3.6], [54.6, -2.0, 0.2], [b["home1"], -0.22, 1.4],
             [b["walkH0"], -0.22, 1.4], [b["walkH1"], -6.5, 0]],
    "girl": [[0, 5.6, 0.1], [b["try0"], 5.6, 0.1], [b["try1"], 7.0, 0.1], [b["back0"], 7.0, 0.1], [b["back1"], 8.0, 0.1],
             [b["walkA0"] + 0.2, 8.0, 0.1], [43.0, -1.7, 0.3], [b["walkA1"] + 0.4, -2.6, -3.6], [52.6, -2.6, -3.6],
             [55.85, 2.6, 1.4], [b["roll0"], 2.6, 1.4], [b["roll1"], 1.14, 1.4], [b["gwalk0"], 1.14, 1.4], [b["gwalk1"], 5.6, 0.1]],
    "cat": [[0, -1.0, -0.8], [b["hop"], -1.0, -0.8], [b["hop"] + 0.5, -1.2, 0.45], [b["dash0"], -1.2, 0.45], [b["dash1"], 4.9, 0.6],
            [25.8, 4.9, 0.6], [26.9, 6.5, 0.6], [b["walkA0"] + 0.4, 6.5, 0.6], [42.4, -2.2, 0.6], [b["walkA1"], -4.3, -3.4],
            [52.4, -4.3, -3.4], [55.2, 1.0, 2.4], [b["cwalk0"], 1.0, 2.4], [76.4, -0.6, 2.3], [77.9, -1.2, 0.45], [78.6, -1.2, 0.45], [b["cwalk1"], -1.0, -0.8]],
}
# 站立朝向（度；0 = 面向镜头 +z，90 = 向 +x，180 = 背对）；[t, yaw] 表示到 t 时转好。移动段起点自动朝运动方向
FACE_HOLD = {
    "hero": [[0, 0], [6.0, 60], [11.3, 120], [b["rub0"], 60], [28.7, 60], [b["pick1"], 90], [b["cheer0"], 30], [b["sit0"], -10],
             [b["rise1"], 0], [56.7, 90], [b["wave0"], 30], [79.6, 0]],
    "girl": [[0, -40], [26.0, -90], [31.1, -90], [33.0, -70], [46.2, 10], [56.1, -90], [b["gwave0"], -30], [80.4, -40]],
    "cat": [[0, -90], [b["hop"] + 0.4, -100], [27.2, -90], [44.9, 30], [55.5, -30], [79.3, -90]],
}
ACTS = [
    ["hero", "blink", b["blink1"], b["blink1"] + 0.36], ["hero", "blink", b["blink2"], b["blink2"] + 0.36],
    ["hero", "lookUp", 5.9, 8.8], ["hero", "lookDown", b["walk2e"], 19.0], ["hero", "crouch", b["pet0"], 20.3],
    ["hero", "pet", b["pet0"] + 0.1, b["pet1"]], ["hero", "crouch", b["pick0"], b["pick1"] + 0.2], ["hero", "hold", 29.0, b["raise0"] + 0.3],
    ["hero", "raise", b["raise0"], b["release"] + 0.3], ["hero", "lookUp", 32.0, 36.0], ["hero", "cheer", b["cheer0"], b["cheer1"]],
    ["hero", "sit", b["sit0"], b["rise1"]], ["hero", "lookUp", 47.0, 51.4], ["hero", "crouch", b["shape0"], b["shape1"] + 0.1],
    ["hero", "shape", b["shape0"], b["shape1"]], ["hero", "hold", b["shape1"], b["lift0"] + 0.2], ["hero", "lift", b["lift0"], b["lift1"] + 0.2],
    ["hero", "lookUp", 63.6, 70.0], ["hero", "wave", b["wave0"], b["wave1"]],
    ["girl", "hold", 0, b["try0"] + 0.2], ["girl", "string", b["try0"], b["kiteFall"]], ["girl", "sad", b["sad0"], b["sad1"] + 0.2],
    ["girl", "crouch", b["gpet0"] - 0.1, b["gpet1"] + 0.1], ["girl", "pet", b["gpet0"], b["gpet1"]], ["girl", "string", b["back0"], b["reel1"]],
    ["girl", "lookUp", 32.0, 36.0], ["girl", "reel", b["reel0"], b["reel1"]], ["girl", "hold", b["reel1"], 46.0],
    ["girl", "sit", 46.2, b["rise1"]], ["girl", "lookUp", 47.0, 51.4], ["girl", "crouch", 55.7, b["roll1"] + 0.1], ["girl", "push", b["roll0"], b["roll1"]],
    ["girl", "poke", b["poke0"], b["poke1"]], ["girl", "lookUp", 63.6, 70.0], ["girl", "wave", b["gwave0"], b["gwave1"]],
    ["girl", "hold", 80.0, duration],
    ["cat", "curl", 0, b["stand"]], ["cat", "headDown", 0, b["headUp"]], ["cat", "ear", b["ear"], b["ear"] + 0.4],
    ["cat", "stretch", b["stretch0"], b["stretch1"]], ["cat", "meow", b["meow1"], b["meow1"] + 0.5], ["cat", "rub", b["rub0"], b["rub1"]],
    ["cat", "meow", b["meow2"], b["meow2"] + 0.4], ["cat", "sit", b["catSit"], b["walkA0"] + 0.4], ["cat", "lie", 44.7, 52.4],
    ["cat", "sit", 55.3, b["cwalk0"]], ["cat", "pounce", b["pounce1"], b["pounce1"] + 0.7], ["cat", "pounce", b["pounce2"], b["pounce2"] + 0.7],
    ["cat", "curl", 79.2, duration], ["cat", "headDown", 79.4, duration],
]
# 风筝所在：hand（手里）/ ground（地上）/ sky（天上）/ back（背在身后）；[起, 状态]
KITE = [[0, "hand"], [b["try0"], "tow"], [b["kiteFall"], "fall"], [b["pick1"], "hero"], [b["release"], "sky"], [b["reel0"], "reel"],
        [b["reel1"], "hand"], [b["home0"], "back"], [b["gwalk0"], "hand"]]
# 群众：摊主两人（柜台后），顾客四人
CROWD = [dict(x=5.4, z=-3.55, yaw=0, c=0), dict(x=7.6, z=-3.55, yaw=0, c=1)]
CROWD += [dict(x=x, z=-1.8, yaw=y, c=c) for x, y, c in ((4.8, 170, 2), (6.0, 200, 3), (7.0, 160, 4), (8.3, 195, 5))]

# 镜头：[起, 止, 目标状态]；T 为画面中心的世界点，hh 为 T 平面半高，k = 1/视距（0 = 正交），pitch 俯角为负
MASTER = dict(T=[0, 2.4, 0], hh=4.5, k=0, yaw=0, pitch=-6)
CAM = [[b["push0"], b["push1"], dict(T=[-1.35, 0.75, -0.3], hh=1.2)], [b["pull0"], b["pull1"], MASTER],
       [b["mkt0"], b["mkt1"], dict(T=[5.9, 1.3, -0.8], hh=2.3)], [b["camUp0"], b["camUp1"], dict(T=[5.6, 3.1, -1.0], hh=3.1)],
       [b["camA0"], b["camA1"], dict(T=[1.6, 2.0, -3.0], hh=2.9)], [b["camT0"], b["camT1"], dict(T=[-3.0, 1.45, -3.6], hh=2.0)],
       [b["camW0"], b["camW1"], dict(T=[0.4, 0.95, 1.4], hh=1.6)], [b["dolly0"], b["dolly1"], dict(k=1 / 5.5, pitch=-18)],
       [b["orbit0"], b["orbit1"], dict(yaw=360)], [b["back0w"], b["back1w"], dict(MASTER, yaw=360)]]
SEASON = [[0, 0], [b["s1a"], 0], [b["s1b"], 1], [b["s2a"], 1], [b["s2b"], 2], [b["s3a"], 2], [b["s3b"], 3], [b["melt0"], 3], [b["melt1"], 4]]
LIT = [[0, 0], [b["lit0"], 0], [b["lit1"], 1], [b["melt0"], 1], [b["melt1"], 0]]
STRIDE = dict(hero=0.9, girl=0.85, cat=0.45)


def faces(who):
    tr, keys = TRACK[who], [list(k) for k in FACE_HOLD[who]]
    for (t0, x0, z0), (t1, x1, z1) in zip(tr, tr[1:]):
        if abs(x1 - x0) + abs(z1 - z0) > 1e-6:
            keys = [k for k in keys if abs(k[0] - t0) > 1e-6] + [[t0, math.degrees(math.atan2(x1 - x0, z1 - z0))]]
    keys.sort()
    for i in range(1, len(keys)):  # 展开角度，转向走最短弧
        while keys[i][1] - keys[i - 1][1] > 180: keys[i][1] -= 360
        while keys[i][1] - keys[i - 1][1] < -180: keys[i][1] += 360
    return [[round(t, 4), round(y, 2)] for t, y in keys]


def steps(who):
    """落脚时刻：沿轨迹累计距离每过半个步幅一次（与 path.js 的步行相位同式）。"""
    out, acc, s = [], 0.0, STRIDE[who] / 2
    for (t0, x0, z0), (t1, x1, z1) in zip(TRACK[who], TRACK[who][1:]):
        d = math.hypot(x1 - x0, z1 - z0)
        if d < 1e-6: continue
        k = math.floor(acc / s) + 1
        while k * s <= acc + d:
            out.append(round(t0 + (k * s - acc) / d * (t1 - t0), 4)); k += 1
        acc += d
    return out


for who, tr in TRACK.items():
    assert all(q[0] > p[0] for p, q in zip(tr, tr[1:])), who
    for (t0, x0, z0), (t1, x1, z1) in zip(tr, tr[1:]):
        v = math.hypot(x1 - x0, z1 - z0) / (t1 - t0)
        assert v < (3.2 if who == "cat" else 2.4), (who, t0, round(v, 2))
STEPS = {w: steps(w) for w in TRACK}
data = {"duration": duration, "bar": BAR, "beats": {k: round(v, 4) for k, v in b.items()}, "res": RES, "quant": QUANT,
        "lay": LAY, "radius": R, "track": TRACK, "face": {w: faces(w) for w in TRACK}, "acts": ACTS, "kite": KITE, "crowd": CROWD,
        "cam": CAM, "master": MASTER, "season": SEASON, "lit": LIT, "stride": STRIDE}
write_js(ROOT / "assets/data/n4.js", "N4", data)
set_duration(ROOT / "index.html", duration)
print("duration", duration, "steps", {w: len(s) for w, s in STEPS.items()})

# ---- 声音：音效与音乐都按画面分辨率「降采样」（采样保持 + 比特量化），与画面同一张分辨率表 ----
import numpy as np  # noqa: E402
from scipy.signal import lfilter  # noqa: E402
from common import SR, Track, mallet, thump  # noqa: E402

HOLD = {16: (24, 4), 32: (16, 5), 64: (10, 6), 128: (6, 7), 256: (4, 8), 512: (2, 10), 1024: (1, 12), 0: (1, 16)}


def res_at(t):
    n = 16
    for t0, lo, hi, dur, d in RES:
        if t < t0: break
        n = (hi if d > 0 else lo) if t >= t0 + dur / 2 else ((lo if d > 0 else hi))
    return n


def crush(x):
    """x: (声道, 采样) 或 (采样,)；按时刻查分辨率，分段做采样保持与量化。"""
    y = x.copy(); one = y.ndim == 1
    if one: y = y[None]
    hop = SR // 100
    for i in range(0, y.shape[1], hop):
        h, bits = HOLD[res_at(i / SR)]
        if h == 1 and bits == 16: continue
        s = y[:, i:i + hop]
        if h > 1:
            idx = (np.arange(i, i + s.shape[1]) // h) * h
            s = y[:, np.clip(idx, 0, y.shape[1] - 1)]
        q = 2 ** (bits - 1)
        y[:, i:i + s.shape[1]] = np.round(s * q) / q
    return y[0] if one else y


rng = np.random.default_rng(44)
tr = Track(duration)
TT = lambda d: np.arange(int(d * SR)) / SR  # noqa: E731


def noise(d, cut, amp=1.0):
    a = math.exp(-2 * math.pi * cut / SR)
    y = lfilter([1 - a], [1, -a], rng.standard_normal(int(d * SR)))
    return amp * y / (np.abs(y).max() + 1e-9)


def env(d, att=0.01, rel=0.1):
    t = TT(d)
    return np.minimum(t / att, 1) * np.minimum((d - t) / rel, 1).clip(0)


def bed(t0, t1, cut, amp, mod=0.0, rate=0.2, att=1.0):
    d = t1 - t0
    tr.place(t0, noise(d, cut, amp) * env(d, att, 1.0) * (1 + mod * np.sin(2 * np.pi * rate * TT(d))))


def tone(f, d, amp, sq=False):
    s = np.sin(2 * np.pi * f * TT(d))
    return amp * (np.sign(s) * 0.5 if sq else s) * env(d, 0.003, d * 0.6)


def chirp(amp):
    t, f0 = TT(0.09), 3000 + 1400 * rng.random()
    return amp * np.sin(2 * np.pi * np.cumsum(f0 + 1500 * np.sin(2 * np.pi * 22 * t)) / SR) * np.sin(np.pi * t / 0.09)


def meow(amp, f=650, d=0.45):
    t = TT(d); f_t = f * (1 + 0.35 * np.sin(np.pi * t / d))
    s = sum((1 / h) * np.sin(2 * np.pi * h * np.cumsum(f_t) / SR) for h in (1, 2, 3))
    return amp * s * np.sin(np.pi * t / d) ** 0.7


def season_of(t):
    for k in ("s3a", "s2a", "s1a"):
        if t >= b[k]: return {"s3a": 3, "s2a": 2, "s1a": 1}[k] if t < b["melt0"] else 0
    return 0


# 分辨率：每次翻倍一声「裂」，音高一级级升高；回落时一级级降下
for k, (t0, lo, hi, dur, d) in enumerate(RES):
    lvl = int(math.log2(lo)) - 4
    f = 523.25 * 2 ** ((lvl + (1 if d > 0 else 0)) * 7 / 12)
    tr.place(t0, mallet(f, 0.14, 0.25, rng)); tr.place(t0, noise(0.15, 6000, 0.05) * np.exp(-TT(0.15) / 0.03))
    tr.place(t0 + dur * 0.5, mallet(f * 1.5, 0.06, 0.2, rng))
for t in (b["blink1"], b["blink2"]):
    for dt in (0.09, 0.27): tr.place(t + dt, tone(1318.5, 0.06, 0.09, True))
# 脚步：草地轻、雪地沙沙
for who, amp in (("hero", 0.07), ("girl", 0.06), ("cat", 0.025)):
    for t in STEPS[who]:
        s = season_of(t)
        tr.place(t, noise(0.09 if s == 3 else 0.05, 2400 if s == 3 else 900, amp * (1.5 if s == 3 else 1)) * np.exp(-TT(0.09 if s == 3 else 0.05) / 0.025))
# 春：鸟、猫醒来
for t in np.arange(3.2, b["s1b"], 0.9): tr.place(float(t + 0.5 * rng.random()), chirp(0.05))
tr.place(b["meow1"], meow(0.12)); tr.place(b["meow2"], meow(0.1, 720, 0.35))
tr.place(b["hop"] + 0.48, thump(0.12, 160))
d = b["rub1"] - b["rub0"]; tr.place(b["rub0"], noise(d, 160, 0.1) * np.abs(np.sin(2 * np.pi * 24 * TT(d))) * env(d, 0.2, 0.3))
# 夏：集市人声、风筝
bed(b["mkt0"] - 1, b["s2a"] + 2, 900, 0.06, 0.5, 0.7)
for k in range(14): tr.place(b["mkt0"] + 0.85 * k + 0.3 * rng.random(), noise(0.25, 1400, 0.03) * env(0.25, 0.04, 0.15))
d = b["kiteFall"] - b["try0"]; tr.place(b["try0"], noise(d, 2600, 0.06) * np.abs(np.sin(2 * np.pi * 11 * TT(d))) * env(d, 0.1, 0.2))
tr.place(b["kiteFall"] + 0.6, thump(0.14, 120)); tr.place(b["kiteFall"] + 0.6, noise(0.2, 3000, 0.06) * np.exp(-TT(0.2) / 0.05))
tr.place(b["sad0"] + 0.2, tone(392, 0.25, 0.03)); tr.place(b["sad0"] + 0.45, tone(370, 0.35, 0.03))
bed(b["release"] - 0.4, b["kiteUp"] + 1.0, 700, 0.14, 0.6, 0.35, 0.4)
d = b["kiteUp"] - b["release"]; tr.place(b["release"], noise(d, 2600, 0.05) * np.abs(np.sin(2 * np.pi * 9 * TT(d))) * env(d, 0.1, 0.8))
for k in range(5): tr.place(b["cheer0"] + 0.31 * k, noise(0.12, 2800, 0.05) * env(0.12, 0.005, 0.08))
# 秋：灯亮（光打开）、阵风与麦浪、落叶、黄昏虫鸣
d = b["lit1"] - b["lit0"]
tr.place(b["lit0"], sum(np.sin(2 * np.pi * f * TT(d + 1)) for f in (261.6, 329.6, 392.0, 523.3)) * 0.018 * env(d + 1, d * 0.8, 1.0))
for g in (b["gust1"], b["gust2"]): bed(g - 0.5, g + 3.0, 1800, 0.09, 0.0, 0.2, 1.2); bed(g, g + 2.6, 4200, 0.04, 0.8, 3.0, 0.6)
for t in np.arange(b["s2a"], b["s3a"], 1.3): tr.place(float(t + rng.random()), noise(0.3, 4500, 0.015) * env(0.3, 0.05, 0.2))
for t in np.arange(b["dusk0"], b["s3a"] + 1, 0.42): tr.place(float(t + 0.1 * rng.random()), tone(4300, 0.05, 0.008) * np.abs(np.sin(2 * np.pi * 60 * TT(0.05))))
# 冬：风、滚雪球、团雪、放头、按鼻子、滑动变焦、扑雪花
bed(b["s3a"], b["back1w"] + 1, 380, 0.08, 0.6, 0.1, 2.0)
d = b["roll1"] - b["roll0"]; tr.place(b["roll0"], noise(d, 300, 0.12) * np.linspace(0.4, 1, int(d * SR)) * env(d, 0.3, 0.3))
for t in np.arange(b["shape0"] + 0.1, b["shape1"], 1 / 3): tr.place(float(t), noise(0.06, 1800, 0.06) * env(0.06, 0.003, 0.04))
tr.place(b["lift1"], thump(0.16, 110)); tr.place(b["lift1"], noise(0.18, 2500, 0.06) * np.exp(-TT(0.18) / 0.05))
tr.place(b["poke0"] + 0.3, tone(880, 0.08, 0.06) + tone(1320, 0.08, 0.03))
d = b["dolly1"] - b["dolly0"]
tr.place(b["dolly0"], (noise(d, 250, 0.12) + 0.04 * np.sin(2 * np.pi * np.cumsum(np.linspace(55, 110, int(d * SR))) / SR)) * env(d, d * 0.6, 0.8))
for t in (b["pounce1"], b["pounce2"]): tr.place(t + 0.05, meow(0.05, 900, 0.18)); tr.place(t + 0.7, noise(0.12, 2000, 0.07) * np.exp(-TT(0.12) / 0.03))
# 结尾：雪化（滴水）、逐格揭开、片名
for t in np.arange(b["melt0"], b["melt1"], 0.23): tr.place(float(t + 0.1 * rng.random()), mallet(1800 + 900 * rng.random(), 0.03, 0.05, rng))
for k in range(18): tr.place(b["tile0"] + (b["tile1"] - b["tile0"]) * k / 18 + 0.05 * rng.random(), mallet(1046.5 * 2 ** (rng.integers(0, 8) * 2 / 12), 0.035, 0.12, rng))
tr.place(b["title0"], mallet(523.25, 0.1, 0.8, rng)); tr.place(b["title0"], mallet(784, 0.06, 0.8, rng))
tr.buf *= 0.5 / np.abs(tr.buf).max()
tr.buf = crush(tr.buf)
tr.write(ROOT / "assets/sfx/n4.wav")

import music  # noqa: E402
music.compose(BAR, duration, SR, b, ROOT / "assets/bgm/n4.wav", crush)
print("audio ok")
