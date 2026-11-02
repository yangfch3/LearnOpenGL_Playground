"""下集 3 滤镜：3c 用、3d 规模、3e 面纱。
时间线以画面动作为主轴：动作按拍排，字幕用 say(t0=…) 挂到动作上，阅读时长由 build 断言。
机位只有两个：工作机位（手机、立方体、矩阵占满画面）与便签机位（换步时看一眼便签，勾掉上一问）。"""
import numpy as np

from core import B, BEAT, DATA, TX, ann, at, end_at, get, read_need, sfx, tl, track
from ep2_3 import CARD, hue, luma, note_ticks

C_WORK = dict(c=[10.0, -8.0], hh=18.0, k=1 / 110, yaw=0.0, pitch=26.0)
C_NOTE = dict(c=[37.5, 23.0], hh=11.0, k=1 / 110, yaw=0.0, pitch=26.0)
P2 = [-6.0, -6.0]  # 手机挪到书脊上，与立方体同框
I3 = np.eye(3)
WARM = np.array([[0.90, 0.10, 0.00], [0.02, 0.90, 0.00], [0.00, 0.05, 0.62]])  # 蓝减得多、红几乎不减：白变成暖黄
GRAY = np.array([[0.299, 0.587, 0.114]] * 3)
FM = dict(c=[10.2, 6.4], size=1.8, dy=2.5)
FM["numW"] = round(5 * 0.56 * FM["size"], 3)  # 「−0.12」：与 world.js textW 同式
FM["dx"] = round(FM["numW"] + 0.6, 3)
_hw, _hh = FM["dx"] + FM["numW"] / 2 + 0.5 + FM["size"] * 0.3, FM["dy"] + FM["size"] * 0.7
FM["box"] = [round(FM["c"][0] - _hw, 3), round(FM["c"][1] - _hh, 3), round(FM["c"][0] + _hw, 3), round(FM["c"][1] + _hh, 3)]
HDR, DET, CNT = [10.2, 12.2], [9.0, 0.9], [-19.0, 3.8]
TAPS, HL, FMS = [], [], []  # 点按 [时刻, 按钮, 是否生效]；高亮像素 [起, 止, [k…]]；纸上矩阵 [写起, 写止, 9 个数]


def fmt2(v):
    v = 0.0 if abs(v) < 0.005 else v
    return ("−" if v < 0 else "") + f"{abs(v):.2f}"


def write_fm(t, M):
    FMS.append([round(t, 3), round(t + 1.2, 3), [[fmt2(v) for v in r] for r in M]])
    sfx(t, "pencil", 1.2)


def tap(t, btn, ok=1):
    TAPS.append([round(t, 3), btn, ok])
    if ok: sfx(t, "tick", 2600)
    else: sfx(t, "tick", 900); sfx(t + 0.18, "tick", 750)  # 按了没反应：两声闷的


def glance(i, t):
    """换步：镜头去看一眼便签，红笔勾掉第 i 项、箭头移到下一项，读完回到工作机位。返回回到工作机位的时刻。"""
    t1 = tl.cam(t, 1.8, ease="sine", **C_NOTE)
    note_ticks(i, t1 + 0.05)
    return tl.cam(t1 + 0.5 + read_need(TX[f"k.s{i + 2}"]), 1.6, ease="sine", **C_WORK)


def seg3c(F):
    s = tl.start("3c")
    clr = s + 0.3  # 3b 的推导用完即退：色卡滑走，纸上的算式淡去
    at("clr", clr)
    for id_ in ("mx", "unk", "lsq", "ccm", "lgT", "lgS", "demo3", "cs", "fq"): end_at(get(id_), clr + 0.6)  # 页眉问句已交给便签
    track("card", None, (clr, clr + 1.1, [-92.0, CARD["c"][1]], "i2")); sfx(clr, "slide", 1.1)
    back = glance(1, s + 0.2)
    track("phone", None, (back - 1.1, back + 0.1, [P2[0], P2[1], 0.0])); sfx(back - 1.1, "slide", 1.2)
    at("photoBack", back - 1.1)  # 屏幕从拍下的色卡换回照片
    track("cloudA", None, (back - 1.2, back - 0.2, 1.0))
    at("tbar", back + 0.1)
    tw = back + 0.8
    tap(tw, 0)
    tl.say("fc1", t0=tw + 0.15)
    ann("hW", "e1", HDR, 2.0, key="p.warm", t0=tw + 0.3, w=[tw + 0.3, tw + 0.7])
    ann("fm", "e1", FM["c"], 1, kind="box", t0=tw + 0.5, box=FM["box"])
    write_fm(tw + 0.5, WARM)
    m0 = tw + 1.9
    track("filt", I3.tolist(), (m0, m0 + 2.6, WARM.tolist())); sfx(m0, "swell", 2.6)
    HL.append([round(m0 - 0.5, 3), round(m0 + 3.6, 3), [TK]])
    c2 = tl.say("fc2", t0=max(B["fc1_e"] + 0.15, m0 + 2.7))
    tl.t = B["fc2_e"] + 0.3


def seg3d():
    s = tl.start("3d")
    back = glance(2, s + 0.2)
    sc0, d = back + 0.3, 3.6
    track("scan", 0.0, (sc0, sc0 + 1.2 * d, 1.2, "lin")); at("scan", [sc0, sc0 + d]); sfx(sc0, "sand", d)  # 多走 0.2：最后几行也来得及「亮一下」再落定
    tl.say("fd1", t0=sc0 + 0.3)
    sh = max(B["fd1_e"], sc0 + d) + 0.5
    at("shut2", sh); sfx(sh, "shutter")
    tl.say("n.fd2", t0=sh + 0.3, st="note")
    at("cnt", [sc0, B["n.fd2_e"] + 0.6])
    tl.t = B["n.fd2_e"] + 0.3


def seg3e(F):
    s = tl.start("3e")
    back = glance(3, s + 0.2)
    u0 = back + 0.5
    tap(u0, 2)
    tl.say("fe1", t0=u0 + 0.2)
    end_at(get("hW"), u0 + 0.3)
    ann("hInv", "e1", HDR, 2.0, key="p.inv", col="red", hl=True, t0=u0 + 0.4, w=[u0 + 0.4, u0 + 1.0])
    write_fm(u0 + 0.4, np.linalg.inv(WARM))
    track("filt", None, (u0 + 1.8, u0 + 3.8, I3.tolist())); sfx(u0 + 1.8, "gather", 2.0)
    h2 = max(B["fe1_e"], u0 + 3.8) + 0.3  # 一朵红花、一片绿草：两个像素同时点亮
    HL.append([round(h2, 3), None, [TK, GK]]); sfx(h2, "tick", 1800); sfx(h2 + 0.3, "tick", 1500)
    g0 = h2 + 1.6
    tap(g0, 1)
    end_at(get("hInv"), g0 + 0.3)
    ann("hG", "e1", HDR, 2.0, key="p.bw", t0=g0 + 0.4, w=[g0 + 0.4, g0 + 0.8])
    write_fm(g0 + 0.4, GRAY)
    q0, q1 = g0 + 1.0, g0 + 3.4
    track("filt", None, (q0, q1, GRAY.tolist())); sfx(q0, "fold", q1 - q0); sfx(q1, "thump"); at("quiet", [q1, q1 + BEAT])
    tl.say("fe2", t0=g0 + 0.15, act=[q0, q1])
    u1 = max(B["fe2_e"], q1 + 0.3 + read_need(TX["p.gray1"])) + 0.3
    at("same", [q1 + 0.3, u1 + 1.3])
    tap(u1, 2, ok=0)
    ann("det0", "e1", DET, 2.0, s=TX["p.det"] + " = 0", col="red", align="left", t0=u1 + 0.6, w=[u1 + 0.6, u1 + 1.4])
    e3 = tl.say("fe3", t0=u1 + 1.5 + read_need(TX["p.rg"]) + 0.2)
    tl.say("n.fe3", t0=B["fe3_e"] + 0.15, st="note")
    end = B["n.fe3_e"] + 0.8
    at("rg", [u1 + 1.5, end])
    HL[-1][1] = round(end, 3)
    tl.t = end
    return e3


def pick_grass(P, a, tx):
    """与红花同灰度的一片草（原图像素）：离画面边与红花都远，两个圈分得开。返回 [px, py]。"""
    H, Wd, _ = P.shape
    best = None
    for py in range(int(H * 0.55), int(H * 0.94)):
        for px in range(int(Wd * 0.15), int(Wd * 0.85)):
            c = P[py, px].astype(float)
            if abs(px - tx) < 24 or not (c[1] > max(c[0], c[2]) + 20 and abs(luma(c) - luma(a)) < 1 and abs((hue(c) - hue(a) + 180) % 360 - 180) > 90): continue
            d = abs(px - 0.72 * Wd) + abs(py - 0.66 * H)
            if best is None or d < best[0]: best = (d, [px, py])
    assert best, "找不到合适的同灰度草"
    return best[1]


def run(P):
    global GK, TK
    F = DATA["f3"]
    tk = F["tapK"]
    TK = [(tk % F["nx"]) * F["step"] + F["step"] // 2, (tk // F["nx"]) * F["step"] + F["step"] // 2]  # 点开过的红花，换成原图像素坐标
    a = P[TK[1], TK[0]].astype(float)
    GK = pick_grass(P, a, TK[0])
    g = P[GK[1], GK[0]].astype(float)
    assert np.linalg.det(WARM) > 0.5, "暖色滤镜行列式应 > 0.5"
    assert (WARM >= 0).all() and (WARM.sum(1) <= 1 + 1e-9).all(), "暖色滤镜应把颜色立方体映进自身（不出界）"
    assert abs(np.linalg.det(GRAY)) < 1e-12, "黑白矩阵行列式应为 0"
    assert abs(luma(a) - luma(g)) < 1 and abs((hue(a) - hue(g) + 180) % 360 - 180) > 90, "红花与绿草应同灰度、色相差 > 90°"
    assert np.allclose(GRAY @ a, GRAY @ g, atol=1.0), "两像素黑白后应同一种灰"
    seg3c(F)
    seg3d()
    seg3e(F)
    assert all(b[0] <= b[1] for b in HL)
    DATA["f3c"] = dict(p2=P2, taps=TAPS, hl=HL, fm=dict(FM, states=FMS), cnt=dict(p=CNT, size=2.0), wan=TX["p.wan"])
    print("3c–3e：暖色 det %.3f，红花 %s 绿草 %s 灰 %.1f/%.1f" % (np.linalg.det(WARM), a.astype(int), g.astype(int), luma(a), luma(g)))
