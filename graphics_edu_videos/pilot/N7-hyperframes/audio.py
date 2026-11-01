"""N7 整集声音：主题音乐（音色随段落加厚，只作底）+ 动作音（build 产出的事件表）；归一到 -20 LUFS、真峰值 ≤ -1 dBTP。
乐器与基础件在 sound.py。"""
import wave
from pathlib import Path

import numpy as np

import common as CM
from common import SR, Track, lp, tt, env, mallet, thump
from sound import (RS, noise, f_, THEME, CHORDS, ROOT, piano, strings, lowpad, pencil, marker, tick, puff, boing, squeak, lufs, true_peak, limit, mix)


def _io2(u):
    return 2 * u * u if u < 0.5 else 1 - 2 * (1 - u) ** 2


def track_at(v0, keys, t):  # 与 world.js track 同式（标量 / 矩阵）
    v = np.array(v0, float)
    for t0, t1, N, *ez in keys:
        if t <= t0: break
        v = v + (np.array(N, float) - v) * _io2(min(1.0, (t - t0) / (t1 - t0)))
        if t < t1: break
    return v


def stage(D, t):
    s = D["segs"]
    if t < s["1b"]: return "box"
    if t < s["1d"]: return "piano"
    if t < s["1p"]: return "piano+"
    if t < s["2a"]: return "breath"
    return "matrix"


def music(D):
    dur, bar, b = D["duration"], D["bar"], D["b"]
    beat = bar / 4
    tr = Track(dur)
    for k in range(0, int(round(dur / bar)), 2):  # 底：和弦两小节一换，慢起慢收、相邻交叠
        t0, ch, st = k * bar, CHORDS[(k // 2) % 4], stage(D, k * bar + 0.01)
        d = 2 * bar + 2.0
        if st == "box":
            for j, n in enumerate(ch * 2): tr.place(t0 + j * bar / 3, mallet(f_(n, 1), 0.012, 0.5, RS))
        else:
            tr.place(max(0.0, t0 - 1.0), strings([f_(n, -1) for n in ch], d, 0.0028 if st != "breath" else 0.0034, 1.8, 2.0))
        if st == "matrix": tr.place(max(0.0, t0 - 1.0), lowpad(f_(ROOT[(k // 2) % 4], -2), d, 0.035, 1.6, 1.8))
    # 主题：开场（八音盒）与收尾（钢琴，落在主和弦）各一遍；讲道理的地方只留底
    for p0, inst in ((0.0, "box"), (D["segs"]["2p"], "piano")):
        p = p0
        for n, o, d in THEME:
            if p < dur - 1.5:
                tr.place(p, mallet(f_(n, o + 1), 0.03, 0.6, RS) if inst == "box" else piano(f_(n, o), 0.034, max(1.2, d * beat * 2.5)))
            p += d * beat
    end = D["segs"]["2p"] + len(THEME) and D["segs"]["2p"] + sum(x[2] for x in THEME) * beat
    tr.place(end, mix(*(piano(f, 0.03, 3.5) for f in (f_("C", -1), f_("E", 0), f_("G", 0), f_("C", 1)))))
    tq = np.arange(len(tr.buf)) / SR
    q0, q1 = b["quiet"]
    g = 1 - np.clip((tq - q0) / 0.12, 0, 1) * np.clip((q1 + 1.0 - tq) / 1.0, 0, 1)  # 压扁的闷响后安静一拍
    g *= np.clip(tq / 1.5, 0, 1) * np.clip((dur - tq) / 2.5, 0, 1)
    return lp(tr.buf, 3000) * g


def drone(D, t0, t1, detf, end_zero=False):
    """持续音：音高随 |行列式|。"""
    a0, a1 = t0 - 0.2, t1 + (0.0 if end_zero else 0.5)
    ts = np.arange(a0, a1, 0.01)
    dd = np.interp(np.arange(int((a1 - a0) * SR)) / SR + a0, ts, [abs(detf(x)) for x in ts])
    fr = 65 * (0.6 + 0.4 * np.sqrt(np.minimum(dd, 12.0) / 2))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    n = len(dd); tq = np.arange(n) / SR
    e = np.minimum(dd * 2, 1) * np.minimum(tq / 0.3, 1) * np.minimum((n / SR - tq) / 0.3, 1).clip(0)
    return a0, lp((np.sin(ph) + 0.3 * np.sin(2 * ph)) * 0.035 * e, 500)


def sfx(D):
    tr = Track(D["duration"]); put = tr.place
    for a in D["ann"]:  # 书写与圈画：长度 = 书写时长
        if not a.get("w") or a["w"][0] < 0: continue
        d = max(0.15, a["w"][1] - a["w"][0])
        put(a["w"][0], marker(d, 0.05) if a["col"] == "red" or a.get("kind") == "ring" else pencil(d, 0.045, abs(hash(a["id"])) % 1000))
    M = D["mats"]["M"]
    for t0, t1, N, *_ in M["keys"]:
        zero = abs(np.linalg.det(np.array(N))) < 1e-9
        put(*drone(D, t0, t1, lambda x: np.linalg.det(track_at(M["m0"], M["keys"], x)), zero))
        put(t0, lp(noise(t1 - t0, 900, 0.05) * np.sin(np.pi * tt(t1 - t0) / (t1 - t0)) ** 2, 600))
    A = np.array(D["mats"]["M"]["m0"]); A3 = np.array(D["d2g"]["A"], float); I2, I3 = np.eye(2), np.eye(3)
    for t, kind, *args in D["sfx"]:
        d = args[0] if args and isinstance(args[0], (int, float)) else 0.5
        if kind == "land": put(t, mix(mallet(260 if args[0] != "chicken" else 330, 0.025, 0.04, RS), tick(0.015, 900)))
        elif kind == "boing": put(t, boing(420, 700, 0.12, 0.022))
        elif kind == "squeak": put(t, squeak(0.035))
        elif kind == "buzz": put(t, lp(noise(d, 3000, 0.02) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * tt(d))) * env(d, 0.2, 0.3), 2500))
        elif kind == "page": put(t, lp(noise(0.9, 5000, 0.06) * np.sin(np.pi * tt(0.9) / 0.9) ** 1.5, 3500)); put(t + 0.85, tick(0.03, 1200))
        elif kind == "tick": put(t, tick(0.035, args[0]))
        elif kind == "mallet": put(t, mallet(args[0], 0.022, 0.12, RS))
        elif kind == "pencil": put(t, pencil(d, 0.04, int(t * 10) % 997))
        elif kind == "marker": put(t, marker(d, 0.045))
        elif kind == "puff": put(t, puff(0.07))
        elif kind == "chime": put(t, mix(mallet(args[0], 0.03, 0.5, RS), mallet(args[0] * 2, 0.012, 0.3, RS)))
        elif kind in ("rise", "grow", "fold", "stretch", "swell", "whoosh", "slide", "spill", "gather", "rain"):
            f0, f1 = dict(rise=(300, 600), grow=(250, 500), fold=(500, 250), stretch=(350, 520), swell=(200, 320), whoosh=(400, 400), slide=(300, 300),
                          spill=(900, 900), gather=(700, 400), rain=(1800, 1800))[kind]
            base = lp(noise(d, 2500 if kind not in ("spill", "rain") else 6000, 0.04) * np.sin(np.pi * tt(d) / d) ** 2, 1800 if kind not in ("spill", "rain") else 5000)
            put(t, base if f0 == f1 else mix(base, CM.glide(f0, f1, d, 0.018)))
        elif kind == "crack": put(t, noise(0.3, 7000, 0.05) * np.exp(-tt(0.3) / 0.08))
        elif kind == "step": put(t, tick(0.04, 700))
        elif kind == "tape": put(t, lp(noise(0.22, 2500, 0.03) * env(0.22, 0.02, 0.12), 1800)); put(t + 0.2, tick(0.025, 1100))  # 标题卡：胶带贴上
        elif kind == "thump": put(t, lp(thump(0.16, 75), 300)); put(t, lp(noise(0.3, 400, 0.05) * np.exp(-tt(0.3) / 0.08), 300))
        elif kind == "grid": put(*drone(D, t, t + d, lambda x: np.linalg.det(I2 + (A - I2) * _io2(min(1, max(0, (x - t) / d)))) * 0.5 + 0.5))
        elif kind == "grid3": put(*drone(D, t, t + d, lambda x: np.linalg.det(I3 + (A3 - I3) * _io2(min(1, max(0, (x - t) / d)))) / 6))
        elif kind == "morph2": put(t, mix(lp(noise(d, 900, 0.04) * np.sin(np.pi * tt(d) / d) ** 2, 600), CM.glide(330, 440, d, 0.012)))
    return tr.buf


def make(D, path):
    m = music(D) * 0.5  # 音乐退到动作音之下，只作底
    s = sfx(D)
    q0, q1 = D["b"]["quiet"]
    tq = np.arange(len(s)) / SR
    x = m + s * np.where((tq > q0 + 0.35) & (tq < q1), 0.15, 1.0)
    for _ in range(3):
        x = limit(x * 10 ** ((-20 - lufs(x)) / 20), 10 ** (-1.8 / 20))
    tp = true_peak(x)
    print("loudness %.2f LUFS, true peak %.2f dBTP" % (lufs(x), tp))
    assert abs(lufs(x) + 20) < 0.3 and tp <= -1.0, "响度或真峰值不达标"
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.repeat(pcm, 2).tobytes())
    print("audio ok", Path(path).name)
