"""上集 2a–2e：草稿纸摊开，左页 p6 = 1c 缩小图 + 笼子小窗，右页 p7 = 「头–脚」坐标纸 + 矩阵。"""
import numpy as np

from core import B, DATA, BEAT, at, ann, ring, end_at, get, animal, hop_to, mat, morph, track, flip, sfx, tl, on_beat
from ep1_1 import ring_on

C_SPREAD = dict(c=[0.0, 3.0], hh=28.5)
L2 = dict(
    gr=dict(o=[5.0, -7.0], sx=1.0, sy=0.25, hmax=40, fmax=100, step=5),  # 横轴 1 格 = 1 头，纵轴 1 格 = 4 脚
    gl=dict(o=[-44.0, -4.0], s=0.5, n=40),  # 1c 缩小图：1 格 = 2 只
    vg=dict(box=[-18.5, -6.0, -1.5, 27.5], cage=[-17.0, 8.0, -3.0, 20.0], hinge=[-3.0, 14.5], ko=[-17.0, -3.5], ks=[5.0, 1.25], sc=1.6),
    mat=[16.0, 24.0], matc=dict(dx=3.6, dy=3.0, size=2.8), vec1=[23.4, 24.0], eqs=[28.0, 24.0], vec2=[32.8, 24.0],
    area=[24.0, 25.3], areaSize=2.4, eqx=-44.0,
)
GR, GL, VG = L2["gr"], L2["gl"], L2["vg"]
grW = lambda h, f: [GR["o"][0] + h * GR["sx"], GR["o"][1] + f * GR["sy"]]  # noqa: E731
glW = lambda x, y: [GL["o"][0] + x * GL["s"], GL["o"][1] + y * GL["s"]]  # noqa: E731
mcell = lambda i, j: [L2["mat"][0] + (j - 0.5) * L2["matc"]["dx"], L2["mat"][1] - (i - 0.5) * L2["matc"]["dy"]]  # noqa: E731
A = np.array([[1, 1], [2, 4]]); S = np.array([[1, 0], [-2, 1]]); Bd = np.array([[1, 1], [2, 2]]); X = np.array([23, 12])
assert (A @ X == [35, 94]).all() and (23 * A[:, 0] + 12 * A[:, 1] == [35, 94]).all()
assert (S @ A == [[1, 1], [0, 2]]).all() and (S @ [35, 94] == [35, 24]).all()
assert round(np.linalg.det(A)) == 2 and round(np.linalg.det(Bd)) == 0 and (Bd @ X == [35, 70]).all()
assert (A @ [10, 5] == [15, 40]).all()
assert all((Bd @ [k, 35 - k] == [35, 70]).all() for k in range(36)) and all(2 * k + 2 * (35 - k) != 94 for k in range(36))


def axes2():
    ox, oy = GR["o"]
    ann("head", "p7", [ox + 41.6, oy + 2.4], 2.4, key="p.head")
    ann("foot", "p7", [ox, oy + 27.9], 2.4, key="p.foot")
    for k in range(1, 5): ann(f"th{k}", "p7", [ox + 10 * k, oy - 2.0], 2.0, s=str(10 * k))
    for k in range(1, 6): ann(f"tf{k}", "p7", [ox - 1.0, oy + 5 * k], 2.0, s=str(20 * k), align="right")
    gx, gy = GL["o"]
    ann("gx", "p6", [gx + 21.4, gy], 2.2, key="p.xc", align="left")
    for k in range(1, 5):
        ann(f"gtx{k}", "p6", [gx + 5 * k, gy - 1.9], 1.9, s=str(10 * k))
        ann(f"gty{k}", "p6", [gx - 1.0, gy + 5 * k], 1.9, s=str(10 * k), align="right")
    ann("eq1", "p6", [L2["eqx"], 27.0], 2.4, key="p.eq1", align="left")
    ann("gn1", "p6", [glW(6, 29)[0] + 1.2, glW(6, 29)[1] + 1.2], 2.0, key="p.n1")
    yr = ann("yAx0", "p6", [gx, gy + 22.6], 2.2, key="p.yr")
    e2 = ann("eq2a", "p6", [L2["eqx"], 23.6], 2.4, key="p.eq2a", align="left")
    return yr, e2


def seg2a():
    s = tl.start("2a")
    flip(3, s + 0.1)
    tl.cam(s + 0.1, 1.4, **C_SPREAD)
    DATA["L2"] = L2
    yr, e2 = axes2()
    mat("M", A)  # 箭头链、图例、目标都跟着 M；右页格子 = lerp(I, M, latU)，2c 起出现
    track("latt", 0.0); track("latU", 0.0)
    an = {k: animal(k, kind, "p6", x, VG["cage"][1], sc=VG["sc"], face=f, cage=VG["cage"])
          for k, kind, x, f in (("vc", "chicken", -13.8, 1), ("vr", "rabbit", -7.5, -1), ("vd", "duck", 3.5, -1))}
    an["vd"]["show"] = [10 ** 6, None]
    tl.say("T.m", pre=0.3, st="title", xy=(960, 600))  # 小窗里笼子下方的空白处
    s1 = tl.say("m1", pre=0.2, hold=0.6)
    at("axes2", [s1 + 0.2, s1 + 1.4]); sfx(s1 + 0.2, "pencil", 1.2)
    s2 = tl.say("m2", hold=3.4)
    at("keyC", [s2 + 0.3, s2 + 0.9, s2 + 1.6]); at("keyR", [s2 + 2.2, s2 + 2.8, s2 + 3.5])  # 动物一跳 → 虚线 → 箭头长出
    for k in ("keyC", "keyR"): sfx(B[k][0], "boing"); sfx(B[k][1], "pencil", 0.6)
    s3 = tl.say("m3", hold=3.8)
    T, ts = s3 + 0.3, []
    for i in range(35):  # 逐根接上，越接越快；每接一根一声，音高随序号升
        ts.append(round(T, 3)); sfx(T, "mallet", 392 * 2 ** (i / 18)); T += max(0.07, 0.24 * 0.92 ** i)
    at("chain", ts)
    s4 = tl.say("m4", hold=3.6)
    ring("rT", "p7", grW(35, 94), 1.4, s4 + 0.2, t1=None)
    at("views", [s4 + 1.2, s4 + 4.2])
    ann("row", "p6", [-31.0, 12.0], 2.4, key="p.row", t0=s4 + 1.2, t1=s4 + 4.2, w=[s4 + 1.2, s4 + 1.8])
    ann("col", "p7", [12.0, 16.0], 2.4, key="p.col", t0=s4 + 1.6, t1=s4 + 4.2, w=[s4 + 1.6, s4 + 2.2])
    ring("rX", "p6", glW(23, 12), 1.3, s4 + 0.6, t1=s4 + 4.4)
    return yr, e2, an


def seg2b():
    s = tl.start("2b")
    end_at(get("rT"), s + 0.4)
    s1 = tl.say("n1", pre=0.2, hold=3.8)
    ann("brace2", "p6", [L2["eqx"] - 1.8, 25.3], 2.4, s="{", font="brace", t0=s1 + 0.2, w=[s1 + 0.2, s1 + 0.5], box=[-46.6, 22.0, -45.0, 28.6])
    at("ones", [s1 + 0.6, s1 + 1.0])  # x、y 前面隐含的 1 显出来
    at("pull", [s1 + 1.4, s1 + 3.4])  # 系数、未知数、右边的数各自飞到矩阵写法里
    sfx(s1 + 1.4, "whoosh", 2.0)
    at("brk", [s1 + 3.2, s1 + 3.8]); sfx(s1 + 3.2, "pencil", 0.6)
    s2 = tl.say("n2", hold=1.6)
    ann("matw", "p7", [L2["mat"][0] - 5.6, L2["mat"][1]], 3.0, key="p.matw", align="right", col="red", hl=True, t0=s2 + 0.4, w=[s2 + 0.4, s2 + 1.2])
    s3 = tl.say("n3", hold=2.6)
    at("colTint", [s3 + 0.2, s3 + 0.8]); at("colLink", [s3 + 1.0, s3 + 2.2, s3 + 4.2])
    sfx(s3 + 1.0, "marker", 1.2)


def seg2c():
    s = tl.start("2c")
    track("vecs", 1.0, (s + 0.2, s + 0.9, 0.0))  # 矩阵写法里的两列数退下，只留矩阵
    s1 = tl.say("o1", pre=0.6, hold=4.0)
    at("in1", [s1 + 0.4, s1 + 1.8]); at("in2", [s1 + 2.2, s1 + 3.6])
    for k in ("in1", "in2"): sfx(B[k][0], "whoosh", 1.4); sfx(B[k][1], "chime", 784)
    ann("in1L", "p6", [glW(10, 5)[0], glW(10, 5)[1] + 1.7], 1.9, s="(10, 5)", t0=s1 + 0.3)  # 点的正上方，让开横轴
    ann("in1R", "p7", [grW(15, 40)[0] - 1.0, grW(15, 40)[1] + 1.8], 1.9, s="(15, 40)", align="right", t0=s1 + 1.8)
    s2 = tl.say("o2", hold=3.4)
    track("latL", 0.0, (s2 + 0.2, s2 + 0.8, 1.0))
    track("latt", 0.0, (s2 + 0.6, s2 + 1.0, 1.0))
    track("latU", 0.0, (s2 + 1.0, s2 + 3.6, 1.0))
    sfx(s2 + 1.0, "grid", 2.6)
    track("cell", 0.0, (s2 + 0.8, s2 + 1.2, 1.0), (s2 + 5.4, s2 + 6.0, 0.0))
    # 变形完，格子的两条边与小窗里的鸡、兔箭头先后一起闪：对应关系
    for k, t in (("fC", s2 + 3.8), ("fR", s2 + 4.6)):
        track(k, 0.0, (t, t + 0.2, 1.0, "o2"), (t + 0.5, t + 0.8, 0.0, "sine"))
        sfx(t, "chime", 659 if k == "fC" else 784)
    s3 = tl.say("o3", hold=2.8)
    ring("rO", "p7", grW(0, 0), 1.2, s3 + 0.3, t1=s3 + 4.2)
    at("redLine", [s3 + 1.6, s3 + 2.4, s3 + 4.4]); sfx(s3 + 1.6, "marker", 0.8)
    track("latL", 0.0, (tl.t, tl.t + 0.8, 0.0))


def seg2d():
    s = tl.start("2d")
    s1 = tl.say("d1", pre=0.4, hold=2.6)
    at("rev", [s1 + 0.4, s1 + 2.0]); sfx(s1 + 0.4, "whoosh", 1.6); sfx(s1 + 2.0, "chime", 523)
    ring("rX2", "p6", glW(23, 12), 1.3, s1 + 2.0, t1=s1 + 4.6)
    s2 = tl.say("d2", pre=0.3, hold=1.6)
    sh = at("shear", [s2 + 0.5, s2 + 2.9])
    morph("M", sh[0], sh[1] - sh[0], S @ A)
    s3 = tl.say("d3", hold=1.0)
    wd = tl.t + 0.1
    ring("r0", "p7", mcell(1, 0), 1.6, s3 + 0.4, t1=wd + 1.8, on="mat")
    y = L2["gr"]["o"][1] + 11.8
    div = [ann("div", "p7", [30.0, y], 2.2, key="p.diva", align="right", t0=wd, w=[wd, wd + 1.2]),
           ann("div12", "p7", [30.8, y], 2.2, s="12", align="left", t0=wd + 1.2, w=[wd + 1.2, wd + 1.6])]
    ring_on("r12", div[1], "12", wd + 1.8, r=1.6)
    tl.t = wd + 3.2
    return sh, div


def seg2e(sh, div, yr, e2, an):
    rev = tl.start("2e")
    for a in div + [get("r12")]: end_at(a, rev + 0.05)  # 先收掉算式，纸再弹回
    morph("M", rev + 0.35, 1.0, A)
    for k in ("vc", "vr"): an[k]["lift"].append([round(sh[0], 3), round(rev + 0.35, 3)])
    sfx(sh[0] + 0.2, "puff")
    tl.wait(1.2)
    s = tl.say("e1", hold=1.0)
    at("door", [s + 0.2, s + 0.6, s + 4.4, s + 4.8])
    r_end = hop_to(an["vr"], s + 0.6, 4.5, n=4, d=0.36, h=1.0)
    an["vr"]["show"][1] = round(r_end - 0.02, 3)  # 最后一跳已在小窗外（被裁掉）
    an["vd"]["show"][0] = round(s + 2.4, 3)
    hop_to(an["vd"], s + 2.5, -7.5, n=4, d=0.36, h=1.0)
    for k in (0, 2): sfx(s + 2.5 + 0.38 * k, "squeak")
    end_at(yr, s + 4.6)
    ann("yAx1", "p6", yr["p"], 2.2, key="p.yd", t0=s + 4.6, w=[s + 4.6, s + 5.0])
    s = tl.say("e2", hold=1.4)
    at("duckKey", [s + 0.3, s + 0.6, s + 1.2]); sfx(s + 0.6, "pencil", 0.6)
    s = tl.say("e3", pre=0.2)
    m0 = s + 0.3
    m1 = on_beat(m0 + 3.0)
    morph("M", m0, m1 - m0, Bd)
    at("flat", [m0, m1]); at("quiet", [m1, m1 + BEAT]); at("areaShow", s); at("areaFinal", m1 + 0.4)
    sfx(m1, "thump")
    tl.t = max(tl.t, m1 + BEAT + 0.4)
    B["e3_e"] = tl.caps[-1]["t1"] = round(tl.t, 3)
    s = tl.say("e4", hold=2.6)
    end_at(e2, s + 0.45)
    eqb = ann("eq2b", "p6", e2["p"], 2.4, key="p.eq2b", align="left", t0=s + 0.5, w=[s + 0.5, s + 1.6])
    track("l2", [2, 4, 94], (s + 0.4, s + 1.6, [2, 2, 70]))
    same = ann("same", "p6", [-33.0, 3.4], 2.2, key="p.same", t0=s + 1.7, w=[s + 1.7, s + 2.3])
    r70 = ring("r70", "p7", grW(35, 70), 1.3, s + 0.3)
    DATA["sweep"] = [[round(s + 2.5, 3), 23], [round(s + 3.4, 3), 35], [round(s + 5.6, 3), 0], [round(s + 6.4, 3), 23]]
    for (ta, ka), (tb, kb) in zip(DATA["sweep"], DATA["sweep"][1:]):
        for i in range(1, abs(kb - ka) + 1): sfx(ta + (tb - ta) * (i - 0.5) / abs(kb - ka), "mallet", 330 * 2 ** ((ka + np.sign(kb - ka) * i) / 24))
    s = tl.say("e5", hold=1.8)
    at("litOff", s + 0.3)
    end_at(eqb, s + 0.45); end_at(same, s + 0.6); end_at(r70, s + 0.4)
    ann("eq2c", "p6", e2["p"], 2.4, key="p.eq2c", align="left", t0=s + 0.5, w=[s + 0.5, s + 1.6])
    track("l2", [2, 4, 94], (s + 0.4, s + 1.6, [2, 2, 94]))
    ann("para", "p6", [-30.8, 9.2], 2.2, key="p.para", t0=s + 1.7, w=[s + 1.7, s + 2.3])
    r94 = ring("r94", "p7", grW(35, 94), 1.3, s + 0.3, dash=True)
    ann("tgt", "p7", [grW(35, 94)[0] - 1.6, grW(35, 94)[1] + 2.3], 2.0, s="(35, 94)", align="right", t0=s + 0.3, w=[s + 0.3, s + 0.9])
    at("reach", [s + 1.0, s + 1.8])
    s = tl.say("e6", hold=0.8)
    end_at(r94, s + 0.4); B["reach"].append(round(s + 0.4, 3))
    ann("det", "p7", [L2["area"][0], L2["area"][1] - 3.3], L2["areaSize"], key="p.det", align="left", col="red", t0=s + 0.3, w=[s + 0.3, s + 1.3])
    s = tl.say("e7", hold=1.6)
    at("ghost", [s + 0.2, s + 0.6]); sfx(s + 0.2, "pencil", 0.4)
    ann("same2", "p6", [-33.0, 3.4], 2.2, key="p.same", t0=s + 0.3, w=[s + 0.3, s + 0.9])
    ring("rSame", "p6", [-33.0, 3.4], 2.1, s + 1.0, t1=s + 2.2, on="same2")
    ring("rPara", "p6", [-30.8, 9.2], 2.1, s + 2.2, on="para")
    p0 = tl.t + 0.4  # 本片第一次推近：压扁后的那条线
    tl.cam(p0, 4.0, c=grW(25, 50), hh=8.0)
    at("push", [p0, p0 + 4.0]); sfx(p0, "swell", 4.0)
    tl.t = p0 + 6.0
    tl.cam(tl.t, 2.0, **C_SPREAD)  # 拉回，为 2f 翻页
    tl.t += 2.0


def run():
    yr, e2, an = seg2a()
    seg2b()
    seg2c()
    sh, div = seg2d()
    seg2e(sh, div, yr, e2, an)
