"""探针共用：文本表读取、阅读时长、程序化音效、WAV 写出。"""
import json
import re
import wave
from pathlib import Path

import numpy as np

SR, FPS = 48000, 60


def load_text(path):
    src = Path(path).read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.TEXT = (\{.*\});", src, re.S).group(1))


def read_need(s):
    n = len(re.findall(r"[\u4e00-\u9fff]", s)) + len(re.findall(r"[A-Za-z0-9_.]+", s))
    return max(2.0, 1.0 + 0.25 * n)


def mallet(f, amp, decay, rng):
    dur = decay * 5
    tt = np.arange(int(dur * SR)) / SR
    sig = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / decay)
           + 0.35 * np.sin(2 * np.pi * 3.93 * f * tt) * np.exp(-tt / (decay * 0.3))
           + 0.1 * np.sin(2 * np.pi * 9.2 * f * tt) * np.exp(-tt / (decay * 0.12)))
    sig += 0.15 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.002)
    return amp * sig * np.minimum(tt / 0.001, 1) * np.minimum((dur - tt) / 0.03, 1)


def thump(amp, f0=90):
    tt = np.arange(int(0.25 * SR)) / SR
    return amp * np.sin(2 * np.pi * (f0 - 40 * tt) * tt) * np.exp(-tt / 0.06)


def sweep(f0, f1, dur, amp):
    tt = np.arange(int(dur * SR)) / SR
    ph = 2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (tt / dur)) / SR
    return amp * np.sin(ph) * np.sin(np.pi * tt / dur) ** 2


class Track:
    def __init__(self, duration):
        self.buf = np.zeros(int(duration * SR))

    def place(self, at, sig):
        i = int(round((at + 1 / FPS) * SR))  # 声音晚画面 1 帧
        self.buf[i:i + len(sig)] += sig[:max(0, len(self.buf) - i)]

    def write(self, path):
        buf = self.buf * (0.5 / np.abs(self.buf).max())  # 峰值 -6 dBFS
        pcm = (buf * 32767).astype("<i2")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(path), "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(np.repeat(pcm, 2).tobytes())


def write_js(path, name, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(f"window.{name} = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")


def read_js(path, name):
    src = Path(path).read_text(encoding="utf-8")
    return json.loads(re.search(rf"window\.{name} = (.*);", src, re.S).group(1))


def set_duration(html, duration):
    p = Path(html)
    p.write_text(re.sub(r'data-duration="[\d.]+"', f'data-duration="{duration:g}"', p.read_text(encoding="utf-8")), encoding="utf-8")
