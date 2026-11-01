"""N6「方程」唯一时间源：assets/data/n6.js、assets/sfx/n6.wav、index.html。章节与讲法见 SPEC.md。
世界是一张长桌：6 张书桌（每张 32×18 单位）首尾相接，x 方向即时间，y 向下。
各章脚本按「字幕顺序」排时间：每条字幕停留 = 阅读时长，动画节拍挂在字幕起点上。"""
import base64
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import load_text, read_need, write_js  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
BAR, DW, DH = 2.5, 32, 18  # 96 BPM，一小节 2.5s


class TL:
    """时间线：t 为游标。say 放一条字幕并把游标推到它结束；at 记节拍；cam 记镜头段。"""

    def __init__(self):
        self.t, self.caps, self.b, self.cams, self.chap = 0.0, [], {}, [], {}

    def at(self, name, dt=0.0):
        self.b[name] = round(self.t + dt, 3)
        return self.b[name]

    def say(self, key, pre=0.2, hold=0.0, pos="B", col=None, plate=False):
        t0 = self.t + pre
        t1 = t0 + read_need(TX[key]) + 0.25 + hold
        self.caps.append(dict(k=key, t0=round(t0, 3), t1=round(t1, 3), pos=pos, col=col or self.col, plate=plate))
        self.b[key], self.b[key + "_e"] = round(t0, 3), round(t1, 3)
        self.t = t1
        return t0

    def wait(self, d):
        self.t += d

    def cam(self, t0, t1, **tgt):
        self.cams.append([round(t0, 3), round(t1, 3), tgt])

    def start(self, name, col):
        self.t = math.ceil(self.t / BAR - 1e-9) * BAR
        self.chap[name], self.col = self.t, col
        return self.t


def desk(i, y=9.0):
    return dict(c=[DW * i + 16.0, y], s=60.0)


# ---- 布局（世界坐标，包围盒 [x0, y0, x1, y1]）----
L = dict(phone=[174.6, 3.8, 179.8, 14.2], screen=[174.8, 4.0, 179.6, 14.0], tablet=[162.0, 3.0, 172.6, 10.4], tscreen=[162.4, 3.4, 172.2, 10.0],
         board=[8.6, 3.4, 23.4, 13.6], slips=[24.4, 3.0, 31.4, 14.6], chart=[35.0, 3.2, 55.0, 14.8], paper=[70.5, 3.0, 89.5, 15.0],
         note=[103.0, 3.4, 121.0, 15.0], printout=[134.0, 2.8, 152.0, 15.2])
BOXES = {
    0: dict(board=L["board"], slips=L["slips"], sheaf0=[0.9, 4.4, 8.4, 5.6], sheaf1=[0.9, 6.3, 8.4, 7.5], sheaf2=[0.9, 8.2, 8.4, 9.4],
            dou=[2.3, 9.9, 4.9, 12.1], rods=[10.5, 0.8, 21.5, 2.9], stone=[3.0, 14.6, 6.4, 16.6], brush=[24.6, 15.6, 30.6, 16.4]),
    1: dict(chart=L["chart"], scope=[55.8, 2.0, 63.2, 7.0], letter=[57.3, 7.9, 61.7, 10.9], well=[59.4, 12.6, 61.6, 14.8],
            quill=[56.0, 11.0, 59.0, 17.0], candle=[32.6, 15.2, 34.6, 17.2]),
    2: dict(paper=L["paper"], memoir=[64.9, 2.3, 69.7, 8.1], pen=[65.4, 10.5, 69.6, 16.5], watch=[90.9, 2.4, 94.1, 5.6], loupe=[90.6, 11.2, 94.6, 16.8]),
    3: dict(note=L["note"], card=[96.8, 3.0, 102.4, 7.0], cloth=[97.6, 11.0, 101.8, 15.2], glasses=[122.6, 3.8, 127.0, 6.2], pencil=[122.4, 9.4, 126.8, 15.6]),
    4: dict(printout=L["printout"], keys=[141.0, 15.6, 155.0, 17.8], mouse=[155.2, 7.6, 157.0, 10.4], floppy=[129.4, 3.0, 132.2, 5.9],
            cd=[129.5, 10.5, 132.5, 13.5], sticky=[155.2, 2.3, 157.8, 4.9]),
    5: dict(phone=L["phone"], tablet=L["tablet"], cup=[184.3, 2.3, 188.9, 6.9], buds=[185.3, 12.5, 187.9, 14.7], watch=[163.2, 12.7, 165.8, 15.3],
            pen=[166.8, 12.2, 171.8, 13.0]),
}
for i, bx in BOXES.items():
    ks = list(bx)
    for a in range(len(ks)):
        x0, y0, x1, y1 = bx[ks[a]]
        assert DW * i <= x0 < x1 <= DW * (i + 1) and 0 <= y0 < y1 <= DH, (i, ks[a])
        for k2 in ks[a + 1:]:
            u0, v0, u1, v1 = bx[k2]
            assert x1 <= u0 or u1 <= x0 or y1 <= v0 or v1 <= y0, ("器物重叠", i, ks[a], k2)

# ---- 照片：180×375 RGB（黄昏湖景）。像素宽 = 屏幕宽 / 180 ----
PW, PH = 180, 375
PIX = (L["screen"][2] - L["screen"][0]) / PW
BOAT, BLOCK = [63, 262], [100, 232]  # 推近的目标像素；JPEG 取的 8×8 块左上角
ROW = [BLOCK[0], BLOCK[1] + 3]  # JPEG 一行 8 像素的起点


def make_photo():
    r = np.random.default_rng(7)
    yy, xx = np.mgrid[0:PH, 0:PW].astype(float)
    hz = 186.0  # 地平线
    k = np.clip(yy / hz, 0, 1)[..., None]
    sky = (1 - k) * np.array([38, 62, 120]) + k * np.array([246, 150, 82])
    sun = np.exp(-((xx - 116) ** 2 + (yy - 150) ** 2) / (2 * 30.0 ** 2))[..., None]
    sky = sky + sun * np.array([60, 50, 20])
    disc = ((xx - 116) ** 2 + (yy - 150) ** 2 < 15 ** 2)[..., None]
    sky = np.where(disc, np.array([255, 236, 190]), sky)
    img = sky.copy()
    m1 = 160 + 14 * np.sin(xx / 17 + 1.0) + 8 * np.sin(xx / 6.3) + 4 * np.sin(xx / 2.9 + 2)
    m2 = 176 + 7 * np.sin(xx / 11 + 3.0) + 3 * np.sin(xx / 4.1)
    img = np.where(((yy > m1) & (yy < hz))[..., None], np.array([86, 66, 92]), img)
    img = np.where(((yy > m2) & (yy < hz))[..., None], np.array([52, 44, 70]), img)
    d = np.clip((yy - hz) / (PH - hz), 0, 1)[..., None]
    lake = (1 - d) * np.array([196, 120, 92]) + d * np.array([28, 40, 72])
    streak = np.exp(-((xx - 116) ** 2) / (2 * (6 + 18 * d[..., 0]) ** 2)) * np.exp(-(yy - hz) / 120)
    ripple = 0.5 + 0.5 * np.sin(yy * 1.7 + np.sin(xx / 5) * 2)
    lake = lake + (streak * (0.55 + 0.45 * ripple))[..., None] * np.array([70, 60, 30])
    img = np.where((yy >= hz)[..., None], lake, img)
    bx, by = BOAT
    hull = (np.abs(yy - (by + 4)) < 2.2) & (np.abs(xx - bx) < 9 - (yy - by - 2) * 1.2)
    sail = (yy > by - 18) & (yy < by + 1) & (xx > bx - 1) & (xx < bx + 1 + (yy - (by - 18)) * 0.45)
    img = np.where(hull[..., None], np.array([40, 30, 34]), img)
    img = np.where(sail[..., None], np.array([214, 70, 46]), img)
    img = img + r.normal(0, 1.2, img.shape)
    return np.clip(np.round(img), 0, 255).astype(np.uint8)


PHOTO = make_photo()
pix_c = lambda i, j: [L["screen"][0] + (i + 0.5) * PIX, L["screen"][1] + (j + 0.5) * PIX]  # noqa: E731

# ======== 第 0 章：照片 → 长桌 ========
tl = TL()
B, mark = tl.b, (lambda n, v: tl.b.__setitem__(n, v if isinstance(v, list) else round(v, 3)))
PH_V = dict(c=[177.2, 9.0], s=95.0)
BV = dict(c=[16.0, 8.8], s=92.0)
TV = dict(c=[167.3, 6.7], s=140.0)
P_BOAT = pix_c(*BOAT)
tl.start("hook", "ink")
tl.say("h1", pre=0.4, pos="R")
d0 = tl.t - 1.0
tl.cam(d0, d0 + 4.0, c=P_BOAT, s=7200.0, anchor=P_BOAT)
tl.t = d0 + 4.0
tl.say("h2", pre=0.1, hold=0.6, col="paper", plate=True)
tl.cam(tl.t, tl.t + 3.6, **PH_V, anchor=P_BOAT)
tl.wait(2.0)
tl.say("h3", col="paper")
tl.cam(tl.t, tl.t + 1.6, **desk(5))
tl.wait(1.4)
s = tl.say("h4", hold=1.4)
mark("apps", [s + 0.3, s + 2.0, s + 3.7])  # 屏幕依次换成修图、推荐、AI
tl.say("h5")
m0 = tl.t + 0.2
tl.cam(m0, m0 + 3.4, c=[96.0, 9.0], s=10.0)
mark("map", [m0, m0 + 3.4])
tl.t = m0 + 1.6
tl.say("h6", hold=0.6, col="paper")
tl.cam(tl.t + 0.1, tl.t + 3.0, **desk(0))
tl.wait(3.0)

# ======== 第 1 章：方程术 ========
COLX, ROWY = [12.4, 16.0, 19.6], [5.0, 6.9, 8.8, 11.0]  # 左、中、右行；上、中、下禾、实
CLUES = [[3, 2, 1, 39], [2, 3, 1, 34], [1, 2, 3, 26]]
tl.start("han", "ink")
tl.say("t1", pre=0.3)
s = tl.say("t2"); mark("tags", s + 0.6)
s = tl.say("t3", hold=0.6); mark("slipHi", [s + 0.4, s + 1.1, s + 1.8])
p = tl.t + 0.1; tl.cam(p, p + 1.4, **BV); tl.t = p + 1.4
mark("balIn", tl.t); tl.wait(1.2)
tl.col = "paper"
s = tl.say("t4", hold=1.4); mark("wrong", [s + 0.8, s + 2.4]); mark("stones", [s + 3.6, s + 5.4])
s = tl.say("t5", hold=0.6); mark("x3", s + 0.6)
s = tl.say("t6", hold=1.8); mark("sub", [s + 0.4, s + 2.2])
s = tl.say("t7"); mark("zero", s + 0.2)
s = tl.say("t8", hold=1.6); mark("bal3", s + 0.2); mark("toRods", s + 1.6)
cols = [CLUES[2][:], CLUES[1][:], CLUES[0][:]]  # 左 = 线索三，中 = 线索二，右 = 线索一（《九章》从右往左摆）
EV = []


def op(t, kind, dst, f=None, src=None):
    cols[dst] = [v * f for v in cols[dst]] if kind == "mul" else [a - b for a, b in zip(cols[dst], cols[src])]
    assert all(v >= 0 for v in cols[dst])
    EV.append(dict(t=round(t, 3), kind=kind, col=dst, src=src, f=f, vals=cols[dst][:]))


s = tl.say("t9", hold=4.2)
op(s + 0.4, "mul", 1, f=3); op(s + 1.0, "sub", 1, src=2); op(s + 1.5, "sub", 1, src=2)
op(s + 2.3, "mul", 0, f=3); op(s + 2.9, "sub", 0, src=2); op(s + 3.7, "mul", 0, f=5)
for k in range(4): op(s + 4.3 + 0.45 * k, "sub", 0, src=1)
assert cols[1] == [0, 5, 1, 24], cols
assert cols[0] == [0, 0, 36, 99], cols
from fractions import Fraction as Fr  # noqa: E402
zq = Fr(99, 36); yq = (24 - zq) / 5; xq = (39 - 2 * yq - zq) / 3
assert (xq, yq, zq) == (Fr(37, 4), Fr(17, 4), Fr(11, 4))  # 《九章》：九斗四分斗之一、四斗四分斗之一、二斗四分斗之三
s = tl.say("t10", hold=0.4); mark("hi", s)
tl.cam(tl.t, tl.t + 1.2, **desk(0)); tl.wait(1.0)
tl.col = "ink"
s = tl.say("t11", hold=1.0); mark("ans", [s + 0.4, s + 1.2, s + 2.0])  # 下、中、上
tl.say("t12"); tl.say("t13", hold=0.6)
HAN = dict(colx=COLX, rowy=ROWY, sep=9.9, clues=CLUES, ev=EV, ans=["9¼", "4¼", "2¾"])

# ======== 第 2 章：谷神星（星图局部坐标 u, v；原点在星图左上角）========
tl.start("tr1", "ink"); tl.cam(tl.t, tl.t + BAR, **desk(1), dip=34.0); tl.wait(BAR)
tl.start("gauss", "paper")
rng = np.random.default_rng(1801)
true_v = lambda u: 8.2 - 0.55 * (u - 3) + 0.012 * (u - 3) ** 2  # noqa: E731
OBS_U = np.array([3.0 + 0.5 * i for i in range(10)])
OBS_V = true_v(OBS_U) + rng.normal(0, 0.38, len(OBS_U))
UC = 5.25
A = np.stack([np.ones_like(OBS_U), OBS_U - UC, (OBS_U - UC) ** 2], 1)
pstar = np.linalg.lstsq(A, OBS_V, rcond=None)[0]
p0 = np.array([OBS_V.mean(), 0.0, 0.0])
sse = lambda p: float(((A @ p - OBS_V) ** 2).sum())  # noqa: E731
ss = [sse(p0 + (pstar - p0) * e) for e in np.linspace(0, 1, 50)]
assert all(b <= a + 1e-12 for a, b in zip(ss, ss[1:])), "总面积须单调下降"
NE = np.concatenate([A.T @ A, (A.T @ OBS_V)[:, None]], 1)  # 正规方程 [AᵀA | Aᵀy]
NE_STEPS, mm = [NE.copy()], NE.copy()
for j in range(2):
    for i in range(j + 1, 3): mm[i] = mm[i] - mm[i, j] / mm[j, j] * mm[j]
    NE_STEPS.append(mm.copy())
assert abs(mm[2, 3] / mm[2, 2] - pstar[2]) < 1e-9
# 穿过全部 10 点的 9 次多项式：乱拐的反例
VAND = np.vander(OBS_U - UC, 10)
interp = np.linalg.solve(VAND, OBS_V)
tl.say("g1", pre=0.4)
p = tl.b["g1"] + 0.6; tl.cam(p, p + 1.5, c=[45.0, 9.2], s=92.0)
mark("walk", [p + 0.2, p + 4.0])
s = tl.say("g2", hold=0.6); mark("sun", [s - 0.4, s + 5.5]); mark("hide", [s + 1.2, s + 2.0])
s = tl.say("g3", hold=0.4); mark("err", s + 0.6)
s = tl.say("g4", hold=1.2); mark("wiggle", [s + 0.2, s + 1.4, s + 4.6])
s = tl.say("g5", hold=1.0); mark("fitIn", s + 0.2); mark("bands", [s + 0.8, s + 2.8])
s = tl.say("g6", hold=1.2); mark("fit", [s + 0.2, s + 3.8])
s = tl.say("g7", hold=0.4); mark("lsq", s)
s = tl.say("g8", hold=0.8); mark("ne", s + 0.4)
s = tl.say("g9", hold=1.0); mark("neT", [s + 0.5, s + 1.7, s + 2.9])
s = tl.say("g10", hold=1.4); mark("pred", [s - 0.2, s + 1.2])
U_PRED = 15.5
GAUSS = dict(o=L["chart"][:2], obsU=OBS_U.round(4).tolist(), obsV=OBS_V.round(4).tolist(), uc=UC, p0=p0.round(5).tolist(),
             p1=pstar.round(5).tolist(), sse0=round(ss[0], 4), interp=interp.tolist(), ne=[x.round(1).tolist() for x in NE_STEPS],
             path=[2.6, 7.6], sunU=[21.0, -3.0], uPred=U_PRED,
             vPred=round(float(np.array([1, U_PRED - UC, (U_PRED - UC) ** 2]) @ pstar), 4),
             stars=[[round(float(rng.uniform(0.4, 19.6)), 3), round(float(rng.uniform(0.4, 11.2)), 3), round(float(rng.uniform(0.02, 0.07)), 3)]
                    for _ in range(150)])
GAUSS["obsT"] = [round(B["walk"][0] + (u - 2.6) / 5.0 * (B["walk"][1] - B["walk"][0]), 3) for u in OBS_U]

# ======== 第 3 章：矩阵会动（方格纸局部坐标，y 向上；矩阵 [[a, b], [c, d]] 两列 = 两根算筹的落点）========
tl.start("tr2", "paper"); tl.cam(tl.t, tl.t + BAR, **desk(2), dip=34.0); tl.wait(BAR)
tl.start("cay", "ink")
I2 = [[1, 0], [0, 1]]
MK = []  # [起, 止, 矩阵]


def morph(t0, d, M):
    MK.append([round(t0, 3), round(t0 + d, 3), M])


mul2 = lambda P, Q: [[P[0][0] * Q[0][0] + P[0][1] * Q[1][0], P[0][0] * Q[0][1] + P[0][1] * Q[1][1]],  # noqa: E731
                     [P[1][0] * Q[0][0] + P[1][1] * Q[1][0], P[1][0] * Q[0][1] + P[1][1] * Q[1][1]]]
det2 = lambda M: M[0][0] * M[1][1] - M[0][1] * M[1][0]  # noqa: E731
p = tl.t + 0.6; tl.cam(p, p + 1.4, c=[80.0, 9.0], s=88.0); tl.t = p + 1.4
s = tl.say("c1", hold=0.4)
s = tl.say("c2", hold=0.4); mark("rods", s + 0.3)
s = tl.say("c3", hold=1.6); mark("wander", [s + 0.3, s + 3.4])
s = tl.say("c4", hold=1.2); mark("cat", s); mark("nose", [s + 0.8, s + 2.4])
M1 = [[1.4, -0.5], [0.4, 1.0]]
s = tl.say("c5", hold=0.6); morph(s + 0.6, 1.8, M1)
s = tl.say("c6", hold=1.4); mark("nose2", [s + 0.3, s + 2.0])
s = tl.say("c7", hold=1.4); mark("matShow", s + 0.2)
morph(tl.t + 0.2, 1.0, I2); tl.wait(1.2)
OPS = [[[1.5, 0], [0, 1.5]], [[0.866, -0.5], [0.5, 0.866]], [[1, 0.8], [0, 1]], [[-1, 0], [0, 1]]]
s = tl.say("c8", hold=5.6); mark("ops", [round(s + 0.4 + 1.4 * k, 3) for k in range(4)])
for k, M in enumerate(OPS):
    morph(s + 0.4 + 1.4 * k, 0.6, M); morph(s + 1.1 + 1.4 * k, 0.5, I2)
R30, SH = OPS[1], OPS[2]
s = tl.say("c9", hold=4.4); mark("chain", [s + 0.3, s + 1.5, s + 3.2])
morph(s + 0.3, 0.9, R30); morph(s + 1.5, 0.9, mul2(SH, R30)); morph(s + 2.6, 0.5, I2); morph(s + 3.2, 1.2, mul2(SH, R30))
morph(tl.t + 0.1, 0.8, I2); tl.wait(0.9)
SC = [[1.5, 0], [0, 1.5]]
s = tl.say("c10", hold=1.6); mark("areaShow", s); morph(s + 0.5, 1.2, SC)
MIR = [[-1.2, 0], [0, 1.0]]
s = tl.say("c11", hold=1.2); morph(s + 0.3, 1.4, MIR)
SING = [[1.0, 2.0], [0.5, 1.0]]
assert abs(det2(SING)) < 1e-12
s = tl.say("c12", hold=1.4); morph(s + 0.2, 1.6, SING); mark("flat", s + 1.8)
morph(tl.t + 0.2, 1.0, M1); tl.wait(1.2)
BVEC = [-1.8, 2.4]
inv = np.linalg.solve(np.array(M1), np.array(BVEC))
s = tl.say("c13", hold=2.6); mark("solve", [s + 0.4, s + 1.0, s + 3.6])
s = tl.say("c14", hold=1.8); morph(s + 0.2, 1.4, SING); mark("miss", s + 1.8)
assert all(abs(det2(M)) > 0.3 for M in (M1, R30, SH, SC, MIR))
CAY = dict(o=[77.2, 10.2], g=1.5, mk=MK, ops=OPS, chainA=R30, chainB=SH, b=BVEC, x=inv.round(5).tolist(),
           nose=[2, 1], cat=[[0.6, 0.3], [2.6, 1.8]])

# ======== 第 4 章：顺序（两本书 3D 翻转；笔记本左右两页各演一种顺序）========
tl.start("tr3", "ink"); tl.cam(tl.t, tl.t + BAR, **desk(3), dip=34.0); tl.wait(BAR)
tl.start("heis", "ink")
tl.say("q1", pre=0.4, hold=0.4)
p = tl.t; tl.cam(p, p + 1.4, c=[112.0, 9.2], s=92.0); tl.t = p + 1.4
s = tl.say("q2", hold=0.4); mark("booksIn", s)
mark("bookA", [tl.t + 0.2, tl.t + 1.4, tl.t + 2.6]); mark("bookB", [tl.t + 3.0, tl.t + 4.2, tl.t + 5.4])
tl.wait(6.0)
s = tl.say("q3", hold=1.6); mark("booksCmp", s + 0.3); mark("booksOut", tl.t - 0.6)
ROT = [[0, -1], [1, 0]]
SHR = [[1, 1], [0, 1]]
s = tl.say("q4", hold=5.4); mark("pages", [s + 0.4, s + 1.4, s + 2.6, s + 3.6, s + 5.0])
assert mul2(SHR, ROT) != mul2(ROT, SHR)
s = tl.say("q5", hold=1.6); mark("spectra", [s + 0.3, s + 2.0])
s = tl.say("q6", hold=1.4); mark("tabs", [s + 0.2, s + 1.4])
tl.say("q7", hold=0.4)
s = tl.say("q8", hold=1.6); mark("formula", [s, s + 1.6])
tl.say("q9", hold=0.6)
s = tl.say("q10", hold=1.0); mark("icons", s + 0.2)
HEIS = dict(o=[112.0, 9.2], rot=ROT, shr=SHR, ab=mul2(SHR, ROT), ba=mul2(ROT, SHR),
            F=[[0, 0], [0, 2], [0, 2], [1.2, 2], [0, 1.1], [0.8, 1.1]])

# ======== 第 5 章：特征向量 → PageRank ========
tl.start("tr4", "ink"); tl.cam(tl.t, tl.t + BAR, **desk(4), dip=34.0); tl.wait(BAR)
tl.start("goog", "ink")
p = tl.t + 0.4; tl.cam(p, p + 1.4, c=[143.0, 9.0], s=86.0); tl.t = p + 1.4
s = tl.say("e1", hold=1.6); mark("globe", [s - 0.4, s + 4.6])
EIG = [[1.5, 0.5], [0.5, 1.5]]  # 特征方向 (1, 1) λ=2、(1, −1) λ=1
s = tl.say("e2", hold=0.8); mark("eigM", [s + 0.3, s + 2.1])
s = tl.say("e3", hold=0.8); mark("eigHi", s + 0.2)
tl.say("e4", hold=0.6)
s = tl.say("e5", hold=0.6); mark("iter", [s + 0.3, s + 5.6])
tl.say("e6", hold=1.6)

it = [np.array([-0.95, 0.3])]
for _ in range(6):
    v = np.array(EIG) @ it[-1]; it.append(v / np.linalg.norm(v) * 1.0)
assert abs(abs(it[-1] @ np.array([1, 1]) / math.sqrt(2)) - 1) < 0.02
# 8 个网页：链接表（出链）。阻尼 0.85 的 PageRank
NODES = [[-4.6, -2.6], [-1.2, -3.4], [2.6, -2.8], [5.0, -0.2], [2.8, 2.4], [-0.6, 3.0], [-4.4, 1.6], [0.6, -0.1]]
LINKS = {0: [1, 7], 1: [2, 7], 2: [3, 7], 3: [4], 4: [7, 5], 5: [6, 7], 6: [0], 7: [2, 4]}
NN, DAMP = len(NODES), 0.85
Mlink = np.zeros((NN, NN))
for i, outs in LINKS.items():
    for j in outs: Mlink[j, i] = 1 / len(outs)
step = lambda x: DAMP * Mlink @ x + (1 - DAMP) / NN  # noqa: E731
pr = np.ones(NN) / NN
for _ in range(500): pr = step(pr)
assert abs(pr.sum() - 1) < 1e-12
FLOW = {}
for name, st in (("A", 0), ("F", 5)):
    x, seq = np.eye(NN)[st], []
    for _ in range(40):
        seq.append(x.round(4).tolist()); x = step(x)
    assert np.abs(x - pr).max() < 1e-3, name
    FLOW[name] = seq
hop_rng, walk, cur = np.random.default_rng(1998), [0], 0
for _ in range(9):
    cur = int(hop_rng.choice(LINKS[cur])); walk.append(cur)
s = tl.say("e7", hold=0.4)
s = tl.say("e8", hold=1.2); mark("graphIn", s - 0.6); mark("hops", [round(s + 0.3 + 0.42 * k, 3) for k in range(len(walk))])
s = tl.say("e9", hold=2.8); mark("flowA", [s + 0.3, s + 6.0])
tl.say("e10", hold=0.4)
s = tl.say("e11", hold=3.0); mark("flowF", [s + 0.2, s + 5.4])
s = tl.say("e12", hold=1.0); mark("prHi", s + 0.2)
tl.say("e13", hold=1.0)
GOOG = dict(o=[143.0, 9.0], g=1.4, eig=EIG, iter=[v.round(4).tolist() for v in it], nodes=NODES,
            links=[[i, j] for i, o in LINKS.items() for j in o], walk=walk, flow=FLOW, pr=pr.round(4).tolist())

# ======== 第 6 章：换基 → JPEG ========
tl.start("tr5", "ink"); tl.cam(tl.t, tl.t + BAR, **desk(5), dip=34.0); tl.wait(BAR)
tl.start("jpeg", "paper")
p = tl.t + 0.3; tl.cam(p, p + 1.4, **PH_V); tl.t = p + 1.4
tl.say("j1", hold=0.6); tl.say("j2", hold=0.6)
p = tl.t; tl.cam(p, p + 1.6, **TV); tl.t = p + 1.6
s = tl.say("j3", hold=0.4); mark("coins", [s, s + 2.0])
s = tl.say("j4", hold=2.4); mark("notes", [s + 1.0, s + 2.2])
tl.say("j5", hold=0.8)
N8 = 8
DCT = np.array([[math.sqrt((1 if k == 0 else 2) / N8) * math.cos(math.pi * (n + 0.5) * k / N8) for n in range(N8)] for k in range(N8)])
assert np.allclose(DCT @ DCT.T, np.eye(N8))
lum = PHOTO.astype(float) @ np.array([0.299, 0.587, 0.114])


def row_score(x, y):  # 想要：缓坡系数大、其余波纹小
    c_ = DCT @ lum[y, x:x + 8]
    return abs(c_[1]) / (np.abs(c_[2:]).max() + 1.0)


ROW = max(((x, y) for y in range(200, 330, 3) for x in range(40, 160, 2)), key=lambda p_: row_score(*p_))
ROW = [int(ROW[0]), int(ROW[1])]
row = lum[ROW[1], ROW[0]:ROW[0] + 8]
rowc = DCT @ row
assert abs(rowc[1]) > 4 * np.abs(rowc[2:]).max() and abs(rowc[1]) > 20, rowc
s = tl.say("j6", hold=1.2); mark("rowIn", s)
s = tl.say("j7", hold=4.2); mark("rowBasis", [s + 0.4, s + 1.6, s + 2.8, s + 4.0])
s = tl.say("j8", hold=2.0); mark("rowCoef", s + 0.2)
ZZ = sorted(((i, j) for i in range(8) for j in range(8)), key=lambda p_: (p_[0] + p_[1], p_[1] if (p_[0] + p_[1]) % 2 else p_[0]))
THR = 6.0


def blk_coef(x, y):
    b_ = PHOTO[y:y + 8, x:x + 8].astype(float)
    return b_, np.stack([DCT @ b_[..., c] @ DCT.T for c in range(3)])  # [通道, 竖频, 横频]


def blk_score(x, y):  # 想要：留下的积木 6–14 块，且都在低频（左上角）
    _, cf = blk_coef(x, y); m_ = np.abs(cf).max(0); ks = [(i, j) for i, j in ZZ if m_[i, j] >= THR]
    if not 6 <= len(ks) <= 14: return -1e9
    return -max(i + j for i, j in ks)


BLOCK = max(((x, y) for y in range(150, 330, 4) for x in range(20, 170, 4)), key=lambda p_: blk_score(*p_))
BLOCK = [int(BLOCK[0]), int(BLOCK[1])]
blk, coef = blk_coef(*BLOCK)
mag = np.abs(coef).max(0)
keep = [[i, j] for i, j in ZZ if mag[i, j] >= THR]
rec = np.stack([DCT.T @ np.where(mag >= THR, coef[c], 0) @ DCT for c in range(3)], -1)
err = float(np.abs(rec - blk).max())
assert len(keep) <= 16 and err < 12, (len(keep), err)
s = tl.say("j9", hold=3.4); mark("tiles", [s + 0.3, s + 0.3 + 0.05 * 64])
s = tl.say("j10", hold=1.6); mark("drop", [s + 0.3, s + 1.6])
tl.say("j11", hold=0.8)
tl.say("j12", hold=1.0)
JPEG = dict(row=ROW, rowv=row.round(2).tolist(), rowc=rowc.round(3).tolist(), block=BLOCK, coef=coef.round(3).tolist(),
            zz=[list(p_) for p_ in ZZ], keep=keep, thr=THR, err=round(err, 2))

# ======== 第 7 章：AI（全在平板屏幕里）========
tl.start("ai", "paper")
r7 = np.random.default_rng(2013)
YOU = [3.6, 1.2]
MOVIES = [[4.6, 0.6], [4.1, 1.6], [3.2, 0.4], [0.8, 4.4], [1.4, 3.6], [0.4, 2.8], [2.4, 2.4], [4.4, 3.8], [1.8, 0.9], [2.9, 4.6], [0.9, 1.4]]
dist = [math.dist(YOU, m_) for m_ in MOVIES]
near = sorted(range(len(MOVIES)), key=lambda i: dist[i])[:2]
s = tl.say("a1", pre=0.4, hold=0.6); mark("feed", s)
s = tl.say("a2", hold=1.4); mark("taste", s + 0.2)
s = tl.say("a3", hold=1.2); mark("movies", [s + 0.2, s + 1.6])
s = tl.say("a4", hold=1.6); mark("near", s + 0.4)
DOTM = MOVIES[near[0]]
s = tl.say("a5", hold=2.6); mark("dot", [s + 0.3, s + 1.3, s + 2.3])
s = tl.say("a6", hold=2.8); mark("matmul", [s + 0.3, s + 3.0])
tl.say("a7", hold=0.4)
WORDS = dict(king=[2.4, 1.5, 0.4], man=[0.5, 0.0, 0.3], woman=[0.9, 1.0, -0.6])
WORDS["queen"] = (np.array(WORDS["king"]) - WORDS["man"] + WORDS["woman"] + [0.15, -0.1, 0.1]).round(3).tolist()
CLOUD = (r7.normal(0, 1.6, (90, 3))).round(3).tolist()
s = tl.say("a8", hold=1.6); mark("words", s + 0.2)
s = tl.say("a9", hold=0.8); mark("arrow1", s + 0.3)
s = tl.say("a10", hold=0.6); mark("arrow2", s + 0.2)
s = tl.say("a11", hold=1.2); mark("queen", s)
# 两团缠在一起的点：内圈与外环。一层 = 矩阵（旋转）+ 一次弯折（取绝对值）
ang = r7.uniform(0, 2 * math.pi, 140)
rad = np.where(np.arange(140) < 60, r7.uniform(0.12, 0.8, 140), r7.uniform(1.9, 2.3, 140))
cls = (np.arange(140) >= 60).astype(int)
P0 = np.stack([rad * np.cos(ang), rad * np.sin(ang)], 1)
rotm = lambda a: np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])  # noqa: E731
ST = [P0]
for a_, axis in ((math.radians(30), 0), (math.radians(-30), 1)):
    q = ST[-1] @ rotm(a_).T; ST.append(q)
    q = q.copy(); q[:, axis] = np.abs(q[:, axis]); ST.append(q)
best = None
for th in np.linspace(0, math.pi, 361):
    n_ = np.array([math.cos(th), math.sin(th)]); pr_ = ST[-1] @ n_
    lo, hi = pr_[cls == 0], pr_[cls == 1]
    for sg in (1, -1):
        gap = (sg * hi).min() - (sg * lo).max()
        if best is None or gap > best[0]: best = (gap, th, sg, float(((sg * hi).min() + (sg * lo).max()) / 2))
assert best[0] > 0.1, best
s = tl.say("a12", hold=2.2); mark("rings", s); mark("tryCut", [s + 0.6, s + 2.6])
s = tl.say("a13", hold=4.6); mark("layers", [s + 0.4, s + 1.6, s + 2.8, s + 4.0])
s = tl.say("a14", hold=1.6); mark("cut", s + 0.3)
s = tl.say("a15", hold=1.0); mark("gpt", s)
s = tl.say("a16", hold=1.2); mark("mac", s)
s = tl.say("a17", hold=1.6); mark("gpu", s)
AI = dict(you=YOU, movies=MOVIES, near=near, dotm=DOTM, words=WORDS, cloud=CLOUD, cls=cls.tolist(),
          st=[x_.round(4).tolist() for x_ in ST], cutN=[math.cos(best[1]) * best[2], math.sin(best[1]) * best[2]], cutC=best[3] * 1.0)

# ======== 第 8 章：地基 ========
tl.start("fin", "paper")
GX, GY = 10, 6  # 内部格子；左边界热（100），其余边界冷（0）
nI = GX * GY
Ah, bh = np.zeros((nI, nI)), np.zeros(nI)
for j in range(GY):
    for i in range(GX):
        k = j * GX + i; Ah[k, k] = 4
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ii, jj = i + di, j + dj
            if 0 <= ii < GX and 0 <= jj < GY: Ah[k, jj * GX + ii] = -1
            elif ii < 0: bh[k] += 100
Th = np.linalg.solve(Ah, bh)
assert np.allclose(Ah @ Th, bh) and Th.max() < 100
s = tl.say("f1", pre=0.4, hold=0.6); mark("plate", s + 0.3)
s = tl.say("f2", hold=1.2); mark("cut2", s + 0.5)
s = tl.say("f3", hold=1.6); mark("nbr", s + 0.3)
s = tl.say("f4", hold=1.6); mark("refine", [s + 0.3, s + 2.4])
s = tl.say("f5", hold=1.0); mark("fields", s + 0.2)
p = tl.t + 0.2; tl.cam(p, p + 6.0, **BV, dip=16.0, ease="sine"); mark("fly", [p, p + 6.0]); tl.t = p + 6.0
s = tl.say("f6", hold=2.4); mark("burst", [s + 0.2, s + 3.6])
s = tl.say("f7", hold=1.0); mark("condense", [s + 0.6, s + 2.4])
p = tl.t + 0.2; tl.cam(p, p + 1.6, **desk(0)); mark("back", [p, p + 1.6]); tl.t = p + 1.6
tl.col = "ink"
s = tl.say("f8", hold=0.4); mark("title", s + 1.2)
tl.say("f9", hold=1.0)
duration = round(math.ceil((tl.t + 2.0) / BAR) * BAR, 3)
FIN = dict(gx=GX, gy=GY, T=Th.round(2).tolist())

# ---- 校验：字幕不重叠、不越界，镜头段不交叠 ----
CAPS = tl.caps
for a, b in zip(CAPS, CAPS[1:]):
    assert b["t0"] >= a["t1"] + 0.1 - 1e-9, ("字幕重叠", a["k"], b["k"])
cams = sorted(tl.cams, key=lambda c_: c_[0])
for a, b in zip(cams, cams[1:]):
    assert a[1] <= b[0] + 1e-9, ("镜头段交叠", a, b)
print("duration", duration, "chapters", {k: round(v, 1) for k, v in tl.chap.items()})

# ---- 输出数据与 index.html ----
POS = dict(B=[960, 868], R=[1500, 470])
DATA = dict(duration=duration, bar=BAR, chap=tl.chap, b=tl.b, cam=cams, start=PH_V, L=L, photo=dict(w=PW, h=PH, pix=PIX, boat=BOAT,
            b64=base64.b64encode(PHOTO.tobytes()).decode()), han=HAN, gauss=GAUSS, cay=CAY, heis=HEIS, goog=GOOG, jpeg=JPEG, ai=AI, fin=FIN,
            caps=[dict(c, x=POS[c["pos"]][0], y=POS[c["pos"]][1]) for c in CAPS])
write_js(ROOT / "assets/data/n6.js", "N6", DATA)
COL = dict(ink=("#1E2638", "0 0 18px rgba(244,239,228,.85), 0 0 4px rgba(244,239,228,.9)"),
           paper=("#F4EFE4", "0 0 18px rgba(17,14,12,.8), 0 2px 4px rgba(17,14,12,.85)"))
esc = lambda s_: s_.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")  # noqa: E731
divs = []
for i, c in enumerate(CAPS):
    x, y = POS[c["pos"]]
    fg, sh = COL[c["col"]]
    spans = "".join(f"<span>{esc(ch)}</span>" for ch in TX[c["k"]])
    divs.append(f'      <div id="cap{i}" class="cap clip" data-start="{c["t0"]}" data-duration="{round(c["t1"] - c["t0"], 3)}" data-track-index="2" '
                f'style="top:{y}px;left:{x}px;color:{fg};text-shadow:{sh}"{" data-plate" if c["plate"] else ""}>{spans}</div>')
HTML = f"""<!doctype html>
<html lang="zh-CN" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/shared/vendor/gsap/gsap.min.js"></script>
    <script src="assets/data/n6.js"></script>
    <script src="assets/text/zh-CN.js"></script>
    <style>
      @font-face {{ font-family: "Noto Sans SC"; src: url("assets/shared/fonts/NotoSansSC-VF.ttf") format("truetype"); font-weight: 100 900; }}
      @font-face {{ font-family: "JBM"; src: url("assets/shared/fonts/JetBrainsMono-VF.ttf") format("truetype"); font-weight: 100 800; }}
      @font-face {{ font-family: "KMath"; src: url("assets/shared/vendor/katex/fonts/KaTeX_Math-Italic.ttf") format("truetype"); }}
      @font-face {{ font-family: "KMain"; src: url("assets/shared/vendor/katex/fonts/KaTeX_Main-Regular.ttf") format("truetype"); }}
      @font-face {{ font-family: "KMainI"; src: url("assets/shared/vendor/katex/fonts/KaTeX_Main-Italic.ttf") format("truetype"); }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: #1D1A17; }}
      #root {{ width: 100%; height: 100%; font-family: "Noto Sans SC", sans-serif; }}
      #stage {{ position: absolute; inset: 0; overflow: hidden; }}
      #cv {{ position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }}
      .cap {{ position: absolute; width: fit-content; transform: translateX(-50%); white-space: nowrap; font-size: 54px; line-height: 1.3;
              font-weight: 700; letter-spacing: 2px; }}
      .cap[data-plate] {{ padding: 4px 28px; border-radius: 12px; }}
      .cap span {{ opacity: 0; }}
      #title {{ position: absolute; left: 0; right: 0; margin: 0 auto; top: 396px; width: fit-content; font-size: 190px; line-height: 1;
                font-weight: 700; letter-spacing: 70px; text-indent: 70px; color: #EFE3C2; opacity: 0; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{duration:g}" data-width="1920" data-height="1080">
      <div id="stage" class="clip" data-start="0" data-duration="{duration:g}" data-track-index="0" data-layout-allow-overflow>
        <canvas id="cv" width="1920" height="1080"></canvas>
        <div id="title">{esc(TX["title"])}</div>
      </div>
{chr(10).join(divs)}
      <audio id="sfx" class="clip" data-start="0" data-duration="{duration:g}" data-track-index="1" data-volume="1" src="assets/sfx/n6.wav"></audio>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      tl.set({{}}, {{}}, window.N6.duration);
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = tl;
    </script>
    <script type="module" src="n6.js"></script>
  </body>
</html>
"""
(ROOT / "index.html").write_text(HTML, encoding="utf-8")
print("data ok", len(CAPS), "caps")

# ======== 声音：所有落点取自上面的节拍 ========
from functools import partial  # noqa: E402
import common as CM  # noqa: E402
from common import SR, Track, env, lp, mallet, thump  # noqa: E402

rs = np.random.default_rng(66)
tr = Track(duration)
TT = CM.tt
noise, pluck = partial(CM.noise, rs), partial(CM.pluck, rs)
put = tr.place
F = {n: 261.63 * 2 ** (k / 12) for n, k in dict(C=0, D=2, E=4, G=7, A=9).items()}
CH = tl.chap
ORDER = sorted(CH.items(), key=lambda kv: kv[1])


def chap_at(t):
    name = "hook"
    for k, v in ORDER:
        if t >= v: name = k
    if name == "fin" and t >= B["fly"][1]: return "han"
    return name


def clack(a=0.12, f=1900):  # 算筹 / 木头碰撞
    d = 0.05
    return a * (noise(d, 6000, 1.0) * np.exp(-TT(d) / 0.006) * 0.6 + np.sin(2 * np.pi * f * TT(d)) * np.exp(-TT(d) / 0.012) + 0.5 * np.sin(2 * np.pi * 420 * TT(d)) * np.exp(-TT(d) / 0.02))


def whoosh(d, a=0.06, cut=1800):
    return lp(noise(d, cut, a) * np.sin(np.pi * TT(d) / d) ** 2, cut * 0.6)


def tick(a=0.05, f=3000):
    return noise(0.03, f, a) * np.exp(-TT(0.03) / 0.006)


def square(f, d, a):
    t_ = TT(d); return a * lp(np.sign(np.sin(2 * np.pi * f * t_)), 2500) * np.exp(-t_ / (d * 0.4)) * np.minimum(t_ / 0.004, 1)


def synth(f, d, a):
    t_ = TT(d); return a * (np.sin(2 * np.pi * f * t_) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t_ + 1)) * np.minimum(t_ / 0.03, 1) * np.exp(-t_ / (d * 0.5))


def mix(*xs):
    out = np.zeros(max(len(x_) for x_ in xs))
    for x_ in xs: out[:len(x_)] += x_
    return out


INST = dict(  # 乐器随书桌：古琴、羽管键琴、八音盒、钢琴、方波、合成器
    han=lambda f, a: pluck(f / 2, a * 2.4, 2.2), gauss=lambda f, a: mix(pluck(f, a * 1.4, 0.9), pluck(f * 2, a * 0.6, 0.6)),
    cay=lambda f, a: mallet(f * 2, a, 0.35, rs), heis=lambda f, a: mix(mallet(f, a * 1.2, 0.7, rs), mallet(f * 2, a * 0.3, 0.4, rs)),
    goog=lambda f, a: square(f, 0.5, a * 0.5), jpeg=lambda f, a: synth(f, 0.9, a), hook=lambda f, a: synth(f, 0.9, a))
ERA_OF = dict(hook="hook", map="hook", han="han", tr1="han", gauss="gauss", tr2="gauss", cay="cay", tr3="cay", heis="heis", tr4="heis",
              goog="goog", tr5="goog", jpeg="jpeg", ai="jpeg", fin="jpeg")
MOTIF = [["E", "D", "C"], ["D", "E", "C"], ["C", "D", "E"], ["G", "E", "D"]]
BASS = [130.81, 110.0, 87.31, 98.0]  # C  Am  F  G
nb = int(duration / BAR)
for k in range(nb - 1):
    t0 = k * BAR; era = ERA_OF[chap_at(t0 + 0.01)]
    put(t0, pluck(BASS[k % 4], 0.10, 2.4) if era in ("han", "gauss") else mallet(BASS[k % 4], 0.05, 0.8, rs))
    for j, n in enumerate(MOTIF[k % 4]):
        put(t0 + j * BAR / 4, INST[era](F[n], 0.035))
put(B["title"], mix(*(pluck(f, 0.16, 3.0) for f in (F["C"] / 2, F["G"] / 2, F["E"]))))

# ---- 动作音 ----
for c_ in cams:  # 每段运镜一阵风，长度随段长
    d = c_[1] - c_[0]
    put(c_[0], whoosh(d + 0.3, 0.05 if d < 2 else 0.08, 1400 if "dip" in c_[2] else 2200))
for k in range(40): put(B["h2"] - 1.4 + k * 0.035, tick(0.02, 3500))  # 数字一格格浮现
for a_ in B["apps"]: put(a_, whoosh(0.4, 0.05, 4000)); put(a_ + 0.35, tick(0.05, 1800))
# 汉
for k in range(3): put(B["slipHi"][k], tick(0.05, 1500))
put(B["tags"], clack(0.06, 1300))
put(B["balIn"], whoosh(0.6, 0.04)); put(B["balIn"] + 0.5, mallet(F["C"], 0.06, 0.4, rs))
put(B["wrong"][0], tick(0.06)); put(B["wrong"][0] + 0.25, CM.glide(300, 200, 0.6, 0.05)); put(B["wrong"][1] + 0.25, CM.glide(200, 300, 0.6, 0.05))
put(B["stones"][0] + 0.3, thump(0.14, 110)); put(B["stones"][0] + 0.32, thump(0.14, 110))
for i in range(18): put(B["x3"] + i * 0.03, clack(0.03, 2200))
for s0 in B["sub"]: put(s0, whoosh(0.7, 0.05, 2600)); put(s0 + 0.7, thump(0.12, 140))
put(B["zero"], mallet(F["G"] * 2, 0.06, 0.5, rs))
for ci in range(3):
    for ri in range(4): put(B["toRods"] + (2 - ci) * 0.4 + 0.3 + ri * 0.04, clack(0.07))
for e in EV:
    if e["kind"] == "mul": put(e["t"] - 0.1, CM.glide(500, 900, 0.3, 0.04))
    else: put(e["t"] - 0.45, whoosh(0.45, 0.04, 3000))
    for ri in range(4): put(e["t"] + ri * 0.03, clack(0.05, 1700 + 120 * ri))
put(B["hi"], mallet(F["E"] * 2, 0.06, 0.5, rs))
for k, a_ in enumerate(B["ans"]): put(a_, clack(0.05, 1200)); put(a_ + 0.05, INST["han"](F[["C", "E", "G"][k]] * 2, 0.06))
# 1801
for t_ in GAUSS["obsT"]: put(t_, noise(0.08, 5000, 0.04) * np.exp(-TT(0.08) / 0.03))
put(B["sun"][0], lp(noise(B["sun"][1] - B["sun"][0], 600, 0.05) * env(B["sun"][1] - B["sun"][0], 1.5, 1.5), 400))
put(B["err"], mallet(F["A"] * 2, 0.04, 0.3, rs))
put(B["wiggle"][0], CM.glide(300, 900, 0.6, 0.04)); put(B["wiggle"][0] + 0.6, CM.glide(900, 250, 0.6, 0.04))
for i in range(10): put(B["bands"][0] + i * 0.18, CM.glide(180, 420, 0.22, 0.04))
d = B["fit"][1] - B["fit"][0]
put(B["fit"][0], CM.sweep(520, 180, d, 0.05))
put(B["lsq"], thump(0.12, 100)); put(B["ne"], tick(0.05))
for t_ in B["neT"]: put(t_, clack(0.05, 1500))
put(B["pred"][1], mallet(F["E"] * 4, 0.08, 0.8, rs)); put(B["pred"][1] + 0.12, mallet(F["G"] * 4, 0.06, 0.8, rs))

# 1858：持续音的音高随面积（行列式）变，压扁时归于一声闷响
def mat_at(t):
    M = np.eye(2)
    for t0, t1, N in MK:
        if t <= t0: break
        u = min(1.0, (t - t0) / (t1 - t0)); e = 2 * u * u if u < 0.5 else 1 - 2 * (1 - u) ** 2
        M = M + (np.array(N) - M) * e
        if t < t1: break
    return M


d0, d1 = B["rods"], CH["tr3"]
ctl = np.arange(d0, d1, 0.01)
dets = np.array([abs(np.linalg.det(mat_at(t_))) for t_ in ctl])
n_ = int((d1 - d0) * SR); tt_ = np.arange(n_) / SR + d0
dd = np.interp(tt_, ctl, dets)
fr = 110 * (0.55 + 0.45 * np.sqrt(np.minimum(dd, 3.0)))
ph = 2 * np.pi * np.cumsum(fr) / SR
drone = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * 0.022 * np.minimum(dd * 3, 1) * np.minimum(tt_ - d0, 1) * np.minimum(d1 - tt_, 1)
put(d0, drone)
put(B["rods"], clack(0.08)); put(B["rods"] + 0.1, clack(0.08, 1500))
for k in range(9): put(B["wander"][0] + k * 0.33, clack(0.04, 2000))
put(B["cat"], mallet(F["G"] * 2, 0.05, 0.4, rs))
for k in range(3): put(B["nose"][0] + 0.2 + k * 0.2, clack(0.05)); put(B["nose2"][0] + k * 0.2, clack(0.05))
for t_ in B["ops"]: put(t_, tick(0.06, 1600)); put(t_ + 0.05, mallet(F["E"] * 2, 0.04, 0.3, rs))
put(B["flat"], thump(0.2, 70)); put(B["miss"], CM.glide(160, 120, 0.5, 0.05))
put(B["solve"][2], mallet(F["C"] * 4, 0.06, 0.6, rs))
# 1925
for k3 in ("bookA", "bookB"):
    for t_ in B[k3][:2]: put(t_, whoosh(1.0, 0.07, 3500)); put(t_ + 1.0, thump(0.1, 160))
put(B["booksCmp"], thump(0.14, 90))
for t_ in B["pages"][1:]: put(t_, whoosh(0.9, 0.04, 2500))
put(B["pages"][4] + 1.0, thump(0.14, 90))
for k in range(6): put(B["spectra"][0] + k * 0.12, mallet(F["C"] * 2 * (1 + k * 0.25), 0.03, 0.3, rs))
for t_ in B["tabs"]: put(t_, tick(0.05, 2000))
dd2 = B["formula"][1] - B["formula"][0]
put(B["formula"][0], noise(dd2, 6000, 0.035) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * TT(dd2))) * env(dd2, 0.05, 0.1))
# 1998
dg = B["globe"][1] - B["globe"][0]
put(B["globe"][0], lp(noise(dg, 900, 0.04) * env(dg, 0.6, 0.6), 500))
put(B["eigHi"], mallet(F["E"] * 2, 0.07, 0.6, rs)); put(B["e4"], mallet(F["G"] * 2, 0.05, 0.6, rs))
for k in range(6): put(B["iter"][0] + k * (B["iter"][1] - B["iter"][0]) / 6, square(F["C"] * (1 + k * 0.12) * 2, 0.15, 0.05))
for t_ in B["hops"]: put(t_, tick(0.07, 2200)); put(t_ + 0.03, tick(0.05, 1400))
for k3 in ("flowA", "flowF"):
    a_, b_ = B[k3]
    for k in range(70): put(a_ + (b_ - a_) * (k / 70) ** 0.8, tick(0.025, 1800 + 800 * rs.random()))
put(B["prHi"], square(F["C"] * 2, 0.4, 0.06)); put(B["prHi"] + 0.15, square(F["G"] * 2, 0.5, 0.06))

# 今天：硬币、纸币、积木、点与箭头、显卡
for k in range(87): put(B["coins"][0] + k * 0.02 + 0.2, mallet(2400 + 300 * rs.random(), 0.012, 0.05, rs))
for k in range(4): put(B["notes"][0] + k * 0.25, noise(0.15, 3000, 0.04) * env(0.15, 0.01, 0.1))
for k in range(2): put(B["notes"][1] + k * 0.2 + 0.25, mallet(2600, 0.03, 0.08, rs))
for k, t_ in enumerate(B["rowBasis"]): put(t_, mallet(F["C"] * 2 * (1 + 0.5 * k), 0.04, 0.3, rs))
for q in range(4): put(B["rowCoef"] + q * 0.25, tick(0.05, 2000 if q < 2 else 900))
keepset = {i * 8 + j for i, j in keep}
for q, (i, j) in enumerate(ZZ):
    put(B["tiles"][0] + q * 0.05, mallet(800 + 40 * q, 0.03 if i * 8 + j in keepset else 0.012, 0.06, rs))
dq = B["drop"][1] - B["drop"][0]
for q, (i, j) in enumerate(ZZ):
    if i * 8 + j not in keepset: put(B["drop"][0] + dq * q / 64, tick(0.02, 900))
put(B["taste"], mallet(F["C"] * 2, 0.05, 0.4, rs))
for i in range(len(MOVIES)): put(B["movies"][0] + i * 0.12, tick(0.03, 2400))
put(B["near"], synth(F["E"] * 2, 0.6, 0.05))
for k, t_ in enumerate(B["dot"]): put(t_, synth(F[["C", "E", "G"][k]] * 2, 0.5, 0.04))
for q in range(24): put(B["matmul"][0] + 0.4 + q * 0.1, tick(0.02, 2000 + 60 * q))
put(B["words"], whoosh(1.0, 0.03, 3000))
put(B["arrow1"], CM.glide(300, 450, 0.8, 0.05)); put(B["arrow2"], CM.glide(300, 450, 1.0, 0.05))
put(B["queen"], synth(F["G"] * 2, 1.2, 0.06)); put(B["queen"] + 0.1, synth(F["E"] * 4, 1.0, 0.04))
put(B["tryCut"][0], whoosh(2.0, 0.04, 4000)); put(B["tryCut"][1], CM.glide(200, 140, 0.4, 0.05))
for t_ in B["layers"]: put(t_, whoosh(0.9, 0.05, 2000))
for t_ in B["layers"][1::2]: put(t_ + 0.85, thump(0.12, 120))
put(B["cut"], noise(0.4, 7000, 0.05) * np.exp(-TT(0.4) / 0.12)); put(B["cut"] + 0.4, synth(F["C"] * 4, 1.0, 0.05))
put(B["gpt"], thump(0.12, 80))
for q in range(30): put(B["mac"] + 2.2 * (q / 30) ** 2, tick(0.025, 3000))
dgp = CH["fin"] - B["gpu"]
eg = env(dgp, 0.4, 0.4)
put(B["gpu"], mix(lp(noise(len(eg) / SR, 400, 0.05) * eg, 250), np.sin(2 * np.pi * 120 * TT(len(eg) / SR)) * 0.01 * eg))
# 地基
put(B["plate"], lp(noise(2.0, 500, 0.03) * env(2.0, 0.8, 0.8), 300))
put(B["cut2"], noise(0.3, 6000, 0.05) * np.exp(-TT(0.3) / 0.08))
put(B["nbr"], tick(0.05, 1800))
for q in range(40): put(B["refine"][0] + (B["refine"][1] - B["refine"][0]) * (q / 40) ** 0.6, tick(0.02, 2500 + 50 * q))
for k in range(5): put(B["fields"] + 0.3 + k * 0.35, mallet(F[["C", "D", "E", "G", "A"][k]] * 2, 0.05, 0.4, rs))
bd = B["burst"][1] - B["burst"][0]
for q in range(260): put(B["burst"][0] + bd * (q / 260) ** 0.7, clack(0.02 + 0.02 * rs.random(), 1500 + 900 * rs.random()))
for q in range(30): put(B["condense"][0] + q * 0.06, clack(0.03, 1700))
for q in range(80): put(B["back"][0] + 1.6 * rs.random(), clack(0.03, 1400 + 600 * rs.random()))
tr.write(ROOT / "assets/sfx/n6.wav")
print("audio ok")
