"""N2 背景音乐：程序化合成钢琴 + 柔垫 + 低音，C 大调 70 BPM，16 小节一循环。
环形合成：越过循环终点的余音（含混响尾）折回开头叠加，首尾采样级无缝。输出 assets/bgm/loop.wav。"""
from pathlib import Path
import wave

import numpy as np
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from loopbgm import fold, reverb  # noqa: E402

ROOT = Path(__file__).parent
SR, BPM, BARS = 48000, 70, 16
L = int(round(BARS * 4 * 60 / BPM * SR))
BEAT = L / (BARS * 4)
TAIL = 6 * SR
rng = np.random.default_rng(70)
buf = np.zeros((2, L + TAIL))
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)  # noqa: E731


def put(at_beats, sig, pan=0.0):
    i = int(round(at_beats * BEAT))
    n = min(len(sig), buf.shape[1] - i)
    buf[0, i:i + n] += sig[:n] * np.sqrt(0.5 * (1 - pan))
    buf[1, i:i + n] += sig[:n] * np.sqrt(0.5 * (1 + pan))


def piano(m, beats, vel):
    f, dur = mf(m), beats * BEAT / SR
    n_s = int((dur + 2.5) * SR)
    t = np.arange(n_s) / SR
    base = np.clip(3.2 * (261.6 / f) ** 0.6, 0.6, 5.0)
    sig = np.zeros(n_s)
    for n in range(1, 9):
        fn = n * f * np.sqrt(1 + 0.0004 * n * n)
        if fn > 9000:
            break
        sig += (1 / n) ** 1.4 * (vel ** (0.3 * (n - 1))) * np.sin(2 * np.pi * fn * t + n) * np.exp(-t / (base / n ** 0.8))
    rel = np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.35))
    return vel * sig * np.minimum(t / 0.004, 1) * rel


def pad(ms, beats):
    dur = beats * BEAT / SR
    n_s = int((dur + 2.0) * SR)
    t = np.arange(n_s) / SR
    env = np.minimum(t / 1.4, 1) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.8))
    sig = np.zeros(n_s)
    for m in ms:
        for c in (-5, 0, 5):
            f = mf(m) * 2 ** (c / 1200)
            sig += np.sin(2 * np.pi * f * t + rng.random() * 6.28) + 0.18 * np.sin(4 * np.pi * f * t)
    return 0.012 * sig * env * (1 + 0.15 * np.sin(2 * np.pi * 0.2 * t))


def bass(m, beats, vel):
    dur = beats * BEAT / SR
    t = np.arange(int((dur + 1.0) * SR)) / SR
    f = mf(m)
    env = np.minimum(t / 0.02, 1) * np.exp(-t / 1.8) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.2))
    return vel * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * env


# 和弦：(低音根音, 和弦音 MIDI)
C, G_B, Am, F, G, Em, Dm = ([36, [48, 52, 55, 60]], [35, [47, 50, 55, 59]], [45, [45, 48, 52, 57]], [41, [41, 45, 48, 53]],
                            [43, [43, 47, 50, 55]], [40, [40, 43, 47, 52]], [38, [38, 41, 45, 50]])
PROG = [C, G_B, Am, F, C, G, F, F, Am, Em, F, C, Dm, G, C, G]
# 旋律：每小节 [(拍, MIDI, 拍长)]
MEL = [[(0, 76, 2), (2, 79, 1), (3, 81, 1)], [(0, 79, 3), (3, 74, 1)], [(0, 76, 2), (2, 72, 2)], [(0, 69, 1.5), (1.5, 72, .5), (2, 77, 2)],
       [(0, 76, 1), (1, 79, 1), (2, 84, 2)], [(0, 83, 2), (2, 81, 1), (3, 79, 1)], [(0, 81, 3), (3, 79, 1)], [(0, 77, 2), (2, 76, 2)],
       [(0, 72, 1), (1, 76, 1), (2, 81, 2)], [(0, 79, 3), (3, 76, 1)], [(0, 77, 2), (2, 81, 2)], [(0, 79, 4)],
       [(0, 77, 1), (1, 76, 1), (2, 74, 2)], [(0, 71, 1), (1, 74, 1), (2, 79, 2)], [(0, 76, 2), (2, 74, 1), (3, 72, 1)], [(0, 74, 4)]]
ARP = [0, 1, 2, 3, 2, 1, 2, 1]  # 八分音符分解和弦，取和弦音下标

for bar, ((root, tones), mel) in enumerate(zip(PROG, MEL)):
    b0 = bar * 4
    put(b0, pad(tones[:3] + [tones[0] + 12], 4), 0.0)
    put(b0, bass(root, 2.5, 0.10), 0.0)
    put(b0 + 2, bass(root + 12 if bar % 4 == 3 else root, 1.8, 0.06), 0.0)
    for k, i in enumerate(ARP):
        jitter = 0.015 * rng.random()
        put(b0 + 0.5 * k + jitter, piano(tones[i] + 12, 0.6, 0.05 + 0.015 * (k % 4 == 0)), -0.35)
    for beat, m, ln in mel:
        put(b0 + beat + 0.01 * rng.random(), piano(m, ln * 0.95, 0.16), 0.25)

loop = fold(reverb(buf, rng, SR), L)
loop *= 10 ** (-3 / 20) / np.abs(loop).max()

# 接缝检查：首尾相邻样本差应与片内相邻样本差同量级
d = np.abs(np.diff(loop, axis=1))
seam = np.abs(loop[:, 0] - loop[:, -1]).max()
print(f"loop {L / SR:.3f}s, seam jump {seam:.5f}, in-loop p99 jump {np.percentile(d, 99):.5f}, max {d.max():.5f}")
out = ROOT / "assets/bgm/loop.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((loop.T * 32767).astype("<i2").tobytes())
