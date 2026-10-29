"""P3 唯一参数源：球网格与光照参数，写 assets/data/p3.js（WebGPU）与 ../P3-opengl/p3_params.h（原生 OpenGL）。"""
import math
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from common import set_duration, write_js  # noqa: E402

SECTORS, STACKS = 64, 32
P = {"duration": 15.0, "orbitEnd": 12.0, "objectColor": [1.0, 0.5, 0.31], "lightColor": [1.0, 1.0, 1.0],
     "ambient": 0.1, "diffuse": 1.0, "specular": 0.5, "shininess": 32.0,
     "eye": [0.0, 0.8, 4.0], "fov": 45.0, "near": 0.1, "far": 100.0,
     "lightR": 2.0, "lightY": 0.8, "lightScale": 0.08, "width": 1920, "height": 1080, "fps": 60}

# UV 球：顶点即法线（半径 1）
verts, idx = [], []
for i in range(STACKS + 1):
    phi = math.pi / 2 - i * math.pi / STACKS
    for j in range(SECTORS + 1):
        th = j * 2 * math.pi / SECTORS
        verts += [round(math.cos(phi) * math.cos(th), 7), round(math.sin(phi), 7), round(math.cos(phi) * math.sin(th), 7)]
for i in range(STACKS):
    for j in range(SECTORS):
        a, b = i * (SECTORS + 1) + j, (i + 1) * (SECTORS + 1) + j
        if i != 0:
            idx += [a, b, a + 1]
        if i != STACKS - 1:
            idx += [a + 1, b, b + 1]

write_js(ROOT / "assets/data/p3.js", "P3", {**P, "verts": verts, "idx": idx})
set_duration(ROOT / "index.html", P["duration"])

h = ["// 由 pilot/P3-webgpu/build.py 生成，勿手改", "#pragma once"]
fl = lambda x: f"{float(x)}f"  # noqa: E731
for k, v in P.items():
    h.append(f"constexpr float P3_{k}{'[]' if isinstance(v, list) else ''} = {('{' + ', '.join(map(fl, v)) + '}') if isinstance(v, list) else fl(v)};")
h.append(f"constexpr float P3_verts[] = {{{', '.join(f'{x}f' for x in verts)}}};")
h.append(f"constexpr unsigned P3_idx[] = {{{', '.join(map(str, idx))}}};")
(ROOT.parent / "P3-opengl").mkdir(exist_ok=True)
(ROOT.parent / "P3-opengl/p3_params.h").write_text("\n".join(h) + "\n", encoding="utf-8")
print("verts", len(verts) // 3, "tris", len(idx) // 3)
