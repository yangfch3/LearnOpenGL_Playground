"""N2 岛上静态布局与占地（世界坐标 x、z，y 向上）。build.py 读取并写入 n2.js；collide.py 用占地做检查。"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared/py"))
from space import inside, seg_dist, stadium  # noqa: E402,F401

R = 14.0
GIRL_HOUSE = {"x": -6.5, "z": 1.5, "rot": 0.0, "w": 2.6, "d": 3.0, "h": 2.6}
BAKERY = {"x": 3.4, "z": 7.6, "rot": math.pi, "w": 2.8, "d": 2.2, "h": 1.9}
HOUSES = [[-9.5, -1.5, 0.3], [4.6, -5.2, 1.2], [6.5, -1.0, -0.4], [-4.4, -6.4, 0.8], [8.8, 2.2, 2.0]]


def local_to_world(hs, lx, lz):  # 与 three.js rotation.y 一致
    c, s = math.cos(hs["rot"]), math.sin(hs["rot"])
    return [hs["x"] + lx * c + lz * s, hs["z"] - lx * s + lz * c]


DOOR = local_to_world(GIRL_HOUSE, GIRL_HOUSE["w"] * 0.22, GIRL_HOUSE["d"] / 2)
WIN = local_to_world(GIRL_HOUSE, -GIRL_HOUSE["w"] * 0.22, GIRL_HOUSE["d"] / 2)
BAKER_DOOR = local_to_world(BAKERY, BAKERY["w"] * 0.22, BAKERY["d"] / 2)
STALLS = [[x, 1.4, 0.0] for x in (-1.6, 0.2, 2.0, 3.8)]
MARKET = {"x0": -2.6, "x1": 4.8, "z0": 3.0, "r": 0.45, "n": 10, "v": 0.5, "spring": 5,
          "idle": [[-1.9, 2.4, math.pi], [-1.3, 2.4, math.pi], [0.2, 2.4, math.pi], [1.7, 2.4, math.pi], [2.3, 2.4, math.pi], [3.8, 2.4, math.pi]]}
LAY = {
    "radius": R, "tower": [0, -3], "girlHouse": GIRL_HOUSE, "bakery": BAKERY, "houses": HOUSES,
    "door": [round(v, 4) for v in DOOR], "window": [round(WIN[0], 4), round(GIRL_HOUSE["h"] * 0.58, 4), round(WIN[1], 4)],
    "mailbox": [-6.8, 4.4], "tree": [-8.0, -5.0], "dock": [14.5, 4.2], "dockSize": [4.0, 1.2], "lighthouse": [10.5, -6.5],
    "bridge": [4.0, -9.4], "field": [0.0, -6.2], "fieldSize": [4.4, 3.0], "stalls": STALLS,
    "river": [[-9.0, -9.8], [-6.0, -9.6], [0.0, -9.0], [6.0, -9.6], [8.8, -10.0]],
}
ROAD = [[DOOR[0], 3.4], [-5.2, 5.0], [-3.0, 5.5], [0.0, 5.6], [3.0, 5.6], [7.0, 5.3], [11.0, 4.6], [13.2, 4.3]]


def footprints():
    """占地：('rect', cx, cz, 半宽, 半深, rot, 高, 名) 或 ('circle', cx, cz, r, 高, 名)"""
    fp = [("rect", GIRL_HOUSE["x"], GIRL_HOUSE["z"], GIRL_HOUSE["w"] / 2, GIRL_HOUSE["d"] / 2, 0.0, 4.0, "girlHouse"),
          ("rect", BAKERY["x"], BAKERY["z"], BAKERY["w"] / 2, BAKERY["d"] / 2, BAKERY["rot"], 3.2, "bakery"),
          ("rect", 0, -3, 0.9, 0.9, 0.0, 9.0, "tower"), ("circle", *LAY["lighthouse"], 0.72, 6.5, "lighthouse"),
          ("circle", *LAY["tree"], 0.45, 3.4, "treeTrunk"), ("circle", *LAY["mailbox"], 0.3, 1.6, "mailbox")]
    fp += [("rect", x, z, 1.2, 1.1, r, 3.2, f"house{k}") for k, (x, z, r) in enumerate(HOUSES)]
    fp += [("rect", x, z, 0.7, 0.45, r, 1.6, f"stall{k}") for k, (x, z, r) in enumerate(STALLS)]
    return fp


def make_pines(cams, rng):
    """松树：环带内随机，避开占地、路、河、码头、麦田、集市与镜头位置"""
    out, fx, fz = [], *LAY["field"]
    for _ in range(200):
        a, r = rng.random() * 6.283, 9.0 + rng.random() * 4.0
        x, z, s = r * math.cos(a), r * math.sin(a), 0.6 + rng.random() * 0.6
        if any(inside(f, x, z, 1.0) for f in footprints()) or seg_dist([x, z], ROAD) < 1.6 or seg_dist([x, z], LAY["river"]) < 1.8:
            continue
        if (x > 11 and abs(z - 4.2) < 2.5) or (abs(x - fx) < 3.5 and abs(z - fz) < 2.6) or (-3.5 < x < 6 and 0 < z < 5):
            continue
        if any(math.hypot(x - c[0], z - c[2]) < 2.0 for c in cams) or any(math.hypot(x - p[0], z - p[1]) < 1.3 for p in out):
            continue
        out.append([round(x, 3), round(z, 3), round(s, 3)])
        if len(out) >= 24:
            break
    return out


MARKET["P"] = 2 * (MARKET["x1"] - MARKET["x0"]) + 2 * math.pi * MARKET["r"]
