"""N7 构建公用：时间线、纸上标注、动物、矩阵轨道、颜色。各段脚本（ep1_*.py）只调这里的函数往全局表里加数据。
世界：桌面为 z = 0 平面，数学本摊开时书脊在 x = 0；每页 48×62，右页 x∈[0,48]、左页 x∈[-48,0]，y∈[-31,31]；1 单位 = 1 格（5mm）。"""
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import load_text, read_need  # noqa: E402

TX = load_text(ROOT / "assets/text/zh-CN.js")
BAR = 60 / 90 * 4  # 90 BPM，一小节 2.667s
BEAT = BAR / 4
PW, PH = 48, 62
# 纸张（leaf）：[正面, 背面]；翻过去后背面朝上成为左页
LEAVES = [["cover", "inner"], ["p1", "p2"], ["p3", "p4"], ["p5", "p6"], ["p7", "p8"], ["p9", "p10"], ["p11", "end"]]
PAGE_OF = {f: i for i, (f, b) in enumerate(LEAVES) for _ in (0,)}
SIDE = {f: "R" for f, _ in LEAVES} | {b: "L" for _, b in LEAVES}
PRECT = {pid: ([0, -31, 48, 31] if s == "R" else [-48, -31, 0, 31]) for pid, s in SIDE.items()}
FLIP = 0.9  # 翻页时长


class TL:
    """t 为游标。say 放一条字幕并把游标推到它结束；cam 记运镜段；start 开段（取整到小节线）。"""

    def __init__(self):
        self.t, self.caps, self.b, self.cams, self.segs = 0.0, [], {}, [], {}

    def at(self, name, v):
        assert name not in TX and name not in self.b, ("节拍名重复或与字幕键冲突", name)
        self.b[name] = [round(x, 3) for x in v] if isinstance(v, (list, tuple)) else round(v, 3)
        return v

    def say(self, key, pre=0.2, hold=0.0, st="say", xy=None):
        """st：say（底部字幕）/ note（手写批注，底部偏右）/ title（承上启下的标题卡，默认画面正中；xy 为屏幕中心像素）。"""
        t0 = self.t + pre
        t1 = t0 + read_need(TX[key]) + 0.25 + hold
        n = sum(1.0 if ord(ch) > 0x2E80 else 0.55 for ch in TX[key])  # 字宽（字号倍数）：全角 1，其余约 0.55
        x, y, size = dict(say=(960, 868, 52), note=(1240, 880, 50), title=(960, 540, 110))[st]
        if xy: x, y = xy
        w = n * (size + 2) + dict(say=12, note=40, title=130)[st]  # 字距、关键词衬底、标题卡胶带与倾斜的余量
        h = size * (1.7 if st == "title" else 1.4)
        self.caps.append(dict(k=key, t0=round(t0, 3), t1=round(t1, 3), st=st, x=x, y=y, size=size,
                              box=[round(x - w / 2), round(y - h / 2), round(x + w / 2), round(y + h / 2)]))
        if st == "title": SFX.append([round(t0, 3), "tape"])
        self.b[key], self.b[key + "_e"] = round(t0, 3), round(t1, 3)
        self.t = t1
        return t0

    def wait(self, d):
        self.t += d

    def cam(self, t0, d, ease="io2", **tgt):
        if self.cams: assert t0 >= self.cams[-1][1] - 1e-6, ("运镜段交叠", t0, self.cams[-1])
        self.cams.append([round(t0, 3), round(t0 + d, 3), dict(tgt, ease=ease)])
        return t0 + d

    def start(self, name):
        self.t = math.ceil(self.t / BAR - 1e-6) * BAR
        self.segs[name] = round(self.t, 3)
        return self.t


tl = TL()
B, at = tl.b, tl.at
ANN, ANIMALS, FLIPS, SFX = [], [], [], []
MATS, TRACKS, DATA = {}, {}, {}
def r3(v):
    if isinstance(v, (list, tuple)): return [r3(x) for x in v]
    return round(float(v), 3) if isinstance(v, (int, float, np.floating, np.integer)) and not isinstance(v, bool) else v


def on_beat(t):
    return math.ceil(t / BEAT - 1e-6) * BEAT


def sfx(t, kind, *args):
    SFX.append([round(t, 3), kind, *[r3(a) for a in args]])


def ann(id_, page, p, size, key=None, s=None, t0=0.0, t1=None, w=None, align="center", col="hand", font="hand", fout=0.3, **kw):
    """纸上文字。w = [书写起, 止]（逐字写出，配铅笔声）；col：hand（笔迹）/ red / ink（印刷）/ 语义色名。"""
    assert key is None or key in TX, key
    assert all(x["id"] != id_ for x in ANN), ("标注 id 重复", id_)
    a = dict(id=id_, page=page, p=r3(list(p)), size=size, key=key, s=s, t=[round(t0, 3), t1], w=r3(list(w)) if w else None,
             align=align, col=col, font=font, fout=fout, **kw)
    ANN.append(a)
    return a


def ring(id_, page, p, r, t0, t1=None, w=None, dash=False, on=None, col="red", sub=None):
    """红笔圈。on：圈住的那条标注（允许重叠）；sub = {of, i, n}：圈住 of 文字里第 i 起的 n 个字，绘制时按实测字宽定位。"""
    assert all(x["id"] != id_ for x in ANN), ("标注 id 重复", id_)
    a = dict(id=id_, page=page, kind="ring", p=r3(list(p)), r=r, t=[round(t0, 3), t1], w=r3(list(w or [t0, t0 + 0.6])), dash=dash, on=on, sub=sub,
             col=col, fout=0.3, box=[p[0] - r * 1.12, p[1] - r, p[0] + r * 1.12, p[1] + r])
    ANN.append(a)
    return a


def get(id_):
    return next(a for a in ANN if a["id"] == id_)


def end_at(a, t):
    a["t"][1] = round(t, 3)
    return a


def animal(id_, kind, page, x, y, sc=1.0, face=1, show=(0.0, None), cage=None):
    R = dict(chicken=[1.5, 3.1], rabbit=[1.7, 3.5], duck=[1.6, 2.9], fly=[1.3, 1.4])[kind]
    a = dict(id=id_, kind=kind, page=page, x=x, y=y, sc=sc, face=face, r=R, moves=[], lift=[], show=[round(show[0], 3), show[1]], cage=cage)
    ANIMALS.append(a)
    return a


def hop_to(a, t0, x1, y1=None, n=None, d=0.34, h=1.1, gap=0.02):
    """从当前位置分 n 跳到 (x1, y1)；返回结束时刻。"""
    x0, y0 = (a["moves"][-1][4], a["moves"][-1][5]) if a["moves"] else (a["x"], a["y"])
    y1 = y0 if y1 is None else y1
    n = n or max(1, round(abs(x1 - x0) / (3.0 * a["sc"])))
    t = t0
    for i in range(n):
        u0, u1 = i / n, (i + 1) / n
        a["moves"].append([round(t, 3), round(t + d, 3), round(x0 + (x1 - x0) * u0, 3), round(y0 + (y1 - y0) * u0, 3),
                           round(x0 + (x1 - x0) * u1, 3), round(y0 + (y1 - y0) * u1, 3), round(h * a["sc"], 3)])
        sfx(t + d, "land", a["kind"])
        if a["kind"] == "rabbit": sfx(t, "boing")
        t += d + gap
    return t - gap


def fly_to(a, t0, x1, y1, d):
    x0, y0 = (a["moves"][-1][4], a["moves"][-1][5]) if a["moves"] else (a["x"], a["y"])
    a["moves"].append([round(t0, 3), round(t0 + d, 3), x0, y0, x1, y1, round(1.5 * a["sc"], 3)])
    sfx(t0, "buzz", d)
    return t0 + d


def mat(name, m0):
    MATS[name] = dict(m0=np.array(m0, float).tolist(), keys=[])
    return MATS[name]


def morph(name, t0, d, M, ez="io2"):
    MATS[name]["keys"].append([round(t0, 3), round(t0 + d, 3), np.array(M, float).tolist(), ez])
    sfx(t0, "morph", d, name)
    return t0 + d


def track(name, v0, *keys):
    """通用参数轨道：keys = (起, 止, 目标[, 缓动])。"""
    tr = TRACKS.setdefault(name, dict(v0=v0, keys=[]))
    for k in keys: tr["keys"].append([round(k[0], 3), round(k[1], 3), r3(k[2]), *(k[3:] or ["io2"])])
    return tr


def flip(i, t0, back=False):
    a0, a1 = (math.pi, 0.0) if back else (0.0, math.pi)
    FLIPS.append([i, round(t0, 3), round(t0 + FLIP, 3), a0, a1])
    sfx(t0, "page")
    return t0 + FLIP


# ---- 颜色：对纸色实算对比度，文字 ≥ 4.5、图形 ≥ 3；不达标就加深（不改语义）。xxT 为该色写成文字时用的版本 ----
COL = dict(paper="#F7F3E8", ink="#1E2638", hand="#1F3B6E", pencil="#4A4A4A", red="#D23C2C", chick="#C8621F", rabbit="#6E4E9E",
           duck="#3F8F6B", fly="#2A8FA3", grid="#A9C6E0", rule="#B8C9DC", desk="#8A6E55", cover="#5F7F96", beak="#E8B04A",
           chickBody="#F3C9A0", rabbitBody="#D9CFEA", duckBody="#BFDCCB", flyBody="#BFE3EA")
NEED = dict(ink=4.5, hand=4.5, pencil=4.5, red=4.5, chick=3.0, rabbit=3.0, duck=3.0, fly=3.0)
for _k in ("chick", "rabbit", "duck", "fly", "red"): COL[_k + "T"] = COL[_k]; NEED[_k + "T"] = 4.5


def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    return (max(lum(a), lum(b)) + 0.05) / (min(lum(a), lum(b)) + 0.05)


for _k, _need in NEED.items():
    while contrast(COL[_k], COL["paper"]) < _need:
        COL[_k] = "#" + "".join(f"{int(int(COL[_k][i:i + 2], 16) * 0.97):02X}" for i in (1, 3, 5))
