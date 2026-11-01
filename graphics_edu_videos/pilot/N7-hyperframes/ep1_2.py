"""上集 1d（三维段 1）、1e、1f、1-post。"""
import numpy as np

from core import B, DATA, at, ann, ring, end_at, animal, hop_to, fly_to, track, flip, sfx, tl, ANN
from ep1_1 import ring_on, tw

C_1D0 = dict(c=[-31.0, 11.5], hh=20.0)  # 只看左页上半：笼子与三元方程组
C_1D3 = dict(c=[-27.0, -14.0], hh=17.0, pitch=55.0, yaw=-25.0, k=1 / 90)
C_BACK = dict(c=[-6.0, 2.0], hh=30.0, pitch=0.0, yaw=0.0, k=0.0)
C_1E, C_1F = dict(c=[24.0, 15.0], hh=20.0), dict(c=[24.0, -17.5], hh=24.5)
C_WIDE = dict(c=[0.0, 0.0], hh=38.0)
O3, S3, N3 = [-37.0, -26.0], 1.5, 12  # 1d 坐标系：原点、1 只 = 1.5 格、各轴 0–12
PLANES = [([1, 1, 1], 12, "chick"), ([2, 4, 6], 46, "rabbit"), ([2, 0, 4], 26, "fly")]


def clip_plane(n, d, L=N3):
    """平面 n·x = d 与立方体 [0, L]³ 的交多边形（按角度排序的顶点）。"""
    pts = []
    C = [np.array([i, j, k]) * L for i in (0, 1) for j in (0, 1) for k in (0, 1)]
    for a in range(8):
        for b in range(a + 1, 8):
            if np.sum(np.abs(C[a] - C[b])) != L: continue
            fa, fb = np.dot(n, C[a]) - d, np.dot(n, C[b]) - d
            if fa * fb < 0 or (fa == 0): pts.append(C[a] + (C[b] - C[a]) * (fa / (fa - fb)) if fa != fb else C[a])
    P = np.unique(np.round(np.array(pts), 6), axis=0)
    c = P.mean(0)
    n = np.array(n, float) / np.linalg.norm(n)
    u = np.cross(n, [0, 0, 1] if abs(n[2]) < 0.9 else [1, 0, 0]); u /= np.linalg.norm(u); v = np.cross(n, u)
    ang = np.arctan2((P - c) @ v, (P - c) @ u)
    return P[np.argsort(ang)].round(4).tolist()


def seg1d():
    s = tl.start("1d")
    tl.cam(s, 1.6, **C_1D0)
    p = "p2"
    cage = [-18.0, 14.5, -4.0, 27.5]
    at("cage1d", [s + 0.4, s + 1.4])
    sfx(s + 0.4, "pencil", 1.0)
    spots = [("chicken", -15.5, 14.5), ("chicken", -12.0, 14.5), ("chicken", -8.5, 14.5), ("rabbit", -5.6, 14.5),
             ("chicken", -15.5, 19.0), ("chicken", -12.0, 19.0), ("rabbit", -8.6, 19.0), ("rabbit", -5.6, 19.0)]
    for i, (kind, x, y) in enumerate(spots):  # 5 鸡 3 兔先进笼：从右边跳进来，速度一致，先进的去最里面
        a = animal(f"q{i}", kind, p, 1.0, y, sc=0.75, face=-1, cage=[cage[0], y, cage[2], y + 4.5], show=(s + 1.3 + 0.32 * (i % 4), None))
        n = 3
        hop_to(a, s + 1.35 + 0.32 * (i % 4), x, n=n, d=round((1.0 - x) / n / 12.0, 3), h=0.8, gap=0.0)
    tl.say("T.q", pre=0.3, st="title")
    s1 = tl.say("q1", pre=0.2, hold=2.6)
    for i in range(4):  # 4 只蜻蜓从左上飞进笼子上层：先进的飞最远，速度一致
        x1 = -5.6 - 3.2 * i
        a = animal(f"fl{i}", "fly", p, -50.0, 32.0, sc=0.9, face=1, cage=[cage[0], 22.0, cage[2], cage[3]], show=(s1 + 0.2 + 0.45 * i, None))
        fly_to(a, s1 + 0.2 + 0.45 * i, x1, 23.4 + 0.5 * (i % 2), round((x1 + 50) / 26.0, 3))
    ann("q1", p, [-45.0, 11.5], 2.1, key="p.q1", align="left", t0=s1 + 2.4, w=[s1 + 2.4, s1 + 3.6])
    ann("q2", p, [-45.0, 7.6], 2.1, key="p.q2", align="left", t0=s1 + 3.7, w=[s1 + 3.7, s1 + 4.9])
    ann("q3", p, [-45.0, 3.7], 2.1, key="p.q3", align="left", t0=s1 + 5.0, w=[s1 + 5.0, s1 + 6.2])
    s2 = tl.say("q2", hold=1.0)
    tl.cam(s2 + 0.2, 2.8, ease="io3", **C_1D3)
    at("axes1d", [s2 + 0.2, s2 + 1.2]); sfx(s2 + 0.2, "pencil", 1.0)
    track("pop1d", 0.0, (s2 + 1.4, s2 + 2.8, 1.0))
    sfx(s2 + 1.4, "rise", 1.4)
    ann("x3", p, [O3[0] + S3 * N3 + 1.2, O3[1]], 2.0, key="p.xc", align="left", t0=s2 + 3.0, w=[s2 + 3.0, s2 + 3.5])
    ann("y3", p, [O3[0] + 0.8, O3[1] + S3 * N3 + 1.6], 2.0, key="p.yr", align="left", t0=s2 + 3.0, w=[s2 + 3.0, s2 + 3.5])
    s3 = tl.say("q3", hold=3.0)
    polys = []
    for i, (n, d, col) in enumerate(PLANES):
        track(f"pl{i}", 0.0, (s3 + 0.3 + 1.2 * i, s3 + 1.3 + 1.2 * i, 1.0, "o3"))
        sfx(s3 + 0.3 + 1.2 * i, "grow", 1.0)
        polys.append(dict(pts=clip_plane(n, d), col=col))
    sol = np.linalg.solve(np.array([P[0] for P in PLANES], float), [P[1] for P in PLANES])
    assert np.allclose(sol, [5, 3, 4]) and round(np.linalg.det(np.array([P[0] for P in PLANES]))) == 12
    track("pt1d", 0.0, (s3 + 4.0, s3 + 4.5, 1.0)); sfx(s3 + 4.0, "chime", 880)
    tl.cam(s3 + 4.4, 2.6, ease="sine", yaw=-6.0)
    e = tl.t + 0.2
    tl.cam(e, 2.0, ease="io3", **C_BACK)
    track("pop1d", 0.0, (e + 0.6, e + 2.0, 0.0))  # 纸面落回：立体图收成平面图
    sfx(e + 0.6, "fold", 1.4)
    tl.t = e + 2.2
    DATA["d1d"] = dict(o=O3, s=S3, n=N3, planes=polys, sol=[5, 3, 4], page=p, cage=cage)


def seg1e():
    s = tl.start("1e")
    flip(2, s + 0.1)
    tl.cam(s + 0.1, 1.4, **C_1E)
    p, S, st = "p5", [7.0, 9.0], 3.0  # 起点、1 步 = 3 格
    V = lambda v, o=S: [o[0] + v[0] * st, o[1] + v[1] * st]  # noqa: E731
    tl.say("T.v", pre=0.3, st="title")
    s1 = tl.say("v1", pre=0.2, hold=0.6)
    at("map", [s1 + 0.2, s1 + 1.4]); sfx(s1 + 0.2, "pencil", 1.2)
    ann("start", p, [S[0] - 1.0, S[1]], 2.0, key="p.start", align="right", t0=s1 + 0.4, w=[s1 + 0.4, s1 + 1.0])
    ann("north", p, [42.0, 28.4], 1.8, key="p.north", t0=s1 + 1.0, w=[s1 + 1.0, s1 + 1.3])
    ann("east", p, [45.6, 24.4], 1.8, key="p.east", t0=s1 + 1.2, w=[s1 + 1.2, s1 + 1.5])
    s2 = tl.say("v2", hold=2.6)
    walk = [S] + [V([i, 0]) for i in (1, 2, 3)] + [V([3, j]) for j in (1, 2)]
    at("walk", [s2 + 0.3, 0.42])  # 一步 0.42s
    for i in range(5): sfx(s2 + 0.3 + 0.42 * (i + 1), "step")
    ta = s2 + 0.3 + 0.42 * 5 + 0.3
    at("va", [ta, ta + 0.6]); sfx(ta, "pencil", 0.6)
    ann("la", p, [V([3, 2])[0] + 1.2, V([3, 2])[1] - 1.6], 2.2, s="a = (3, 2)", font="vec", align="left", t0=ta + 0.6, w=[ta + 0.6, ta + 1.4])
    s3 = tl.say("v3", hold=4.6)
    at("vb", [s3 + 0.3, s3 + 0.9]); sfx(s3 + 0.3, "pencil", 0.6)
    ann("lb", p, [V([4, 4])[0] + 0.8, V([4, 4])[1] - 2.6], 2.2, s="b = (1, 2)", font="vec", align="left", t0=s3 + 0.9, w=[s3 + 0.9, s3 + 1.6])
    at("vs", [s3 + 1.8, s3 + 2.5]); sfx(s3 + 1.8, "marker", 0.7)
    ann("ls", p, [V([2, 2])[0] - 1.6, V([2, 2])[1] + 1.4], 2.2, s="(4, 4)", align="right", col="red", t0=s3 + 2.5, w=[s3 + 2.5, s3 + 3.0])
    S2 = [26.0, 9.0]
    at("v2a", [s3 + 3.4, s3 + 4.0, s3 + 5.0]); sfx(s3 + 3.4, "pencil", 0.6); sfx(s3 + 4.1, "stretch", 0.9)
    ann("l2a", p, [V([6, 4], S2)[0], V([6, 4], S2)[1] + 1.8], 2.2, s="2a = (6, 4)", font="vec", align="right", t0=s3 + 5.0, w=[s3 + 5.0, s3 + 5.8])
    DATA["d1e"] = dict(S=S, S2=S2, st=st, walk=walk, page=p, tre=V([4, 4]))


def gd_fit():
    """外卖示意数据（固定种子）与梯度下降路径；终点 = 最小二乘解析解。"""
    for seed in range(100, 400):
        r = np.random.default_rng(seed)
        km = r.uniform(0.3, 5.8, 100)
        mn = np.clip(6 + 6.9 * km + r.normal(0, 3.4, 100), 2, 49)
        b_, a_ = np.polyfit(km, mn, 1)
        if round(a_ + b_ * 3.2) == 28 and abs(b_ - 6.9) < 0.15 and abs(a_ - 6) < 0.6: break
    xc = km - km.mean()
    p = np.array([0.0, mn.mean()])  # 在居中坐标里走：[斜率, 截距]
    path, sse = [], []
    for i in range(48):
        res = (p[0] * xc + p[1]) - mn
        path.append([p[0], p[1] - p[0] * km.mean()]); sse.append(float((res ** 2).sum()))
        g = np.array([2 * (res * xc).mean(), 2 * res.mean()])
        p = p - np.array([0.06 / max(1e-9, (xc ** 2).mean()), 0.06]) * g
    path.append([b_, a_]); sse.append(float(((b_ * km + a_ - mn) ** 2).sum()))
    assert all(x >= y - 1e-6 for x, y in zip(sse, sse[1:])), "总面积不单调下降"
    assert abs(path[-2][0] - b_) < 1e-3 * 50 and round(a_ + b_ * 3.2) == 28
    return seed, km, mn, path, sse, b_, a_


def seg1f():
    s = tl.start("1f")
    tl.cam(s, 1.6, **C_1F)
    p, o, sx, sy = "p5", [7.0, -26.5], 5.5, 0.45  # 1 公里 = 5.5 格，1 分钟 = 0.45 格
    seed, km, mn, path, sse, b_, a_ = gd_fit()
    s1 = tl.say("f1", pre=1.6, hold=2.4)
    at("axes1f", [s1 + 0.2, s1 + 1.2]); sfx(s1 + 0.2, "pencil", 1.0)
    for k in range(1, 7): ann(f"fx{k}", p, [o[0] + sx * k, o[1] - 1.6], 1.7, s=str(k), t0=s1 + 0.8)
    for k in range(1, 6): ann(f"fy{k}", p, [o[0] - 1.0, o[1] + sy * 10 * k], 1.7, s=str(10 * k), align="right", t0=s1 + 0.8)
    ann("fxn", p, [44.5, o[1] + 2.0], 2.0, key="p.dist", align="right", t0=s1 + 1.0, w=[s1 + 1.0, s1 + 1.8])
    ann("fyn", p, [o[0] + 1.2, -2.2], 2.0, key="p.time", align="left", t0=s1 + 1.0, w=[s1 + 1.0, s1 + 1.8])
    ann("demo", p, [46.0, -2.2], 1.6, key="p.demo", align="right", t0=s1 + 1.2)
    at("bag", [s1 + 1.2, s1 + 1.8]); sfx(s1 + 1.2, "pencil", 0.6)
    at("pts", [s1 + 2.0, 0.45])  # 4 批，每批 25 个点，间隔 0.45s
    for i in range(4): sfx(s1 + 2.0 + 0.45 * i, "rain", 0.4)
    s2 = tl.say("f2", hold=5.6)
    at("fit", [s2 + 0.3, s2 + 0.8, s2 + 6.2])  # 直线出现、方块出现、走完下降
    ann("arealbl", p, [o[0] + 1.5, 2.2], 2.0, key="p.area", align="left", t0=s2 + 0.8, w=[s2 + 0.8, s2 + 1.3])
    for i in range(len(path) - 1): sfx(s2 + 0.8 + (s2 + 6.2 - s2 - 0.8) * i / (len(path) - 1), "tick", 1200 + 25 * i)
    s3 = tl.say("f3", hold=3.2)
    f = ann("fml", p, [27.0, 2.2], 2.4, s=f"ŷ = {b_:.1f}x + {a_:.1f}", font="print", align="left", t0=s3 + 0.3, w=[s3 + 0.3, s3 + 1.5])
    at("pred", [s3 + 1.8, s3 + 2.6]); sfx(s3 + 1.8, "pencil", 0.8)
    yp = a_ + b_ * 3.2
    ann("pred", p, [o[0] + sx * 3.2 + 1.4, o[1] + sy * yp - 2.6], 2.0, key="p.pred", align="left", t0=s3 + 2.6, w=[s3 + 2.6, s3 + 3.8])
    s4 = tl.say("f4", hold=2.4)
    at("cloud", [s4 + 0.3, s4 + 1.3]); sfx(s4 + 0.3, "marker", 1.0)
    at("toNums", [s4 + 1.5, s4 + 2.2]); sfx(s4 + 1.5, "marker", 0.7)
    tl.say("n.f4", pre=0.1, st="note", hold=0.4)
    DATA["d1f"] = dict(o=o, sx=sx, sy=sy, km=km.round(3).tolist(), mn=mn.round(3).tolist(), path=np.round(path, 5).tolist(),
                       sse=np.round(sse, 2).tolist(), b=round(b_, 4), a=round(a_, 4), seed=seed, page=p, fml=f["id"])


def seg1post():
    """喘息：拉远看整本，往回翻一页、再翻回来，只留直的东西发亮，最后都叠到左页上。"""
    s = tl.start("1p")
    tl.cam(s, 2.4, ease="sine", **C_WIDE)
    track("dim", 0.0, (s + 0.6, s + 2.0, 1.0))
    flip(2, s + 2.4, back=True)
    track("pop1d", 0.0, (s + 3.6, s + 5.0, 1.0, "sine"), (s + 7.0, s + 8.2, 0.0, "sine"))
    sfx(s + 3.6, "rise", 1.4)
    flip(2, s + 8.6)
    s1 = tl.say("l1", pre=4.4, hold=3.0)
    at("stack", [s + 9.8, 0.7])  # 直线逐个叠到左页：1c 两线、1d 平面、1e 箭头、1f 回归线
    for i in range(5): sfx(s + 9.8 + 0.7 * i, "chime", 660 * 2 ** (i / 5))
    s2 = tl.say("l2", pre=0.6, hold=1.6, st="title", xy=(1400, 540))  # 名字写在右页，左页叠着发亮的直线
    track("dim", 0.0, (tl.t + 0.2, tl.t + 1.4, 0.0))
    tl.t += 1.4
    DATA["d1p"] = dict(page="p4", box=[-42.0, -20.0, -6.0, 20.0])
    assert s1 and s2


def run():
    seg1d()
    seg1e()
    seg1f()
    seg1post()
