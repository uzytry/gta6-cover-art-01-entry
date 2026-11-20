# Generates the four sample "photos" for Neon Shore (app/samples/*.jpg).
# Original flat-illustration scenes drawn procedurally with PIL: no real people,
# no Rockstar artwork, no copied pixels. Run: python3 tools/generate-samples.py
import math
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "app", "samples")
W = H = 1080


def vgrad(size, stops):
    """Vertical gradient image. stops: [(0.0, (r,g,b)), ..., (1.0, (r,g,b))]."""
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                f = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                col = tuple(round(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                break
        else:
            col = stops[-1][1]
        for x in range(w):
            px[x, y] = col
    return img


def glow(base, cx, cy, r, color, steps=24, alpha=110):
    """Soft radial glow: translucent concentric circles on an overlay."""
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for i in range(steps, 0, -1):
        rr = r * i / steps
        a = int(alpha * (1 - i / steps) ** 2)
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color + (a,))
    base.alpha_composite(ov)


def sun_disc(base, cx, cy, r, color):
    d = ImageDraw.Draw(base)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def palm(draw, x, y, s, color, lean=0.0):
    """A palm silhouette: curved trunk + 7 fronds. (x, y) = base of trunk."""
    pts = []
    top_x = x + lean * s
    top_y = y - 1.05 * s
    n = 14
    for i in range(n + 1):
        t = i / n
        pts.append((x + (top_x - x) * t * t + 0.06 * s * math.sin(t * 3),
                    y - (y - top_y) * t))
    draw.line(pts, fill=color, width=max(3, int(0.05 * s)), joint="curve")
    for k in range(7):
        ang = math.pi * (0.08 + 0.13 * k)
        dx = math.cos(ang) * 0.62 * s * (1 if k % 2 == 0 else -1)
        dy = -math.sin(ang) * 0.42 * s
        ex, ey = top_x + dx, top_y + dy
        ctrl_x, ctrl_y = top_x + dx * 0.45, top_y - 0.30 * s
        fr = []
        for i in range(9):
            t = i / 8
            bx = (1 - t) ** 2 * top_x + 2 * (1 - t) * t * ctrl_x + t * t * ex
            by = (1 - t) ** 2 * top_y + 2 * (1 - t) * t * ctrl_y + t * t * ey
            fr.append((bx, by + 0.10 * s * t * t))
        draw.line(fr, fill=color, width=max(3, int(0.035 * s)), joint="curve")


def birds(draw, pts, color):
    for x, y, s in pts:
        draw.arc([x - s, y - s, x, y + s], 200, 340, fill=color, width=4)
        draw.arc([x, y - s, x + s, y + s], 200, 340, fill=color, width=4)


def person(draw, x, y, s, skin, hair, shirt, pants, pose="stand", extra=None):
    """Stylized flat figure, (x, y) = feet centre, s = height in px."""
    head_r = 0.085 * s
    hx, hy = x, y - s + head_r
    # legs
    if pose == "lean":
        draw.line([(x - 0.05 * s, y - 0.48 * s), (x - 0.16 * s, y)],
                  fill=pants, width=int(0.09 * s))
        draw.line([(x + 0.05 * s, y - 0.48 * s), (x + 0.10 * s, y)],
                  fill=pants, width=int(0.09 * s))
    else:
        draw.line([(x - 0.06 * s, y - 0.48 * s), (x - 0.10 * s, y)],
                  fill=pants, width=int(0.10 * s))
        draw.line([(x + 0.06 * s, y - 0.48 * s), (x + 0.12 * s, y)],
                  fill=pants, width=int(0.10 * s))
    # torso
    draw.polygon([(x - 0.16 * s, y - 0.48 * s), (x + 0.16 * s, y - 0.48 * s),
                  (x + 0.11 * s, y - 0.82 * s), (x - 0.11 * s, y - 0.82 * s)],
                 fill=shirt)
    # arms
    if pose == "lean":
        draw.line([(x - 0.13 * s, y - 0.78 * s), (x - 0.34 * s, y - 0.42 * s)],
                  fill=shirt, width=int(0.08 * s))
        draw.line([(x + 0.13 * s, y - 0.78 * s), (x + 0.30 * s, y - 0.50 * s)],
                  fill=skin, width=int(0.07 * s))
    elif pose == "fish":
        draw.line([(x - 0.13 * s, y - 0.78 * s), (x + 0.42 * s, y - 0.95 * s)],
                  fill=skin, width=int(0.07 * s))
        draw.line([(x + 0.13 * s, y - 0.78 * s), (x + 0.38 * s, y - 0.88 * s)],
                  fill=skin, width=int(0.07 * s))
    elif pose == "laugh":
        draw.line([(x - 0.13 * s, y - 0.78 * s), (x - 0.30 * s, y - 0.95 * s)],
                  fill=skin, width=int(0.07 * s))
        draw.line([(x + 0.13 * s, y - 0.78 * s), (x + 0.32 * s, y - 0.60 * s)],
                  fill=skin, width=int(0.07 * s))
    else:
        draw.line([(x - 0.13 * s, y - 0.78 * s), (x - 0.15 * s, y - 0.45 * s)],
                  fill=skin, width=int(0.07 * s))
        draw.line([(x + 0.13 * s, y - 0.78 * s), (x + 0.15 * s, y - 0.45 * s)],
                  fill=skin, width=int(0.07 * s))
    # head + hair
    draw.ellipse([hx - head_r, hy - head_r, hx + head_r, hy + head_r], fill=skin)
    if extra == "longhair":
        draw.pieslice([hx - head_r * 1.25, hy - head_r * 1.3, hx + head_r * 1.25, hy + head_r * 0.6],
                      180, 360, fill=hair)
        draw.polygon([(hx - head_r * 1.1, hy - head_r * 0.2), (hx - head_r * 0.9, hy + head_r * 1.5),
                      (hx - head_r * 0.4, hy + head_r * 1.2)], fill=hair)
        draw.polygon([(hx + head_r * 1.1, hy - head_r * 0.2), (hx + head_r * 0.9, hy + head_r * 1.5),
                      (hx + head_r * 0.4, hy + head_r * 1.2)], fill=hair)
    elif extra == "beard":
        draw.pieslice([hx - head_r, hy - head_r * 0.2, hx + head_r, hy + head_r * 1.1],
                      0, 180, fill=hair)
        draw.pieslice([hx - head_r * 1.05, hy - head_r * 1.15, hx + head_r * 1.05, hy - head_r * 0.1],
                      180, 360, fill=hair)
    elif extra == "buckethat":
        draw.ellipse([hx - head_r * 1.35, hy - head_r * 1.15, hx + head_r * 1.35, hy - head_r * 0.25],
                     fill=(240, 235, 220))
        draw.pieslice([hx - head_r * 0.95, hy - head_r * 1.6, hx + head_r * 0.95, hy - head_r * 0.2],
                      180, 360, fill=(240, 235, 220))
    else:
        draw.pieslice([hx - head_r * 1.05, hy - head_r * 1.15, hx + head_r * 1.05, hy - head_r * 0.1],
                      180, 360, fill=hair)
    return hx, hy, head_r


def skyline(draw, y_base, h_min, h_max, color, windows=True, seed=7):
    import random
    rnd = random.Random(seed)
    x = -20
    while x < W + 20:
        bw = rnd.randint(60, 150)
        bh = rnd.randint(h_min, h_max)
        draw.rectangle([x, y_base - bh, x + bw, y_base], fill=color)
        if rnd.random() < 0.4:
            draw.rectangle([x + bw * 0.3, y_base - bh - 26, x + bw * 0.6, y_base - bh], fill=color)
        if windows:
            for wy in range(y_base - bh + 16, y_base - 12, 26):
                for wx in range(x + 12, x + bw - 12, 24):
                    if rnd.random() < 0.35:
                        draw.rectangle([wx, wy, wx + 10, wy + 14],
                                       fill=(255, 205, 110) if rnd.random() < 0.7 else (140, 240, 255))
        x += bw + rnd.randint(4, 18)


def boulevard():
    img = vgrad((W, H), [(0.0, (43, 16, 85)), (0.45, (232, 93, 117)),
                         (0.72, (254, 180, 123)), (1.0, (60, 20, 60))]).convert("RGBA")
    d = ImageDraw.Draw(img)
    glow(img, 700, 560, 260, (255, 190, 90), alpha=90)
    sun_disc(img, 700, 560, 110, (255, 236, 170))
    # ocean band
    d.rectangle([0, 640, W, 760], fill=(38, 90, 110))
    for i, yy in enumerate(range(650, 758, 14)):
        wdt = 200 + (i % 5) * 90
        d.line([(700 - wdt // 2, yy), (700 + wdt // 2, yy)], fill=(255, 220, 150), width=4)
    # sand + road
    d.rectangle([0, 760, W, H], fill=(32, 16, 44))
    d.polygon([(0, 760), (W, 760), (W, 830), (0, 830)], fill=(214, 164, 120))
    d.line([(0, 985), (W, 985)], fill=(255, 220, 120), width=6)
    for x in range(60, W, 130):
        d.line([(x, 985), (x + 70, 985)], fill=(250, 250, 240), width=8)
    birds(d, [(220, 180, 26), (330, 130, 20), (880, 210, 24)], (40, 16, 60))
    palm(d, 120, 800, 420, (24, 10, 38), lean=0.25)
    palm(d, 990, 790, 360, (24, 10, 38), lean=-0.3)
    # red convertible, side profile
    cx, cy = 300, 930
    d.polygon([(cx - 260, cy), (cx - 210, cy - 42), (cx - 60, cy - 58), (cx + 130, cy - 52),
               (cx + 250, cy - 6), (cx + 260, cy)], fill=(196, 28, 48))
    d.polygon([(cx - 150, cy - 52), (cx - 60, cy - 96), (cx + 40, cy - 96), (cx + 110, cy - 52)],
              fill=(30, 24, 40))
    d.polygon([(cx - 140, cy - 54), (cx - 62, cy - 90), (cx + 30, cy - 90), (cx + 96, cy - 54)],
              fill=(180, 220, 235))
    d.rectangle([cx - 250, cy - 8, cx + 250, cy + 2], fill=(255, 210, 90))
    for wx in (cx - 170, cx + 150):
        d.ellipse([wx - 42, cy - 42, wx + 42, cy + 42], fill=(16, 12, 20))
        d.ellipse([wx - 20, cy - 20, wx + 20, cy + 20], fill=(200, 200, 210))
    d.ellipse([cx + 252, cy - 34, cx + 268, cy - 18], fill=(255, 240, 160))
    # woman leaning on the door
    person(d, 560, 985, 330, (232, 178, 140), (46, 24, 16), (245, 242, 235), (30, 26, 40),
           pose="lean", extra="longhair")
    # sunglasses + gold hoops
    hx, hy, hr = 560, 985 - 330 + 0.085 * 330, 0.085 * 330
    d.rectangle([hx - hr * 0.95, hy - hr * 0.25, hx + hr * 0.95, hy + hr * 0.25], fill=(20, 16, 24))
    d.ellipse([hx - hr * 1.35, hy + hr * 0.35, hx - hr * 0.95, hy + hr * 0.75],
              outline=(255, 205, 80), width=4)
    d.ellipse([hx + hr * 0.95, hy + hr * 0.35, hx + hr * 1.35, hy + hr * 0.75],
              outline=(255, 205, 80), width=4)
    return img.convert("RGB")


def rooftop():
    img = vgrad((W, H), [(0.0, (26, 22, 64)), (0.5, (123, 45, 139)),
                         (0.8, (255, 140, 66)), (1.0, (40, 18, 52))]).convert("RGBA")
    d = ImageDraw.Draw(img)
    glow(img, 540, 610, 220, (255, 170, 90), alpha=80)
    sun_disc(img, 540, 610, 95, (255, 220, 150))
    skyline(d, 700, 120, 300, (30, 16, 52), seed=11)
    skyline(d, 760, 60, 150, (20, 10, 38), seed=23)
    # rooftop floor + parapet
    d.rectangle([0, 760, W, H], fill=(44, 28, 62))
    d.rectangle([0, 760, W, 800], fill=(52, 34, 74))
    d.line([(0, 800), (W, 800)], fill=(255, 150, 90), width=4)
    palm(d, 950, 780, 300, (16, 8, 30), lean=-0.35)
    # man in floral shirt + gold chain
    person(d, 480, 1010, 540, (198, 142, 104), (30, 20, 16), (16, 140, 130), (24, 20, 34),
           pose="stand", extra="beard")
    hx, hy, hr = 480, 1010 - 540 + 0.085 * 540, 0.085 * 540
    # floral dots on shirt
    import random
    rnd = random.Random(5)
    for _ in range(14):
        fx = 480 + rnd.randint(-70, 70)
        fy = 1010 - 540 + rnd.randint(110, 260)
        d.ellipse([fx - 7, fy - 7, fx + 7, fy + 7],
                  fill=(255, 120, 160) if rnd.random() < 0.5 else (255, 220, 120))
    # gold chain
    d.arc([hx - hr * 0.8, hy + hr * 0.9, hx + hr * 0.8, hy + hr * 2.6], 10, 170,
          fill=(255, 205, 80), width=6)
    return img.convert("RGB")


def neon():
    img = Image.new("RGBA", (W, H), (10, 10, 26, 255))
    d = ImageDraw.Draw(img)
    # buildings
    for x, bw, bh, col in [(0, 260, 700, (16, 14, 34)), (300, 300, 820, (20, 16, 40)),
                           (640, 280, 640, (14, 12, 32)), (900, 220, 780, (18, 14, 36))]:
        d.rectangle([x, H - bh, x + bw, H], fill=col)
    # neon signs (glow + core)
    signs = [
        (60, 150, 200, 90, (255, 45, 149)), (330, 90, 230, 70, (45, 226, 255)),
        (700, 180, 180, 80, (255, 214, 64)), (60, 300, 150, 150, (64, 255, 190)),
        (940, 120, 120, 200, (255, 45, 149)), (380, 300, 200, 60, (45, 226, 255)),
    ]
    for x, y, w, h, col in signs:
        glow(img, x + w // 2, y + h // 2, max(w, h) // 2 + 30, col, alpha=70)
        d.rounded_rectangle([x, y, x + w, y + h], radius=14, outline=col, width=8)
        for i in range(3):
            yy = y + 18 + i * (h - 36) // 2
            d.line([(x + 18, yy), (x + w - 18, yy)], fill=col, width=6)
    # wet pavement + reflections
    d.rectangle([0, 800, W, H], fill=(12, 12, 30))
    import random
    rnd = random.Random(9)
    for _ in range(60):
        x = rnd.randint(0, W)
        col = rnd.choice([(255, 45, 149), (45, 226, 255), (255, 214, 64), (64, 255, 190)])
        ln = rnd.randint(40, 150)
        d.line([(x, 820 + rnd.randint(0, 60)), (x, 820 + rnd.randint(0, 60) + ln)],
               fill=col + (0,) if False else col, width=rnd.randint(3, 8))
    # diner awning
    for i in range(8):
        x0 = 700 + i * 48
        d.polygon([(x0, 620), (x0 + 48, 620), (x0 + 40, 680), (x0 + 8, 680)],
                  fill=(255, 45, 149) if i % 2 == 0 else (245, 240, 235))
    # two laughing friends
    person(d, 380, 1010, 400, (232, 178, 140), (30, 18, 12), (255, 214, 64), (28, 24, 44),
           pose="laugh", extra="longhair")
    person(d, 640, 1010, 410, (188, 132, 96), (16, 12, 10), (45, 226, 255), (24, 20, 34),
           pose="laugh", extra=None)
    return img.convert("RGB")


def pier():
    img = vgrad((W, H), [(0.0, (64, 32, 96)), (0.45, (255, 107, 157)),
                         (0.75, (255, 154, 86)), (1.0, (20, 60, 80))]).convert("RGBA")
    d = ImageDraw.Draw(img)
    glow(img, 540, 480, 240, (255, 190, 110), alpha=90)
    sun_disc(img, 540, 480, 100, (255, 238, 175))
    # water
    d.rectangle([0, 560, W, H], fill=(18, 110, 120))
    for i, yy in enumerate(range(580, H, 18)):
        wdt = 160 + (i % 6) * 80
        d.line([(540 - wdt // 2, yy), (540 + wdt // 2, yy)], fill=(255, 220, 150), width=4)
        d.line([(80, yy + 8), (W - 80, yy + 8)], fill=(140, 220, 220), width=2)
    # pier planks in perspective
    d.polygon([(330, H), (750, H), (600, 560), (480, 560)], fill=(122, 82, 52))
    for i in range(9):
        t = i / 8
        y = H - (H - 560) * t * t
        d.line([(330 + (480 - 330) * t, y), (750 + (600 - 750) * t, y)], fill=(90, 58, 36), width=3)
    for t, px in [(0.25, 430), (0.25, 650), (0.6, 500), (0.6, 580)]:
        y = H - (H - 560) * t * t
        d.line([(px, y), (px, y - 46)], fill=(90, 58, 36), width=8)
    # fisherman with bucket hat + rod
    person(d, 545, 620, 210, (210, 164, 120), (200, 200, 200), (245, 242, 235), (40, 36, 44),
           pose="fish", extra="buckethat")
    d.line([(545 + 0.42 * 210, 620 - 0.95 * 210), (880, 300)], fill=(60, 44, 30), width=5)
    d.line([(880, 300), (880, 380)], fill=(220, 220, 210), width=2)
    birds(d, [(250, 200, 22), (820, 160, 18)], (50, 24, 70))
    return img.convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [("boulevard", boulevard), ("rooftop", rooftop), ("neon", neon), ("pier", pier)]
    for name, fn in jobs:
        img = fn()
        path = os.path.join(OUT, f"{name}.jpg")
        img.save(path, "JPEG", quality=88)
        print("wrote", path, img.size, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
