"""C 唯一参数源：三层校验图案位置与节拍 → assets/data/c.js；并生成中层（OpenGL）与上层（Manim）透明片段。
用法：uv run python pilot/C-hyperframes/build.py [--skip-clips]"""
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
PILOT = ROOT.parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import set_duration, write_js  # noqa: E402

DURATION, FPS = 10.0, 60
CALIB = {"hf": [120, 880], "gl": [720, 880], "manim": [1320, 880]}  # 色块左上角；条码在其右 100px 起，8 格 × 32px
data = {"duration": DURATION, "fps": FPS, "calib": CALIB, "block": 80, "bit": 24, "bitStep": 32, "bitX": 100, "bitY": 28,
        "pFadeAt": 2.0, "pFadeDur": 0.5, "pPos": [1600, 400]}
write_js(ROOT / "assets/data/c.js", "C", data)
(ROOT / "assets/data/c.json").write_text(json.dumps(data), encoding="utf-8")
set_duration(ROOT / "index.html", DURATION)

if "--skip-clips" not in sys.argv:
    clips = ROOT / "assets/clips"
    clips.mkdir(parents=True, exist_ok=True)
    png = ["-c:v", "png", "-pix_fmt", "rgba"]  # MOV 内 PNG：无损 RGBA，体积约 qtrle 的 1/4.5；VP9 alpha、ProRes 4444 色块差超 2
    t0 = time.time()
    gl = subprocess.Popen([str(PILOT / "P3-opengl/build/p3gl.exe"), "--to", str(DURATION), "--calib", *map(str, CALIB["gl"])],
                          stdout=subprocess.PIPE)
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "1920x1080", "-r", str(FPS),
                    "-i", "-", *png, str(clips / "gl.mov")], stdin=gl.stdout, check=True)
    gl.wait()
    t1 = time.time()
    media = PILOT.parent / "Temp/manim/C"
    subprocess.run(["cmd", "/c", str(PILOT.parent / "tools/manim.cmd"), "-qh", "-t", "--disable_caching", "--media_dir", str(media),
                    str(ROOT / "manim_layer.py"), "Top"], check=True, capture_output=True)
    mov = next(media.rglob("Top.mov"))
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", str(mov), *png, str(clips / "manim.mov")], check=True)
    print(f"clips: gl {t1 - t0:.1f}s, manim {time.time() - t1:.1f}s")
