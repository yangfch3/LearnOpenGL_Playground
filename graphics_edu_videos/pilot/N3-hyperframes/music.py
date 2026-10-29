"""N3 背景音乐：F 大调 3/4 拍 80 BPM，整曲按镜头写，不循环。钢琴、音乐盒、柔垫、低音。"""
import numpy as np

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from loopbgm import reverb  # noqa: E402

mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)  # noqa: E731

# 和弦（低音, 和弦音）与各段：(起始小节, 和弦表, 旋律[(拍, 音, 拍长)], 乐器)
F, C_E, Dm, Bb, C, Am, Gm, F_A, F_C = ([41, [53, 57, 60]], [40, [52, 55, 60]], [38, [50, 53, 57]], [34, [46, 50, 53]], [36, [48, 52, 55]],
                                      [45, [52, 57, 60]], [43, [50, 55, 58]], [45, [53, 57, 60]], [36, [53, 57, 60]])
SECTIONS = [
    (0, [F, C_E], [[(0, 81, 3)], [(0, 79, 3)]], "intro"),
    (2, [F, C_E, Dm, Bb, C], [[(0, 69, 2), (2, 72, 1)], [(0, 67, 1), (1, 64, 1), (2, 67, 1)], [(0, 65, 2), (2, 69, 1)], [(0, 74, 3)], [(0, 72, 1), (1, 70, 1), (2, 67, 1)]], "spring"),
    (7, [F, C_E, Dm, Bb, C], [[(0, 81, 1), (1, 77, 1), (2, 72, 1)], [(0, 79, 1.5), (1.5, 76, 0.5), (2, 72, 1)], [(0, 77, 1), (1, 74, 1), (2, 69, 1)], [(0, 74, 1), (1, 77, 1), (2, 82, 1)], [(0, 81, 2), (2, 79, 1)]], "summer"),
    (12, [Dm, Bb, F, Gm, C], [[(0, 69, 2), (2, 65, 1)], [(0, 70, 1), (1, 74, 1), (2, 72, 1)], [(0, 69, 3)], [(0, 67, 1), (1, 70, 1), (2, 74, 1)], [(0, 72, 2), (2, 70, 1)]], "autumn"),
    (17, [Dm, Am, Bb, F_A, Gm, C], [[(0, 81, 3)], [(0, 76, 3)], [(0, 77, 2), (2, 74, 1)], [(0, 72, 3)], [(0, 74, 1.5), (1.5, 70, 1.5)], [(0, 72, 1), (1, 76, 1), (2, 79, 1)]], "winter"),
    (23, [F, C_E, Dm, F_C, Bb, F_A, Gm, C], [[(0, 69, 2), (2, 72, 1)], [(0, 67, 1), (1, 64, 1), (2, 67, 1)], [(0, 65, 2), (2, 69, 1)], [(0, 72, 3)], [(0, 74, 2), (2, 77, 1)],
                                            [(0, 76, 1), (1, 77, 1), (2, 81, 1)], [(0, 82, 2), (2, 79, 1)], [(0, 79, 1), (1, 77, 1), (2, 76, 1)]], "grow"),
    (31, [Bb, F_A, Gm, C, F, F], [[(0, 77, 3)], [(0, 76, 2), (2, 72, 1)], [(0, 74, 2), (2, 70, 1)], [(0, 72, 1), (1, 74, 1), (2, 76, 1)], [(0, 77, 3)], [(0, 81, 3)]], "photo"),
]


def compose(bar_s, duration, sr, out_path, seed=80):
    import wave
    rng, beat = np.random.default_rng(seed), bar_s / 3
    buf = np.zeros((2, int((duration + 6) * sr)))

    def put(at, sig, pan=0.0):
        i = int(round(at * sr)); n = min(len(sig), buf.shape[1] - i)
        buf[0, i:i + n] += sig[:n] * np.sqrt(0.5 * (1 - pan)); buf[1, i:i + n] += sig[:n] * np.sqrt(0.5 * (1 + pan))

    def piano(m, dur, vel):
        f, t = mf(m), np.arange(int((dur + 2.5) * sr)) / sr
        base, sig = np.clip(3.2 * (261.6 / f) ** 0.6, 0.6, 5.0), 0
        for n in range(1, 8):
            if n * f > 9000: break
            sig = sig + (1 / n) ** 1.4 * vel ** (0.3 * (n - 1)) * np.sin(2 * np.pi * n * f * np.sqrt(1 + 0.0004 * n * n) * t + n) * np.exp(-t / (base / n ** 0.8))
        return vel * sig * np.minimum(t / 0.004, 1) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.35))

    def mbox(m, vel):  # 音乐盒：音叉式泛音、短衰减
        f, t = mf(m), np.arange(int(2.2 * sr)) / sr
        return vel * (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.7) + 0.3 * np.sin(2 * np.pi * 4.07 * f * t) * np.exp(-t / 0.12)) * np.minimum(t / 0.002, 1)

    def pad(ms, dur, amp):
        t = np.arange(int((dur + 1.5) * sr)) / sr
        env = np.minimum(t / 0.9, 1) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.6))
        return amp * env * sum(np.sin(2 * np.pi * mf(m) * 2 ** (c / 1200) * t + rng.random() * 6.28) for m in ms for c in (-6, 0, 6))

    def bass(m, dur, vel):
        t = np.arange(int((dur + 0.8) * sr)) / sr
        return vel * (np.sin(2 * np.pi * mf(m) * t) + 0.25 * np.sin(4 * np.pi * mf(m) * t)) * np.minimum(t / 0.015, 1) * np.exp(-t / 1.4) * np.where(t < dur, 1, np.exp(-(t - dur) / 0.2))

    # 各段配器：旋律乐器、旋律力度、伴奏型、柔垫音量
    STY = {"intro": ("mbox", 0.10, "arp", 0.0), "spring": ("piano", 0.15, "waltz", 0.005), "summer": ("both", 0.15, "waltz+", 0.004),
           "autumn": ("piano", 0.13, "arp", 0.008), "winter": ("mbox", 0.11, "none", 0.009), "grow": ("piano", 0.17, "waltz+", 0.009), "photo": ("mbox", 0.11, "arp", 0.006)}
    for b0, chords, mel, name in SECTIONS:
        inst, mv, acc, pv = STY[name]
        for k, ((root, tones), notes) in enumerate(zip(chords, mel)):
            t0 = (b0 + k) * bar_s
            if b0 + k >= 36 or t0 >= duration: dur_bar = 3.0
            else: dur_bar = 1.0
            grow = (k / len(chords)) if name == "grow" else 0
            if pv: put(t0, pad(tones + [tones[0] + 12], bar_s * dur_bar, pv * (1 + 0.8 * grow)))
            if acc.startswith("waltz"):
                put(t0, bass(root, beat * 1.6, 0.10 + 0.04 * grow))
                for j in (1, 2): put(t0 + j * beat + 0.01 * rng.random(), piano(tones[j % 3] + 12, beat * 0.6, 0.05 + 0.02 * grow), -0.35)
                if acc == "waltz+":
                    for j in range(6): put(t0 + j * beat / 2, piano(tones[(j * 2) % 3] + 24, 0.2, 0.025), 0.4)
            elif acc == "arp":
                if name != "intro": put(t0, bass(root, beat * 2.5, 0.07))
                for j in range(6): put(t0 + j * beat / 2 + 0.01 * rng.random(), (mbox if name != "autumn" else lambda m, v: piano(m, 0.3, v))(tones[[0, 1, 2, 1, 2, 1][j]] + 12 + (12 if name != "autumn" else 0), 0.04), -0.3)
            elif name == "winter":
                put(t0, bass(root, bar_s * 0.9, 0.05))
            for bt, m, ln in notes:
                at = t0 + bt * beat + 0.008 * rng.random()
                if inst in ("piano", "both"): put(at, piano(m, ln * beat * 0.95, mv), 0.2)
                if inst in ("mbox", "both"): put(at, mbox(m + (12 if inst == "both" else 0), mv * (0.5 if inst == "both" else 1)), 0.25)
    # 结尾：主和弦与音乐盒上行
    tEnd = 36 * bar_s
    for j, m in enumerate([77, 81, 84, 89]): put(tEnd + j * beat * 0.5, mbox(m, 0.06), 0.2)
    put(tEnd, pad([53, 57, 60, 65], 3.0, 0.006))
    mix = reverb(buf, rng, sr, decay=1.0, dur=3.6, dry=0.7, wet=0.55)[:, :int(duration * sr)]
    t = np.arange(mix.shape[1]) / sr
    mix *= np.minimum(t / 1.5, 1) * np.minimum((duration - t) / 1.2, 1)
    mix *= 10 ** (-3 / 20) / np.abs(mix).max()
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((mix.T * 32767).astype("<i2").tobytes())
