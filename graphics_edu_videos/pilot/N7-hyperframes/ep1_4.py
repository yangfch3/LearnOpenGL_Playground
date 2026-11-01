"""上集 2f（两台机器接着开）、2g（三维段 2）、2-post（三维段 3：地基）。"""
import numpy as np

from core import B, DATA, at, ann, end_at, get, track, flip, sfx, tl, project
from ep1_2 import O3, S3

C_SPREAD = dict(c=[0.0, 3.0], hh=28.5)
C_2G0 = dict(c=[-22.0, 2.0], hh=26.0)
C_2G = dict(c=[-32.0, -13.0], hh=19.0, pitch=58.0, yaw=-66.0, k=1 / 90)  # 侧着看：被拉长的兔子方向横在画面里
C_POST = dict(c=[0.0, 4.0], hh=46.0, pitch=62.0, yaw=0.0, k=1 / 150)  # 斜着平看楼群，楼的正面朝镜头
R90 = np.array([[0, -1], [1, 0]]); T2 = np.array([[2, 0], [0, 1]])
A3 = np.array([[1, 1, 1], [2, 4, 6], [2, 0, 4]])
assert not np.array_equal(T2 @ R90, R90 @ T2) and round(np.linalg.det(A3)) == 12


def pmat(id_, page, c, M, t0, w, cols=None, size=2.6):
    """印刷体矩阵（KaTeX 字形）：c 为中心，cols 为各列颜色名。"""
    n, m = len(M), len(M[0])
    dx, dy = size * 1.3, size * 1.1
    hw, hh = (m - 1) * dx / 2 + size * 0.9, (n - 1) * dy / 2 + size * 0.7
    return ann(id_, page, c, size, s=None, kind="pmat", vals=np.array(M).tolist(), cols=cols or ["ink"] * m, dx=dx, dy=dy,
               t0=t0, w=w, box=[c[0] - hw - 0.6, c[1] - hh, c[0] + hw + 0.6, c[1] + hh])


def seg2f():
    s = tl.start("2f")
    flip(4, s + 0.1)
    tl.cam(s + 0.1, 1.2, **C_SPREAD)
    DATA["d2f"] = dict(oL=[-24.0, 8.0], oR=[24.0, 8.0], half=10.5, sc=2.0, grid=3.0, n=4)  # 格子窗 y∈[-2.5, 18.5]，算式在窗下
    tl.say("T.g", pre=0.3, st="title")
    ann("tL", "p8", [-24.0, 27.0], 2.4, key="p.rotA", t0=s + 1.2, w=[s + 1.2, s + 2.2])
    ann("tR", "p9", [24.0, 27.0], 2.4, key="p.rotB", t0=s + 1.6, w=[s + 1.6, s + 2.6])
    s1 = tl.say("g1", pre=0.2, hold=4.4)
    a, b = s1 + 0.4, s1 + 2.0
    track("rotL", 0.0, (a, a + 1.2, 90.0)); track("sxL", 1.0, (b, b + 1.2, 2.0))
    track("sxR", 1.0, (a, a + 1.2, 2.0)); track("rotR", 0.0, (b, b + 1.2, 90.0))
    for t in (a, b): sfx(t, "morph2", 1.2)
    s2 = tl.say("g2", hold=2.4)
    y = -7.0
    ann("pL", "p8", [-28.0, y], 2.4, s="TR =", font="print", align="right", t0=s2 + 0.3, w=[s2 + 0.3, s2 + 0.8])
    pmat("mL", "p8", [-21.6, y], T2 @ R90, s2 + 0.8, [s2 + 0.8, s2 + 1.6])
    ann("pR", "p9", [20.0, y], 2.4, s="RT =", font="print", align="right", t0=s2 + 1.4, w=[s2 + 1.4, s2 + 1.9])
    pmat("mR", "p9", [26.4, y], R90 @ T2, s2 + 1.9, [s2 + 1.9, s2 + 2.7])
    s3 = tl.say("g3", hold=1.8)
    ann("neq", "p8", [-3.6, y], 5.4, s="≠", font="print", col="red", t0=s3 + 0.3, w=[s3 + 0.3, s3 + 0.8])
    tl.say("n.g3", pre=0.1, st="note", hold=0.4)


def seg2g():
    s = tl.start("2g")
    flip(5, s + 0.1)
    tl.cam(s + 0.1, 1.4, **C_2G0)
    tl.say("T.k", pre=0.3, st="title")
    s1 = tl.say("k1", pre=0.2, hold=2.6)
    pmat("m3", "p10", [-24.0, 18.0], A3, s1 + 0.4, [s1 + 0.4, s1 + 2.0], cols=["chick", "rabbit", "fly"], size=2.6)
    s2 = tl.say("k2", hold=6.4)
    tl.cam(s2 + 0.1, 2.8, ease="io3", **C_2G)
    at("axes2g", [s2 + 0.1, s2 + 1.1]); sfx(s2 + 0.1, "pencil", 1.0)
    track("pop2g", 0.0, (s2 + 1.2, s2 + 2.4, 1.0))
    track("lat3", 0.0, (s2 + 2.0, s2 + 2.6, 1.0))
    track("u3", 0.0, (s2 + 3.0, s2 + 6.2, 1.0))
    sfx(s2 + 3.0, "grid3", 3.2)
    tl.cam(s2 + 3.2, 3.6, ease="sine", yaw=-46.0)
    vol = ann("vol", "p10", [-22.0, -21.0], 2.4, key="p.vol", align="left", col="red", t0=s2 + 6.2, w=[s2 + 6.2, s2 + 7.0])
    tl.say("k3", hold=1.0)  # 接回 2e 的行列式与 1d 的三平面：≠ 0 才有唯一交点
    DATA["d2g"] = dict(o=O3, s=S3, n=1.6, cells=2, A=A3.tolist(), page="p10")
    return vol


def seg2post(vol):
    s = tl.start("2p")
    for k in ("m3", "vol"): end_at(get(k), s + 0.3)  # 3×3 矩阵与体积标注随立方格一起退场
    assert vol
    tl.cam(s, 6.0, ease="sine", **C_POST)
    track("lat3", 0.0, (s + 0.2, s + 1.4, 0.0))
    track("pop2g", 0.0, (s + 0.4, s + 1.8, 0.0))
    track("ground", 0.0, (s + 0.8, s + 4.0, 1.0, "sine"))
    sfx(s, "swell", 6.0)
    blds = [("b.filter", -26, 6, 14, 12, 22), ("b.search", 0, 20, 15, 13, 29), ("b.ai", 27, 4, 15, 13, 34), ("b.game", -50, 26, 12, 10, 15),
            ("b.nav", 52, 30, 12, 10, 18), ("b.weather", -55, -10, 17, 10, 13), ("b.ct", 61, -2, 11, 9, 12)]
    lst = []
    for i, (k, x, y, w, d, h) in enumerate(blds):
        t0 = s + 2.0 + 0.45 * i
        lst.append(dict(key=k, x=x, y=y, w=w, d=d, h=h, t=[round(t0, 3), round(t0 + 1.3, 3)], lit=k in ("b.filter", "b.search", "b.ai")))
        sfx(t0, "grow", 1.3)
    s1 = tl.say("z1", pre=2.0, hold=1.8)
    # 地基上的大字「矩阵」：平铺在楼前的方格地上，z1 说到「矩阵」时写出
    word = dict(c=[0.0, -19.0], w=40.0, d=15.0, t=[round(s1 + 1.6, 3), round(s1 + 2.6, 3)])
    sfx(word["t"][0], "marker", 1.0)
    s2 = tl.say("z2", hold=2.0)
    lit = s2 + 1.2
    track("lit", 0.0, (lit, lit + 1.4, 1.0, "sine"))
    for i in range(3): sfx(lit + 0.3 * i, "chime", [523, 659, 784][i])
    s3 = tl.say("z3", hold=2.6)
    tl.t += 1.5
    DATA["d2p"] = dict(blds=lst, word=word)
    # 终机位下：楼都在画面内，楼与大字都在字幕带（y ≥ 800）之上
    for b in lst:
        for sx in (-1, 1):
            for sy in (-1, 1):
                for z in (0, b["h"]):
                    X, Y = project(C_POST, [b["x"] + sx * b["w"] / 2, b["y"] + sy * b["d"] / 2, z])
                    assert 20 < X < 1900 and 20 < Y < 800, ("楼出画或进字幕带", b["key"], round(X), round(Y))
    for sx in (-1, 1):
        for sy in (-1, 1):
            X, Y = project(C_POST, [word["c"][0] + sx * word["w"] / 2, word["c"][1] + sy * word["d"] / 2, 0])
            assert 20 < X < 1900 and Y < 800, ("大字出画或进字幕带", round(X), round(Y))
    assert s1 and s3


def run():
    seg2f()
    vol = seg2g()
    seg2post(vol)
