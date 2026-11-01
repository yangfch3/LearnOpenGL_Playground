"""上集 0、1a、1b、1c。坐标见 core.py 文首。"""
import numpy as np

from core import (B, DATA, TX, at, ann, ring, end_at, animal, hop_to, mat, morph, track, flip, sfx, tl, on_beat, BAR)


def tw(s, size):  # 与 world.js textW 同式
    return sum((1 if ("\u3000" <= ch <= "\u9fff" or "\uff00" <= ch <= "\uffef" or ch in "①②③《》") else 0.3 if ch == " " else 0.56) for ch in s) * size


def ring_on(id_, a, sub, t0, r=None, **kw):
    """圈住标注 a 里的子串 sub（左对齐文字）。"""
    s = TX[a["key"]] if a["key"] else a["s"]
    i = s.index(sub)
    x = a["p"][0] + tw(s[:i], a["size"]) + tw(sub, a["size"]) / 2
    return ring(id_, a["page"], [x, a["p"][1]], r or a["size"] * 0.62, t0, on=a["id"], sub=dict(of=a["id"], i=i, n=len(sub)), **kw)


C_CLOSED = dict(c=[24.0, 0.0], hh=35.0)
C_1A, C_1A2 = dict(c=[24.0, 6.0], hh=27.0), dict(c=[24.0, 1.5], hh=27.0)
C_1B, C_1C = dict(c=[0.0, 15.0], hh=24.0), dict(c=[22.0, -19.0], hh=24.5)
CAGE = dict(x0=3.0, x1=45.0, y0=0.0, tier=4.4, n=5, slot=6.0)  # 1a 的笼子：5 层、每层 7 格
THUMB = dict(o=[-40.0, 17.0], s=0.45)  # 左页缩略：1a 笼子缩小 0.45 倍


def seg0():
    s = tl.start("0")
    # 手机：放在合着的本子上，三个画面快速轮换 → 像素裂成数字 → 数字溢到封面 → 手机被拿走 → 数字收拢成 2×2
    ph = dict(c=[27.0, 2.0], w=15.0, h=30.0, rot=-12.0)
    at("screens", [s, s + 1.5, s + 2.25, s + 3.0])  # 对话（GPT / Claude / DeepSeek 各 0.5s）、搜索、滤镜、裂开
    at("crack", [s + 3.0, s + 3.8]); at("spill", [s + 3.8, s + 5.8]); at("phoneOut", [s + 5.6, s + 6.6])
    at("gather", [s + 6.4, s + 8.0]); at("peek", [s + 8.0, s + 8.8])
    r = np.random.default_rng(35)
    cols, rows = 6, 11
    th = np.radians(ph["rot"])
    R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    tgt = [[-3.2, 3.2], [3.2, 3.2], [-3.2, -3.2], [3.2, -3.2]]  # 封面中央的 2×2：1 1 / 2 4
    digs = []
    for i in range(cols * rows):
        u, v = (i % cols + 0.5) / cols - 0.5, (i // cols + 0.5) / rows - 0.5
        p0 = (np.array(ph["c"]) + R @ [u * (ph["w"] - 1.6), v * (ph["h"] - 4.0)]).tolist()
        while True:  # 溢出落点：封面上、手机左侧与下方（手机向右上方被拿走，不压到数字）
            p1 = [r.uniform(3, 34), r.uniform(-28, 26)]
            if not (14 < p1[0] < 40 and -16 < p1[1] < 20): break
        g = i % 4
        digs.append(dict(v=str(int(r.integers(0, 256))), p0=[round(x, 2) for x in p0], p1=[round(x, 2) for x in p1], g=g,
                         t1=round(B["spill"][0] + r.uniform(0, 1.4), 3), t2=round(B["gather"][0] + r.uniform(0, 0.8), 3)))
    DATA["d0"] = dict(phone=ph, digs=digs, tgt=tgt, mc=[24.0, 2.0], vals=["1", "1", "2", "4"], cols=cols, rows=rows,
                      exit=[70.0, 60.0])
    for k in range(4): sfx(B["screens"][k] if k < 3 else B["screens"][3], "tick", 2400)
    sfx(B["crack"][0], "crack"); sfx(B["spill"][0], "spill", 2.0); sfx(B["phoneOut"][0], "slide", 1.0)
    sfx(B["gather"][0], "gather", 1.6); sfx(B["peek"][0], "boing")
    tl.t = s + 4.2
    tl.say("h1", pre=0.0, hold=0.2)
    f0 = s + 9.0
    flip(0, f0)
    tl.cam(f0 + 0.1, 1.5, **C_1A)
    tl.t = f0 + 1.6


def seg1a():
    s = tl.start("1a")
    page = "p1"
    at("cage", [s + 0.2, s + 1.6, s + 6.0, s + 6.6])  # 先画底与左墙，动物进完再画右墙
    r = np.random.default_rng(1600)
    kinds = ["rabbit"] * 12 + ["chicken"] * 23
    r.shuffle(kinds)
    ends = []
    for k, kind in enumerate(kinds):
        tier, j = k // 7, k % 7
        y = CAGE["y0"] + tier * CAGE["tier"]
        x = CAGE["x0"] + CAGE["slot"] * (j + 0.5)
        a = animal(f"a{k}", kind, page, 51.0, y, sc=1.15, face=-1, cage=[CAGE["x0"], y, CAGE["x1"], y + CAGE["tier"]])
        t0 = s + 1.6 + j * 0.32 + tier * 0.06
        a["show"][0] = round(t0 - 0.05, 3)
        n = int(np.ceil((51 - x) / 4.8))  # 每跳不超过 4.8 格、速度一律 16 格/秒：前后两只的间距不变，不会追尾
        ends.append(hop_to(a, t0, x, n=n, d=round((51 - x) / n / 16.0, 3), h=0.55, gap=0.0))
    assert max(ends) < B["cage"][2], "动物没进完就封笼"
    DATA["animals1a"] = [f"a{k}" for k in range(35)]
    DATA["cage1a"] = CAGE
    sfx(B["cage"][0], "pencil", 1.4); sfx(B["cage"][2], "pencil", 0.6)
    s1 = tl.say("a1", pre=3.0, hold=1.6)
    q = ann("q", page, [3.0, 26.0], 2.6, key="p.q", align="left", t0=s1 + 1.0, w=[s1 + 1.0, s1 + 2.6])
    ann("src", page, [45.0, 29.3], 1.8, key="p.src", align="right", t0=s1 + 3.0, w=[s1 + 3.0, s1 + 4.6])
    s2 = tl.say("a2", pre=0.2, hold=0.0)
    tl.say("n.lift", pre=0.1, st="note")
    lift = s2 + 0.9
    from core import ANIMALS
    for a in ANIMALS:
        if a["page"] == page: a["lift"] = [[round(lift, 3), None]]
    sfx(lift, "puff")
    dots0 = s2 + 1.7
    at("dots", [dots0, 0.12])  # 着地的脚逐只亮起：起点、间隔
    for i in range(24): sfx(dots0 + i * 0.12, "mallet", 520 * 2 ** (i / 24))
    ann("cnt", page, [45.0, 26.0], 2.6, s="24", align="right", col="red", t0=dots0, kind="live")  # 数字随亮起的脚计数
    s3 = tl.say("a3", pre=0.3, hold=4.2)
    tl.cam(s3 + 0.2, 1.0, **C_1A2)
    # 等号右对齐成一列；答案单独一条标注，红圈只按答案自身的字宽定位
    X = 16.6
    ann("aEq1a", page, [X, -5.0], 2.6, key="p.a1a", align="right", t0=s3 + 1.4, w=[s3 + 1.4, s3 + 2.5])
    e1 = ann("aEq1b", page, [X + 0.9, -5.0], 2.6, key="p.a1b", align="left", t0=s3 + 2.5, w=[s3 + 2.5, s3 + 3.0])
    ring_on("a12", e1, "12", s3 + 3.1)
    ann("aEq2a", page, [X, -9.3], 2.6, key="p.a2a", align="right", t0=s3 + 3.8, w=[s3 + 3.8, s3 + 4.9])
    e2 = ann("aEq2b", page, [X + 0.9, -9.3], 2.6, key="p.a2b", align="left", t0=s3 + 4.9, w=[s3 + 4.9, s3 + 5.4])
    ring_on("a23", e2, "23", s3 + 5.5)
    assert q and e2
    return lift


def seg1b(lift1a):
    s = tl.start("1b")
    flip(1, s + 0.1)
    tl.cam(s + 0.1, 1.3, **C_1B)
    DATA["thumb"] = THUMB
    p = "p3"
    tl.say("T.b", pre=0.3, st="title")
    s1 = tl.say("b1", pre=0.2, hold=1.6)
    ann("set", p, [4.0, 28.0], 2.4, key="p.set", align="left", t0=s1 + 0.2, w=[s1 + 0.2, s1 + 1.6])
    ann("brace", p, [5.2, 23.3], 2.4, s="{", font="brace", t0=s1 + 1.8, w=[s1 + 1.8, s1 + 2.1], box=[4.4, 20.0, 6.0, 26.6])
    ann("n1", p, [7.4, 25.0], 2.4, key="p.n1", t0=s1 + 2.0, w=[s1 + 2.0, s1 + 2.2])
    ann("e1", p, [9.2, 25.0], 2.4, key="p.e1", align="left", t0=s1 + 2.2, w=[s1 + 2.2, s1 + 3.2])
    ann("n2", p, [7.4, 21.5], 2.4, key="p.n2", t0=s1 + 3.3, w=[s1 + 3.3, s1 + 3.5])
    ann("e2", p, [9.2, 21.5], 2.4, key="p.e2", align="left", t0=s1 + 3.5, w=[s1 + 3.5, s1 + 4.7])
    s2 = tl.say("b2", hold=2.4)
    op = ann("op", p, [4.0, 16.5], 2.4, key="p.op", align="left", t0=s2 + 0.3, w=[s2 + 0.3, s2 + 1.5])
    ann("r1", p, [4.0, 12.5], 2.4, key="p.r1", align="left", t0=s2 + 1.8, w=[s2 + 1.8, s2 + 2.8])
    r2 = ann("r2", p, [4.0, 8.5], 2.4, key="p.r2", align="left", t0=s2 + 3.0, w=[s2 + 3.0, s2 + 4.6])
    s3 = tl.say("b3", hold=1.6)
    track("thumbLift", 0.0, (s3 + 0.4, s3 + 0.9, 1.0))  # 左页缩略图里重放抬脚
    sfx(s3 + 0.5, "puff")
    th = THUMB
    link = dict(a=[3.4, 16.5], b=[th["o"][0] + 42 * th["s"] + 0.6, th["o"][1] + 6.0])
    ann("link", "p3", [0, 0], 1, kind="link", t0=s3 + 1.1, w=[s3 + 1.1, s3 + 1.9], col="red", ab=link,
        box=[min(link["a"][0], link["b"][0]), 16.0, max(link["a"][0], link["b"][0]), 23.6], on="op")
    sfx(s3 + 1.1, "marker", 0.8)
    assert op and r2 and lift1a


def seg1c():
    s = tl.start("1c")
    tl.cam(s, 1.4, **C_1C)
    p, o, k = "p3", [8.0, -27.8], 0.7  # 原点、1 只 = 0.7 格
    G = dict(o=o, s=k, n=40)
    DATA["g1c"] = G
    W = lambda x, y: [o[0] + x * k, o[1] + y * k]  # noqa: E731
    at("axes1c", [s + 0.6, s + 1.6])
    sfx(s + 0.6, "pencil", 1.0)
    for i in range(1, 5):
        ann(f"cx{i}", p, [W(10 * i, 0)[0], o[1] - 1.7], 1.8, s=str(10 * i), t0=s + 1.2)
        ann(f"cy{i}", p, [o[0] - 1.1, W(0, 10 * i)[1]], 1.8, s=str(10 * i), align="right", t0=s + 1.2)
    ann("cxn", p, [W(41.5, 0)[0] + 1.0, o[1] + 1.5], 2.0, key="p.xc", align="left", t0=s + 1.4)
    ann("cyn", p, [o[0] + 1.0, W(0, 42.5)[1]], 2.0, key="p.yr", align="left", t0=s + 1.4)
    s1 = tl.say("c1", pre=1.6, hold=0.8)
    at("line1", [s1 + 0.4, s1 + 1.6])
    sfx(s1 + 0.4, "pencil", 1.2)
    ann("cn1", p, [W(6, 29)[0] - 1.4, W(6, 29)[1] - 1.4], 2.0, key="p.n1", t0=s1 + 1.6)  # 标在线的下方，让出滑动标签的路
    s2 = tl.say("c2", hold=2.4)
    at("slide1", [s2 + 0.3, s2 + 4.8])  # 小点沿 ① 从 (35, 0) 滑到 (0, 35)
    for x in range(35, -1, -1): sfx(s2 + 0.3 + (35 - x) / 35 * 4.5, "tick", 1600 + 30 * x)
    s3 = tl.say("c3", hold=3.6)
    at("line2", [s3 + 0.3, s3 + 1.5])
    sfx(s3 + 0.3, "pencil", 1.2)
    ann("cn2", p, [W(31, 8)[0] + 0.6, W(31, 8)[1] + 1.6], 2.0, key="p.n2", t0=s3 + 1.5)
    at("slide2", [s3 + 1.8, s3 + 3.8])  # 滑回，停在交点
    for x in range(0, 24): sfx(s3 + 1.8 + x / 23 * 2.0, "tick", 1600 + 30 * x)
    ring("rx", p, W(23, 12), 1.5, s3 + 4.0)
    DATA["slide"] = dict(o=o, s=k)


def run():
    seg0()
    l = seg1a()
    seg1b(l)
    seg1c()
