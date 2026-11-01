"""N7「矩阵」唯一时间源：assets/data/n7-ep<集>.js、assets/sfx/n7-ep<集>.wav、index.html。镜头见 SPEC-上.md / SPEC-下.md。
时间线按字幕排：每条字幕停留 = 阅读时长，动画节拍挂在字幕起点上；段落起点取整到小节线。各段在 ep1_*.py，公用在 core.py。"""
import argparse
import math
import re

import core as K
from core import ANN, ANIMALS, B, BAR, COL, DATA, FLIPS, LEAVES, MATS, PRECT, SFX, SIDE, TRACKS, TX, contrast, read_need, tl
from common import write_js

ap = argparse.ArgumentParser()
ap.add_argument("--ep", type=int, default=1, choices=[1, 2])
ap.add_argument("--no-audio", action="store_true")
ARGS = ap.parse_args()
NAME = f"n7-ep{ARGS.ep}"

if ARGS.ep == 1:
    import ep1_1, ep1_2, ep1_3, ep1_4  # noqa: E401,E402
    ep1_1.run(); ep1_2.run(); ep1_3.run(); ep1_4.run()
    CAM0, LEAF0 = dict(c=[24.0, 0.0], hh=35.0, k=0.0, yaw=0.0, pitch=0.0), [0.0] * len(LEAVES)
else:  # 下集：本子一开始就摊开（封面已翻到左边），每栋楼翻一页
    K.use_leaves([["cover", "e0"], ["e1", "e2"], ["e3", "e4"], ["e5", "e6"], ["e7", "end"]])
    import ep2_3  # noqa: E402
    ep2_3.run()
    CAM0, LEAF0 = dict(ep2_3.C_FLAT), [math.pi] + [0.0] * (len(LEAVES) - 1)
duration = round(math.ceil((tl.t + 0.5) / BAR) * BAR, 3)
for a in ANN:
    if a["t"][1] is None: a["t"][1] = duration
    assert a["page"] in SIDE, a
for a in ANIMALS:
    if a["show"][1] is None: a["show"][1] = duration
    a["lift"] = [[l0, duration + 10 if l1 is None else l1] for l0, l1 in a["lift"]]

# ---- 校验：字幕停留 ≥ 阅读时长且互不重叠；段落起点在小节线上；矩阵、参数轨道、翻页各自不交叠 ----
CAPS = tl.caps
for c in CAPS:
    assert c["t1"] - c["t0"] >= read_need(TX[c["k"]]) - 1e-9, ("字幕停留不足", c["k"])
    assert 96 <= c["box"][0] and c["box"][2] <= 1824, ("字幕出内容区", c["k"], c["box"])
for a, b in zip(CAPS, CAPS[1:]):
    assert b["t0"] >= a["t1"] + 0.1 - 1e-9, ("字幕重叠", a["k"], b["k"])
for k, v in tl.segs.items():
    assert abs(v / BAR - round(v / BAR)) < 2e-3, ("段落起点不在小节线", k)
for name, m in list(MATS.items()) + [(k, v) for k, v in TRACKS.items()]:
    for a, b in zip(m["keys"], m["keys"][1:]):
        assert a[1] <= b[0] + 1e-9, ("关键帧段交叠", name, a, b)
for i in range(len(LEAVES)):
    fl = sorted([f for f in FLIPS if f[0] == i], key=lambda f: f[1])
    for a, b in zip(fl, fl[1:]): assert a[2] <= b[1], ("翻页交叠", i)
assert all(contrast(COL[k], COL["paper"]) >= v - 1e-9 for k, v in K.NEED.items())
print("duration", duration, "segs", {k: round(v, 1) for k, v in tl.segs.items()}, "caps", len(CAPS))

D = dict(name=NAME, ep=ARGS.ep, col=COL, duration=duration, bar=BAR, segs=tl.segs, b=B, cam0=CAM0,
         cam=tl.cams, leaves=LEAVES, leaf0=LEAF0, flips=FLIPS, prect=PRECT, side=SIDE, ann=ANN, animals=ANIMALS,
         mats=MATS, tracks=TRACKS, caps=CAPS, capY=868, liftDur=0.5, pw=K.PW, ph=K.PH, **DATA)
write_js(K.ROOT / f"assets/data/{NAME}.js", "N7", D)
esc = lambda s_: s_.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")  # noqa: E731
divs = []
for i, c in enumerate(CAPS):  # 「」里的词是关键词：红字 + 荧光笔底
    spans = ""
    for part in re.split(r"(「[^」]*」)", TX[c["k"]]):
        chs = "".join(f'<span class="c">{esc(ch)}</span>' for ch in (part[1:-1] if part.startswith("「") else part))
        spans += f'<span class="c">「</span><span class="kw">{chs}</span><span class="c">」</span>' if part.startswith("「") else chs
    pos = "" if c["st"] == "say" else f' style="left: {c["x"]}px; top: {c["y"]}px"'
    tape = '<span class="tape"></span>' if c["st"] == "title" else ""
    divs.append(f'      <div id="cap{i}" class="cap {c["st"]} clip" data-start="{c["t0"]}" data-duration="{round(c["t1"] - c["t0"], 3)}" '
                f'data-track-index="2"{pos}><span class="in">{tape}{spans}</span></div>')
HTML = f"""<!doctype html>
<html lang="zh-CN" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/shared/vendor/gsap/gsap.min.js"></script>
    <script src="assets/data/{NAME}.js"></script>
    <script src="assets/text/zh-CN.js"></script>
    <script type="importmap">{{ "imports": {{ "three": "./assets/shared/vendor/three/three.module.js" }} }}</script>
    <style>
      @font-face {{ font-family: "Noto Sans SC"; src: url("assets/shared/fonts/NotoSansSC-VF.ttf") format("truetype"); font-weight: 100 900; }}
      @font-face {{ font-family: "WenKai"; src: url("assets/shared/fonts/LXGWWenKai-Regular.ttf") format("truetype"); }}
      @font-face {{ font-family: "KMain"; src: url("assets/shared/vendor/katex/fonts/KaTeX_Main-Regular.ttf") format("truetype"); }}
      @font-face {{ font-family: "KMath"; src: url("assets/shared/vendor/katex/fonts/KaTeX_Math-Italic.ttf") format("truetype"); }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: {COL["desk"]}; }}
      #root {{ width: 100%; height: 100%; font-family: "Noto Sans SC", sans-serif; }}
      #stage {{ position: absolute; inset: 0; overflow: hidden; }}
      #gl {{ position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }}
      .cap {{ position: absolute; white-space: nowrap; color: {COL["ink"]}; }}
      .cap .c {{ opacity: 0; }}
      .cap .kw {{ display: inline-block; color: {COL["red"]}; background: linear-gradient(transparent 52%, rgba(244,211,94,.6) 52%, rgba(244,211,94,.6) 90%, transparent 90%) no-repeat;
                 background-size: 0% 100%; padding: 0 2px; }}
      .say {{ left: 0; right: 0; margin: 0 auto; top: {868 - 34}px; width: fit-content; font-size: 52px; line-height: 68px; font-weight: 700; letter-spacing: 2px;
              text-shadow: 0 0 16px rgba(247,243,232,.95), 0 0 6px rgba(247,243,232,.95), 0 0 2px rgba(247,243,232,1); }}
      .note {{ transform: translate(-50%, -50%) rotate(-2.5deg); font-family: "WenKai"; font-size: 50px; line-height: 64px; color: {COL["hand"]};
               text-shadow: 0 0 12px rgba(247,243,232,.95), 0 0 4px rgba(247,243,232,1); }}
      .title {{ transform: translate(-50%, -50%) rotate(-2deg); font-family: "WenKai"; font-size: 110px; line-height: 150px; color: {COL["hand"]}; }}
      .title .in {{ position: relative; display: inline-block; padding: 0 45px; isolation: isolate; }}
      .title .tape {{ position: absolute; inset: 14px 0; background: rgba(250,247,238,.94); box-shadow: 0 6px 18px rgba(43,29,18,.28);
                      border-left: 3px dashed rgba(154,140,118,.5); border-right: 3px dashed rgba(154,140,118,.5); transform-origin: left center; z-index: -1; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{duration:g}" data-width="1920" data-height="1080">
      <div id="stage" class="clip" data-start="0" data-duration="{duration:g}" data-track-index="0" data-layout-allow-overflow>
        <canvas id="gl" width="1920" height="1080"></canvas>
      </div>
{chr(10).join(divs)}
      <audio id="sfx" class="clip" data-start="0" data-duration="{duration:g}" data-track-index="1" data-volume="1" src="assets/sfx/{NAME}.wav"></audio>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      tl.set({{}}, {{}}, window.N7.duration);
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = tl;
    </script>
    <script type="module" src="n7.js"></script>
  </body>
</html>
"""
(K.ROOT / "index.html").write_text(HTML, encoding="utf-8")
print("data ok")
if not ARGS.no_audio:
    import audio  # noqa: E402
    D["sfx"] = SFX
    audio.make(D, K.ROOT / f"assets/sfx/{NAME}.wav")
