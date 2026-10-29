"""N4 背景音乐：C 大调 80 BPM 4/4，一个主题贯穿。音色随季节升级（方波 → 马林巴 → 加混响与钢琴 → 钢琴与弦垫），
整轨再按画面分辨率做采样保持与比特量化（build.py 的 crush），春天与结尾听上去也是「低分辨率」的。"""
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from loopbgm import reverb  # noqa: E402

mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)  # noqa: E731
# 主题：4 小节，(拍, MIDI, 拍长)；和弦 C Am F G
THEME = [(0, 76, 1), (1, 79, 1), (2, 81, 1), (3, 79, 1), (4, 76, 2), (6, 74, 1), (7, 72, 1),
         (8, 77, 1), (9, 81, 1), (10, 84, 1), (11, 81, 1), (12, 79, 3)]
THEME2 = [(0, 76, 1), (1, 79, 1), (2, 84, 1), (3, 83, 1), (4, 81, 2), (6, 79, 1), (7, 76, 1),
          (8, 77, 1), (9, 76, 1), (10, 74, 1), (11, 71, 1), (12, 72, 3)]
CHORDS = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])]


def compose(bar, duration, sr, beats, out_path, crush, seed=4):
    rng, bt = np.random.default_rng(seed), bar / 4
    n = int((duration + 6) * sr)
    dry, wet = np.zeros((2, n)), np.zeros((2, n))

    def put(at, sig, pan=0.0, rv=0.0):
        i = int(round(at * sr)); k = min(len(sig), n - i)
        if k <= 0: return
        for ch, g in ((0, np.sqrt(0.5 * (1 - pan))), (1, np.sqrt(0.5 * (1 + pan)))):
            dry[ch, i:i + k] += sig[:k] * g * (1 - 0.5 * rv); wet[ch, i:i + k] += sig[:k] * g * rv

    T = lambda d: np.arange(int(d * sr)) / sr  # noqa: E731
    def square(m, d, v, duty=0.5):
        t = T(d + 0.05); ph = (mf(m) * t) % 1.0
        return v * np.where(ph < duty, 1.0, -1.0) * np.minimum(t / 0.004, 1) * np.where(t < d, 1.0, np.exp(-(t - d) / 0.02)) * 0.35
    def marimba(m, v):
        t, f = T(1.4), mf(m)
        return v * (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35) + 0.25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05)) * np.minimum(t / 0.002, 1)
    def piano(m, d, v):
        f, t = mf(m), T(d + 2.2); sig = 0
        for h in range(1, 7):
            sig = sig + (1 / h) ** 1.5 * np.sin(2 * np.pi * h * f * np.sqrt(1 + 0.0004 * h * h) * t + h) * np.exp(-t / (2.4 / h ** 0.8))
        return v * sig * np.minimum(t / 0.004, 1) * np.where(t < d, 1.0, np.exp(-(t - d) / 0.4))
    def pad(ms, d, a):
        t = T(d + 1.5); env = np.minimum(t / 1.2, 1) * np.where(t < d, 1.0, np.exp(-(t - d) / 0.8))
        return a * env * sum(np.sin(2 * np.pi * mf(m) * 2 ** (c / 1200) * t + rng.random() * 6.28) for m in ms for c in (-7, 0, 7))

    def phrase(t0, inst, theme=THEME, v=0.12, acc=True, rv=0.0, oct=0):
        for k, (b0, m, ln) in enumerate(theme):
            at, d, mm = t0 + b0 * bt, ln * bt * 0.92, m + oct
            if inst == "sq": put(at, square(mm, d, v, 0.25 if k % 4 == 0 else 0.5), 0.1)
            elif inst == "mar": put(at, marimba(mm, v * 1.2), 0.15, rv)
            elif inst == "pno": put(at, piano(mm, d, v), 0.15, rv)
        if not acc: return
        for j, (root, tones) in enumerate(CHORDS):
            cb = t0 + j * bar
            if inst == "sq":
                for q in range(8): put(cb + q * bt / 2, square(tones[q % 3], bt * 0.4, v * 0.35), -0.3)
                put(cb, square(root, bar * 0.9, v * 0.5, 0.5), 0)
            elif inst == "mar":
                put(cb, piano(root, bar * 0.5, v * 0.6), 0, rv)
                for q in (1, 2, 3): put(cb + q * bt, marimba(tones[q % 3], v * 0.45), -0.35, rv)
            else:
                put(cb, piano(root - 12 * (inst == "pno"), bar * 0.9, v * 0.55), -0.1, rv)
                put(cb, pad(tones, bar, 0.006 + 0.004 * (rv > 0.5)), 0, 1.0)
                for q in (1.5, 2.5): put(cb + q * bt, piano(tones[int(q) % 3] + 12, bt, v * 0.3), -0.4, rv)

    B = beats
    # 春：开场一小节只有心跳般的低音；分辨率开始翻倍时主题进来
    for q in range(4): put(q * bt, square(36, 0.08, 0.06), 0)
    phrase(B["r32"], "sq", v=0.11); phrase(B["r32"] + 4 * bar, "sq", THEME2, v=0.12)
    phrase(B["vec"], "mar", v=0.12); phrase(B["vec"] + 4 * bar, "mar", THEME2, v=0.13)
    phrase(B["s2a"] + 0.6, "pno", v=0.11, rv=0.45); phrase(B["s2a"] + 0.6 + 4 * bar, "pno", THEME2, v=0.1, rv=0.55)
    t_w = B["s3a"] + 0.2
    phrase(t_w, "pno", v=0.09, rv=0.75, oct=-12); phrase(t_w + 4 * bar, "pno", THEME2, v=0.11, rv=0.75)
    phrase(B["melt0"] - bar, "pno", THEME2, v=0.1, rv=0.6)
    put(B["title0"] + bar, pad([48, 60, 64, 67, 72], 3.2, 0.008), 0, 1.0)
    put(B["title0"] + bar, piano(84, 2.0, 0.07), 0.2, 0.8)
    mix = dry + reverb(wet, rng, sr, decay=1.3, dur=4.0, dry=0.0, wet=1.0)
    mix = mix[:, :int(duration * sr)]
    mix = crush(mix * (0.7 / np.abs(mix).max()))
    t = np.arange(mix.shape[1]) / sr
    mix *= np.minimum((duration - t) / 1.5, 1).clip(0)
    mix *= 10 ** (-3 / 20) / np.abs(mix).max()
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((mix.T * 32767).astype("<i2").tobytes())
