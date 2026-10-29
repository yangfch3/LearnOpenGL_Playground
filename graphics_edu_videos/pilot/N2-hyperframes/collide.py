"""N2 逐帧碰撞检查：人、动物不进占地、不出岛、彼此不重叠；镜头不进建筑、不入地。公式与 n2.js 相同。"""
import math

import numpy as np

from layout import LAY, MARKET, footprints
from space import EASE, clamp, inside, path_at, stadium




def cam_at(shots, act, t):
    st = None
    for s in shots:
        if s["t0"] > t:
            break
        if s["k"] == "cut":
            st = (np.array(s["p"], float), np.array(s["l"], float))
        elif s["k"] == "orbit":
            k = EASE[s["e"]](clamp((t - s["t0"]) / (s["t1"] - s["t0"])))
            a, r = math.radians(s["a"][0] + (s["a"][1] - s["a"][0]) * k), s["r"][0] + (s["r"][1] - s["r"][0]) * k
            c = np.array(s["c"], float)
            st = (c + [r * math.cos(a), s["h"][0] + (s["h"][1] - s["h"][0]) * k, r * math.sin(a)], c)
        elif s["k"] == "move":
            k = EASE[s["e"]](clamp((t - s["t0"]) / (s["t1"] - s["t0"])))
            st = (st[0] + (np.array(s["p1"]) - st[0]) * k, st[1] + (np.array(s["l1"]) - st[1]) * k)
        elif s["k"] == "follow":
            x, z, _, _ = path_at(act[s["who"]]["path"], min(t, s["t1"]))
            k = EASE["io2"](clamp((t - s["t0"]) / s["blend"]))
            st = (st[0] + (np.array([x, 0, z]) + s["off"] - st[0]) * k, st[1])
    return st[0]


def shown(wins, t):
    return any(a <= t < b for a, b in wins)


def check(b, act, shots, pines, deer_start, duration, fps=30):
    fp = footprints() + [("circle", x, z, 0.5 * s, 2.6, f"pine{k}") for k, (x, z, s) in enumerate(pines)]
    dx0, dz0 = LAY["dock"]
    dw, dd = LAY["dockSize"][0] / 2, LAY["dockSize"][1] / 2
    on_island = lambda x, z: math.hypot(x, z) < LAY["radius"] - 0.5 or (abs(x - dx0) < dw - 0.2 and abs(z - dz0) < dd - 0.2)  # noqa: E731
    errs = []
    for i in range(int(duration * fps)):
        t = i / fps
        bodies = []  # (名, x, z, 半径)
        for who in ("girl", "postman", "baker", "fisher"):
            a = act[who]
            if shown(a["show"], t):
                x, z, h, _ = path_at(a["path"], t)
                bodies.append((who, x, z, 0.25))
                if who == "postman":
                    bodies.append(("dog", x - math.sin(h) * 1.0, z - math.cos(h) * 1.0, 0.22))
        summer, spring = b["lapse1End"] <= t < b["summerEnd"], b["spring"] <= t < b["lapse1"]
        if summer or spring:
            for k in range(MARKET["n"] if summer else MARKET["spring"]):
                x, z, _ = stadium(MARKET, k * MARKET["P"] / MARKET["n"] + MARKET["v"] * t)
                bodies.append((f"walker{k}", x, z, 0.25))
            if summer:
                bodies += [(f"idle{k}", x, z, 0.25) for k, (x, z, _) in enumerate(MARKET["idle"])]
        if b["winter"] <= t:
            u = t - b["winter"]
            bodies += [(f"deer{i}", x + 0.06 * u, z, 0.45) for i, (x, z) in enumerate(deer_start)]
        for n, x, z, r in bodies:
            exempt = n == "fisher"
            hit = [f[-1] for f in fp if not exempt and inside(f, x, z, r)]
            if hit:
                errs.append(f"t={t:.2f} {n} 进入 {hit[0]}")
            if not on_island(x, z) and n != "fisher":
                errs.append(f"t={t:.2f} {n} 出岛 ({x:.1f}, {z:.1f})")
        for p in range(len(bodies)):
            for q in range(p + 1, len(bodies)):
                (n1, x1, z1, r1), (n2, x2, z2, r2) = bodies[p], bodies[q]
                if math.hypot(x1 - x2, z1 - z2) < r1 + r2 - 0.05:
                    errs.append(f"t={t:.2f} {n1} 与 {n2} 重叠 {math.hypot(x1 - x2, z1 - z2):.2f}m")
        c = cam_at(shots, act, t)
        if c[1] < 0.4 and math.hypot(c[0], c[2]) < LAY["radius"]:
            errs.append(f"t={t:.2f} 镜头入地 y={c[1]:.2f}")
        hit = [f[-1] for f in fp if c[1] < f[-2] and inside(f, c[0], c[2], 0.2)]
        if hit:
            errs.append(f"t={t:.2f} 镜头进入 {hit[0]}")
    return errs

