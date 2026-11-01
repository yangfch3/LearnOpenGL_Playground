"""N7 声音：主题音乐 + 动作音，落点全取 build.py 的节拍；成品按 BS.1770 归一到 -20 LUFS、真峰值 ≤ -1 dBTP。"""
import wave
from pathlib import Path

import numpy as np
from scipy.signal import lfilter, resample_poly

import common as CM
from common import SR, Track, lp, tt, env, mallet, thump

RS = np.random.default_rng(77)
noise = lambda d, cut, a=1.0: CM.noise(RS, d, cut, a)  # noqa: E731
NOTE = {n: 261.63 * 2 ** (k / 12) for n, k in dict(C=0, D=2, E=4, F=5, G=7, A=9, B=11).items()}
f_ = lambda n, o=0: NOTE[n] * 2 ** o  # noqa: E731
# 童谣式五声短句（4 小节，单位：拍）：音名、八度、时值
THEME = [("E", 0, 1), ("G", 0, 1), ("A", 0, 1), ("G", 0, 1), ("E", 0, .5), ("D", 0, .5), ("C", 0, 1), ("D", 0, 2),
         ("E", 0, 1), ("G", 0, 1), ("A", 0, .5), ("C", 1, .5), ("A", 0, 1), ("G", 0, .5), ("E", 0, .5), ("D", 0, 1), ("C", 0, 2)]
CHORDS = [("C", "E", "G"), ("A", "C", "E"), ("F", "A", "C"), ("G", "B", "D")]
ROOT = ["C", "A", "F", "G"]


def piano(f, a, d=1.6):
    t = tt(d)
    sig = sum((1 / n ** 1.4) * np.sin(2 * np.pi * f * n * (1 + 0.0004 * n * n) * t) * np.exp(-t * (1.2 + 0.9 * n)) for n in range(1, 8))
    k = int(0.02 * SR)
    sig[:k] += 0.06 * noise(0.02, 3000)[:k] * np.exp(-tt(0.02)[:k] / 0.004)  # 琴槌
    return a * sig * np.minimum(t / 0.003, 1) * np.minimum((d - t) / 0.05, 1)


def saw(f, d):
    t = tt(d)
    return sum(((-1) ** (n + 1)) / n * np.sin(2 * np.pi * f * n * t) for n in range(1, int(min(4000 / f, 24)) + 1))


def strings(fs, d, a, att=0.7, rel=0.9):
    out = sum(saw(f * dt, d) for f in fs for dt in (0.997, 1.0, 1.004))
    return a * lp(lp(out, 1200), 1500) * env(d, att, rel)


def lowpad(f, d, a, att=0.5, rel=0.8):
    t = tt(d)
    return a * lp(np.sin(2 * np.pi * f * t) + 0.35 * saw(f, d) * 0.5, 400) * env(d, att, rel)


def pencil(d, a=0.05, seed=0):
    """铅笔沙沙：中频带通噪声（约 0.7–3 kHz，去掉刺耳的高频），按笔画节奏（约 7 次/秒）起伏；整体压低到 0.4 倍。"""
    r = np.random.default_rng(seed)
    n0 = noise(d, 5000)
    n = lp(lp(n0, 3000), 3000) - lp(n0, 700)
    a *= 0.4
    strokes = np.zeros(len(n)); t = 0.0
    while t < d:
        L = r.uniform(0.08, 0.18); i0, i1 = int(t * SR), int(min(d, t + L) * SR)
        strokes[i0:i1] = np.sin(np.pi * np.linspace(0, 1, i1 - i0)) * r.uniform(0.6, 1.0); t += L + r.uniform(0.01, 0.05)
    return a * n / (np.abs(n).max() + 1e-9) * strokes * env(d, 0.01, 0.05)


def felt(d, a=0.045, seed=0):
    """软笔书写：约 250–900 Hz 的平滑噪声，只有缓慢起伏，不逐笔断续、不带高频颗粒；比铅笔声再低约 6 dB。"""
    r = np.random.default_rng(seed)
    n0 = noise(d, 2000)
    n = lp(lp(n0, 900), 900) - lp(n0, 250)
    sw = 0.8 + 0.2 * np.sin(2 * np.pi * r.uniform(1.6, 2.4) * tt(d) + r.uniform(0, 6.3))
    return 0.2 * a * n / (np.abs(n).max() + 1e-9) * sw * env(d, min(0.08, d / 3), min(0.15, d / 3))


def marker(d, a=0.05):
    """红笔圈画：低一些、连贯的摩擦声。"""
    n0 = noise(d, 4000)
    n = lp(n0, 2200) - lp(n0, 800)
    return 0.7 * a * n / (np.abs(n).max() + 1e-9) * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * tt(d))) * env(d, 0.03, 0.08)


def tick(a=0.05, f=2400):
    return lp(noise(0.03, f, a), f) * np.exp(-tt(0.03) / 0.006)


def puff(a=0.06):
    d = 0.25
    return a * (lp(noise(d, 900), 500) * np.exp(-tt(d) / 0.06) + 0.6 * np.sin(2 * np.pi * (180 - 120 * tt(d)) * tt(d)) * np.exp(-tt(d) / 0.05))


def boing(f0, f1, d, a):
    return CM.glide(f0, f1, d, a)


def squeak(a=0.04):  # 鸭：玩具「嘎」
    d = 0.14; t = tt(d)
    ph = 2 * np.pi * np.cumsum(np.linspace(620, 470, len(t))) / SR
    return a * lp(np.sign(np.sin(ph)) * 0.6 + np.sin(2 * ph) * 0.4, 2200) * np.sin(np.pi * t / d) ** 0.5


def lufs(x):
    """BS.1770-4 积分响度（单声道复制到双声道）。"""
    y = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x)
    y = lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], y)
    n, h = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.mean(y[i:i + n] ** 2) for i in range(0, len(y) - n, h)]) * 2
    ld = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[ld > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    return -0.691 + 10 * np.log10(ms[(ld > -70) & (ld > rel)].mean())


def limit(x, thr):
    """前瞻限峰：5ms 窗内取峰值求增益，起效即时、释放 80ms。"""
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(np.abs(x), int(0.005 * SR), origin=-int(0.0025 * SR))
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-9))
    a = np.exp(-1 / (0.08 * SR))
    gs = -lfilter([1 - a], [1, -a], -g)  # 释放平滑
    return x * np.minimum(g, gs)


def true_peak(x):
    return 20 * np.log10(np.abs(resample_poly(x, 4, 1)).max())


def mix(*xs):
    out = np.zeros(max(len(x) for x in xs))
    for x in xs: out[:len(x)] += x
    return out


def io2(u):
    return 2 * u * u if u < 0.5 else 1 - 2 * (1 - u) ** 2


def mat_at(D, t):  # 与 world.js matAt 同式
    M = np.array(D["m0"], float)
    for t0, t1, N in D["mk"]:
        if t <= t0: break
        M = M + (np.array(N) - M) * io2(min(1.0, (t - t0) / (t1 - t0)))
        if t < t1: break
    return M


def music(D):
    dur, bar, b = D["duration"], D["bar"], D["b"]
    beat = bar / 4
    tr = Track(dur)
    # 底：和弦两小节一换，相邻和弦慢起慢收、交叠约 2s，听不出接缝
    for k in range(0, int(round(dur / bar)), 2):
        t0, ch = k * bar, CHORDS[(k // 2) % 4]
        d = 2 * bar + 2.0
        tr.place(max(0.0, t0 - 1.0), strings([f_(n, -1) for n in ch], d, 0.0028, 1.8, 2.0))
        tr.place(max(0.0, t0 - 1.0), lowpad(f_(ROOT[(k // 2) % 4], -2), d, 0.035, 1.6, 1.8))
    # 主题只奏两次：开头一遍，结尾推近时一遍；中间讲道理的地方只留底，不抢思考
    for p0 in (0.0, round(b["push"][0] / bar) * bar):
        p = p0
        for n, o, d in THEME:
            if p < dur - 1.5: tr.place(p, piano(f_(n, o), 0.032, max(1.2, d * beat * 2.5)))
            p += d * beat
    tq = np.arange(len(tr.buf)) / SR
    q0, q1 = b["quiet"]
    g = 1 - np.clip((tq - q0) / 0.12, 0, 1) * np.clip((q1 + 1.0 - tq) / 1.0, 0, 1)  # 闷响后安静一拍，再慢慢回来
    g *= np.clip(tq / 1.5, 0, 1) * np.clip((dur - tq) / 2.5, 0, 1)  # 首尾淡入淡出
    return lp(tr.buf, 3000) * g, g


def sfx(D):
    dur, b = D["duration"], D["b"]
    tr = Track(dur)
    put = tr.place
    for a in D["ann"]:  # 书写与圈画：长度 = 书写时长
        if not a.get("w") or a["w"][0] < 0: continue
        d = a["w"][1] - a["w"][0]
        put(a["w"][0], marker(d, 0.05) if a["col"] == "red" or a.get("kind") == "ring" else pencil(d, 0.045, hash(a["id"]) % 1000))
    for i, (t0, t1, N) in enumerate(D["mk"]):  # 纸被推动：摩擦声
        d = t1 - t0
        put(t0, lp(noise(d, 900, 0.05) * np.sin(np.pi * tt(d) / d) ** 2, 600))
    # 网格变形的持续音：音高随 |行列式|，压扁到 0 一声闷响
    for t0, t1, N in D["mk"]:
        a0, a1 = t0 - 0.2, (t1 if abs(np.linalg.det(np.array(N))) < 1e-9 else t1 + 0.5)
        ts = np.arange(a0, a1, 1 / SR)
        dd = np.array([abs(np.linalg.det(mat_at(D, x))) for x in np.arange(a0, a1, 0.01)])
        dd = np.interp(ts, np.arange(a0, a1, 0.01)[:len(dd)], dd)
        fr = 65 * (0.6 + 0.4 * np.sqrt(np.minimum(dd, 3.0)))
        ph = 2 * np.pi * np.cumsum(fr) / SR
        e = np.minimum(dd * 2, 1) * np.minimum((ts - a0) / 0.3, 1) * np.minimum((a1 - ts) / 0.3, 1).clip(0)
        put(a0, lp((np.sin(ph) + 0.3 * np.sin(2 * ph)) * 0.035 * e, 500))
    put(b["flat"][1], lp(thump(0.16, 75), 300)); put(b["flat"][1], lp(noise(0.3, 400, 0.05) * np.exp(-tt(0.3) / 0.08), 300))
    for an in D["animals"]:  # 跳：起跳一声、落地一声
        for k, (t0, t1, x0, x1) in enumerate(an["hops"]):
            put(t1, mix(mallet(260, 0.03, 0.04, RS), tick(0.02, 900)))
            if an["kind"] == "rabbit": put(t0, boing(420, 700, 0.12, 0.025))
            if an["kind"] == "duck" and k in (0, 3): put(t0 + 0.05, squeak(0.035))
        for l0, l1 in an["lift"]:
            put(l0 + 0.2 + (0.05 if an["kind"] == "rabbit" else 0), puff(0.07))
            put(l1 + 0.4, tick(0.04, 800)); put(l1 + 0.45, tick(0.04, 700))
    put(b["door"][0], tick(0.05, 1500)); put(b["door"][3], tick(0.06, 1300))
    put(b["duckKey"][1], pencil(0.6, 0.04, 9)); put(b["duckKey"][2], tick(0.05, 2000))
    K = D["sweep"]
    for (ta, ka), (tb, kb) in zip(K, K[1:]):  # 每换一种分法一声，音高随鸡的只数
        n = abs(kb - ka)
        for i in range(1, n + 1):
            k = ka + np.sign(kb - ka) * i
            put(ta + (tb - ta) * (i - 0.5) / n, mallet(330 * 2 ** (k / 24), 0.025, 0.08, RS))
    r0, r1 = b["reach"][:2]
    for i in range(int((r1 - r0) / 0.12)): put(r0 + i * 0.12, tick(0.03, 2600 + 40 * i))
    put(r1, CM.glide(220, 150, 0.4, 0.035))
    put(b["ghost"][0], pencil(0.4, 0.03, 5))
    p0, p1 = b["push"]
    put(p0, lp(noise(p1 - p0, 500, 0.05) * np.sin(np.pi * tt(p1 - p0) / (p1 - p0)) ** 2, 350))
    return tr.buf


def make(D, path):
    m, _ = music(D)
    m = m * 0.5  # 音乐退到动作音之下（约 −6 dB），只作底
    s = sfx(D)
    q0, q1 = D["b"]["quiet"]  # 安静一拍：闷响余音之后的动作音也压低
    tq = np.arange(len(s)) / SR
    s = s * np.where((tq > q0 + 0.35) & (tq < q1), 0.15, 1.0)
    x = m + s
    print("stems rms: music %.4f sfx %.4f" % (np.sqrt(np.mean(m ** 2)), np.sqrt(np.mean(s ** 2))))
    for _ in range(3):  # 归一响度 → 限峰 → 再归一（限峰会略降响度）
        x = limit(x * 10 ** ((-20 - lufs(x)) / 20), 10 ** (-1.8 / 20))
    tp = true_peak(x)
    print("loudness %.2f LUFS, true peak %.2f dBTP" % (lufs(x), tp))
    assert abs(lufs(x) + 20) < 0.1 and tp <= -1.0, "响度或真峰值不达标"
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.repeat(pcm, 2).tobytes())
    print("audio ok", path.name)
