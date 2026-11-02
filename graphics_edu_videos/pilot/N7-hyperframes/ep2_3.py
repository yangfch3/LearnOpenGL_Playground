"""下集 3 滤镜：3a 图景、3b 造。左页 e0：色卡（上）、手机（下，横放）；右页 e1：问句（左上）、便签（右上）、
颜色立方体（右）、算式与矩阵（左列）、图例与偏差读数（右列）。坐标见 core.py 文首。"""
import base64

import numpy as np

from core import DATA, TX, at, ann, end_at, get, track, sfx, tl, read_need

C_FLAT = dict(c=[0.0, 0.0], hh=33.0, k=0.0, yaw=0.0, pitch=0.0)
C_3D = dict(c=[2.0, -0.8], hh=28.5, pitch=32.0, yaw=0.0, k=1 / 110)
PHONE = dict(c=[-20.0, -2.8], w=27.2, h=13.6, sw=24.0, sh=12.0, rot=-3.0, th=0.6)
CARD = dict(c=[-20.0, 15.6], cell=3.0, gap=0.5, pad=1.0, z=0.12)
CUBE = dict(o=[21.0, -14.5], e=15.0)  # 往前放：立起后顶面的远棱低于便签
NOTE = dict(c=[38.3, 22.6], w=18.4, h=15.4, rot=2.0, size=2.0, dy=2.5)
PW_, PH_, STEP = 224, 112, 4
# ColorChecker Classic 24 色块的厂商 sRGB 参考值（2014 年前配方；Wikipedia「ColorChecker」词条，引 X-Rite）
REF = ["735244", "c29682", "627a9d", "576c43", "8580b1", "67bdaa", "d67e2c", "505ba6", "c15a63", "5e3c6c", "9dbc40", "e0a32e",
       "383d96", "469449", "af363c", "e7c71f", "bb5695", "0885a1", "f3f3f3", "c8c8c8", "a0a0a0", "7a7a7a", "555555", "343434"]
REF = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in REF], float)
DEV = np.array([[0.70, 0.24, 0.06], [0.13, 0.72, 0.15], [0.04, 0.26, 0.64]])  # 示意：通道串色（发灰）+ 偏黄


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def hue(c):
    r, g, b = np.array(c, float) / 255
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 1e-6: return 0.0
    h = (g - b) / (mx - mn) % 6 if mx == r else (b - r) / (mx - mn) + 2 if mx == g else (r - g) / (mx - mn) + 4
    return 60 * h


def make_photo():
    """程序生成的风景：天空、太阳、两层远山、草地、星星点点的红花。"""
    r = np.random.default_rng(31)
    yy, xx = np.mgrid[0:PH_, 0:PW_].astype(float)
    hz = 58.0
    k = np.clip(yy / hz, 0, 1)[..., None] ** 1.3
    img = (1 - k) * np.array([34, 96, 214]) + k * np.array([250, 196, 132])
    d2 = (xx - 166) ** 2 + (yy - 32) ** 2
    img = img + np.exp(-d2 / (2 * 16.0 ** 2))[..., None] * np.array([40, 32, 10])
    img = np.where((d2 < 8.5 ** 2)[..., None], np.array([255, 242, 206]), img)
    m1 = 43 + 5 * np.sin(xx / 14 + 1) + 3 * np.sin(xx / 6.3 + 0.4)
    m2 = 51 + 4 * np.sin(xx / 10 + 2.5) + 2 * np.sin(xx / 4.1)
    img = np.where(((yy > m1) & (yy < hz))[..., None], np.array([150, 112, 196]), img)
    img = np.where(((yy > m2) & (yy < hz))[..., None], np.array([92, 70, 150]), img)
    g = np.clip((yy - hz) / (PH_ - hz), 0, 1)[..., None]
    grass = (1 - g) * np.array([188, 214, 70]) + g * np.array([38, 122, 40])
    grass = grass + (6 * np.sin(xx * 0.9 + yy * 0.3) * np.sin(yy * 1.7))[..., None] * np.array([1, 1.2, 0.5])
    img = np.where((yy >= hz)[..., None], grass, img)
    for _ in range(110):  # 红花：越近越大
        cy = r.uniform(hz + 4, PH_ - 2); s = (cy - hz) / (PH_ - hz); cx = r.uniform(2, PW_ - 2); rad = 0.9 + 2.6 * s
        m = (xx - cx) ** 2 + (yy - cy) ** 2 < rad ** 2
        base = [208, 46, 38] if r.uniform() < 0.72 else [242, 200, 44]  # 红花为主，夹几朵黄花
        img = np.where(m[..., None], np.array(base) + r.normal(0, 6, 3), img)
    img = img + r.normal(0, 2.0, img.shape)
    return np.clip(np.round(img), 0, 255).astype(np.uint8)


def ccm_fit():
    """拍出 = 真实 × 偏差矩阵 + 小噪声；最小二乘解回校正矩阵（拍出 → 真实）。"""
    r = np.random.default_rng(24)
    cap = REF @ DEV.T + r.normal(0, 0.5, REF.shape)
    assert cap.min() >= 0 and cap.max() <= 255, "拍出的颜色越界"
    X, *_ = np.linalg.lstsq(cap, REF, rcond=None)
    M = X.T
    assert np.abs(M - np.linalg.inv(DEV)).max() < 0.02, ("解回的校正矩阵与偏差矩阵之逆误差过大", np.abs(M - np.linalg.inv(DEV)).max())
    I = np.eye(3)
    rms = [float(np.sqrt(((cap @ (I + u * (M - I)).T - REF) ** 2).sum(1).mean())) for u in np.linspace(0, 1, 41)]  # 与 filter.js dev 同式
    assert all(a >= b - 1e-9 for a, b in zip(rms, rms[1:])), "偏差没有单调变小"
    return cap, M, rms


def photo_data():
    P = make_photo()
    nx, ny = PW_ // STEP, PH_ // STEP
    samp = [P[(k // nx) * STEP + STEP // 2, (k % nx) * STEP + STEP // 2].astype(float) for k in range(nx * ny)]
    reds = [k for k, c in enumerate(samp) if c[0] > 180 and c[1] < 90 and (k // nx) > ny * 0.55]
    tapK = min(reds, key=lambda k: abs(k % nx - nx * 0.45) + abs(k // nx - ny * 0.72))
    Yp = luma(samp[tapK])
    gk = [k for k, c in enumerate(samp) if c[1] > max(c[0], c[2]) + 20 and abs(luma(c) - Yp) < 1 and abs((hue(c) - hue(samp[tapK]) + 180) % 360 - 180) > 90]
    assert gk, "找不到与红花同灰度的草"
    r = np.random.default_rng(56)
    fdt = [round(2.6 * (k % nx) / (nx - 1) + r.uniform(0, 0.6), 3) for k in range(nx * ny)]
    fh = [round(r.uniform(3.0, 7.0), 2) for _ in range(nx * ny)]
    return P, dict(photo=base64.b64encode(P.tobytes()).decode(), pw=PW_, ph=PH_, step=STEP, nx=nx, ny=ny, fdt=fdt, fh=fh, fly=1.1,
                   tapK=tapK, tap=[int(v) for v in samp[tapK]], grayK=gk[0])


def note_ticks(i, t):
    """便签：红笔勾掉第 i 项（0 起），下一项成为当前。"""
    DATA.setdefault("noteTick", []).append([i, round(t, 3), round(t + 0.45, 3)])
    sfx(t + 0.25, "marker", 0.45)


def seg3a():
    s = tl.start("3a")
    tl.say("T.f", pre=0.4, st="title")
    # 便签贴到右页右上角，五步逐个写上
    t = tl.t + 0.15
    at("note", [t, t + 0.3]); sfx(t, "slap")
    n = NOTE
    ann("note", "e1", n["c"], 1, kind="box", t0=t, box=[n["c"][0] - n["w"] / 2 - 0.4, n["c"][1] - n["h"] / 2 - 0.4, n["c"][0] + n["w"] / 2 + 0.4, n["c"][1] + n["h"] / 2 + 0.4])
    at("noteW", [t + 0.45, 0.6, 0.5])  # 五个问题逐行写出：起点、行间隔、每行书写时长
    for i in range(5): sfx(t + 0.45 + 0.6 * i, "pencil", 0.5)
    tl.t = t + 0.45 + 3.0 + 1.0
    # 问句写在新一页的页眉：它就是这一页要回答的问题，不另出字幕
    h0 = tl.t
    ann("fq", "e1", [2.0, 27.4], 2.0, key="p.fq", align="left", t0=h0, w=[h0, h0 + 1.6])
    tl.t = h0 + 1.6 + read_need(TX["p.fq"]) - 0.6
    s1 = tl.say("fa1", hold=4.2)
    tl.cam(s1, 2.4, ease="io3", **C_3D)
    at("foot", [s1 + 0.2, s1 + 0.9]); sfx(s1 + 0.2, "pencil", 0.7)  # 立方体的底先用铅笔画在纸上
    track("cube", 0.0, (s1 + 1.0, s1 + 2.4, 1.0, "o3")); sfx(s1 + 1.0, "rise", 1.4)
    at("cubeLbl", s1 + 2.4)
    o, e = CUBE["o"], CUBE["e"]
    ann("cs", "e1", [o[0] + e + 3.6, o[1] + 1.2], 1.8, key="p.cspace", align="left", t0=s1 + 2.5, w=[s1 + 2.5, s1 + 3.1])
    tap = s1 + 3.2
    at("tap", [tap, tap + 0.6]); sfx(tap, "tick", 2600)
    c = DATA["f3"]["tap"]
    rd = [("rdR", "p.R", -27.4), ("rdG", "p.G", -20.4), ("rdB", "p.B", -13.4)]  # 点开的像素：它的三个数写在手机上方
    for i, (id_, k, x) in enumerate(rd):
        ann(id_, "e0", [x, 6.9], 2.0, s=f"{TX[k]} {c[i]}", align="left", t0=tap + 0.3 + 0.2 * i, w=[tap + 0.3 + 0.2 * i, tap + 0.6 + 0.2 * i])
    at("swatch", tap + 0.3)
    f1 = tap + 1.2
    at("fly1", [f1, f1 + 1.1]); sfx(f1, "whoosh", 1.1)
    at("drop", [f1 + 1.15, f1 + 1.75]); sfx(f1 + 1.15, "pencil", 0.6)
    at("axn", [f1 + 1.8, 0.5])  # 三条棱上的读数依次出现，与纸上那三个数同时亮一下
    for i in range(3): sfx(f1 + 1.8 + 0.5 * i, "mallet", [523, 659, 784][i])
    s2 = tl.say("fa2", hold=3.0)
    at("axnOut", s2 + 0.1)
    at("pour", [s2 + 0.3, s2 + 0.3 + 3.2 + 1.1]); sfx(s2 + 0.3, "sand", 4.2)
    tl.cam(s2 + 0.3, 5.0, ease="sine", yaw=-7.0)  # 轻摇：看出点云是立体的
    return rd


def seg3b(rd):
    s = tl.start("3b")
    note_ticks(0, s + 0.3)
    s1 = tl.say("fa3", pre=1.0, hold=0.6)
    for id_, *_ in rd: end_at(get(id_), s1 + 0.3)
    track("cloudA", 1.0, (s1, s1 + 0.8, 0.06))
    track("card", [-92.0, CARD["c"][1]], (s1 + 0.2, s1 + 1.2, CARD["c"], "o3")); sfx(s1 + 0.2, "slide", 1.0)
    p, q = PHONE["c"], CARD["c"]
    track("phone", [p[0], p[1], 0.0], (s1 + 1.4, s1 + 2.4, [q[0], q[1], 7.0]), (s1 + 3.1, s1 + 4.1, [p[0], p[1], 0.0]))
    sfx(s1 + 1.4, "whoosh", 1.0); sfx(s1 + 3.1, "whoosh", 1.0); sfx(s1 + 4.1, "tick", 900)
    at("camMode", [s1 + 1.4, s1 + 2.7])  # 取景 → 快门
    sfx(s1 + 2.7, "shutter")
    s2 = tl.say("fa4", pre=0.3, hold=0.6)
    at("pairs", [s2 + 0.5, 0.12])
    for i in range(24): sfx(s2 + 0.5 + 0.12 * i, "mallet", 392 * 2 ** (i / 24))
    # 图例写在它所指的东西旁边：● 真实 = 色卡，○ 拍出 = 手机屏幕
    L = DATA["f3"]["legend"]
    for id_, k, p in (("lgT", "p.true", L[0]), ("lgS", "p.shot", L[1])):
        ann(id_, "e0", [p[0] + 1.0, p[1]], 1.8, key=k, align="left", t0=s2 + 0.5, w=[s2 + 0.5, s2 + 0.9])
    ann("demo3", "e0", [L[1][0] - 0.5, L[1][1] - 3.0], 1.5, key="p.demo", align="left", t0=s2 + 0.9)
    at("devShow", s2 + 0.5 + 24 * 0.12 + 0.2)
    # 无字幕：纸上自己往下算（方程个数已随色块从 3 数到 72）
    t = tl.t + 0.6
    m = DATA["f3"]["mx"]
    ann("mx", "e1", m["c"], 1, kind="box", t0=t, box=m["box"])
    at("mxW", [t, t + 1.4]); sfx(t, "pencil", 1.4)
    ann("unk", "e1", [2.0, 18.0], 2.0, key="p.unk", align="left", t0=t + 1.5, w=[t + 1.5, t + 2.3])
    t += 2.3 + read_need(TX["p.unk"])
    ann("lsq", "e1", [2.0, 13.6], 2.2, s="↓ " + TX["p.lsq"], col="red", align="left", t0=t, w=[t, t + 0.9])
    t += 1.6
    track("solve", 0.0, (t, t + 4.5, 1.0)); sfx(t, "descend", 4.5)
    tl.t = t + 4.7
    s3 = tl.say("fa5", hold=2.0)
    ann("ccm", "e1", [m["c"][0], m["box"][1] - 2.0], 2.2, key="p.ccm", col="red", hl=True, t0=s3 + 0.4, w=[s3 + 0.4, s3 + 1.3])
    tl.t += 1.2


def run():
    P, ph = photo_data()
    cap, M, rms = ccm_fit()
    o, size = [10.0, 5.0], 1.8
    numW = 5 * 0.56 * size  # 「−0.21」：与 world.js textW 同式
    mx = dict(c=o, size=size, dx=numW + 0.6, dy=2.5, numW=round(numW, 3))
    hw, hh = mx["dx"] + numW / 2 + 0.5 + size * 0.3, mx["dy"] + size * 0.7
    mx["box"] = [round(o[0] - hw, 3), round(o[1] - hh, 3), round(o[0] + hw, 3), round(o[1] + hh, 3)]
    assert mx["box"][0] > 0.5 and mx["box"][2] < CUBE["o"][0] - 1, ("矩阵挤到立方体", mx["box"])
    DATA["f3"] = dict(ph, phone=PHONE, card=CARD, cube=CUBE, note=dict(NOTE, items=[f"k.s{i}" for i in range(1, 6)]), ref=REF.tolist(),
                      cap=np.round(cap, 3).tolist(), ccm=np.round(M, 5).tolist(), rms=[round(rms[0], 2), round(rms[-1], 2)], mx=mx,
                      eqc=dict(p=[2.0, 22.4], size=2.2), devL=dict(p=[2.0, -6.6], size=2.0), legend=[[-7.4, 18.0], [-5.0, -1.2]], swatch=[-29.6, 6.9])
    from ep1_1 import tw
    for i in range(1, 6):  # 便签上的字不出纸：左边留 3.2 给勾与箭头，右边留 0.6；五行不出下沿
        assert 3.2 + tw(TX[f"k.s{i}"], NOTE["size"]) + 0.6 <= NOTE["w"], ("便签字出纸", i)
    assert NOTE["h"] / 2 - 3.6 - 4 * NOTE["dy"] - NOTE["size"] * 0.6 >= -NOTE["h"] / 2 + 0.4, "便签五行出下沿"
    rd = seg3a()
    seg3b(rd)
    import ep2_3c
    ep2_3c.run(P)
    print("3 滤镜：偏差 %.1f → %.1f，tapK %d %s，同灰草 %d" % (rms[0], rms[-1], ph["tapK"], ph["tap"], ph["grayK"]))
