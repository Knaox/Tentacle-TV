"""Imprimeur risographe : des calques d'encre (SVG, 1000×1000) → une image
« imprimée » — surimpression, grain, bords tremblés, décalage des passages."""
import io, subprocess, hashlib
import numpy as np
from PIL import Image, ImageFilter

INKS = {
    "pink": (255, 72, 176),      # Fluorescent Pink
    "red": (241, 80, 96),        # Bright Red
    "orange": (255, 108, 47),
    "sun": (255, 181, 17),       # Sunflower
    "yellow": (255, 232, 0),
    "green": (0, 169, 92),
    "teal": (0, 131, 138),
    "aqua": (94, 200, 229),
    "blue": (0, 120, 191),
    "fed": (61, 85, 136),        # Federal Blue
    "purple": (118, 91, 167),
    "violet": (157, 122, 210),
    "burgundy": (145, 78, 114),
    "brown": (146, 95, 82),
    "mint": (130, 216, 213),
    "black": (40, 36, 40),
    "peach": (255, 179, 145),
    "lav": (186, 165, 230),
    "cream": (247, 226, 180),
}
PAPER = (246, 240, 228)


def rng_for(name, salt=""):
    h = hashlib.sha256(f"{name}:{salt}".encode()).digest()
    return np.random.default_rng(int.from_bytes(h[:8], "little"))


def render(svg_body, size):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1000 1000">'
           f'<rect width="1000" height="1000" fill="black"/>{svg_body}</svg>')
    png = subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size)], input=svg.encode(),
                         capture_output=True, check=True).stdout
    return np.asarray(Image.open(io.BytesIO(png)).convert("L"), dtype=np.float32) / 255.0


def value_noise(rng, size, cells):
    g = rng.random((cells, cells)).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0


def fbm(rng, size, base, octaves=4):
    out = np.zeros((size, size), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * value_noise(rng, size, base * 2 ** o)
        tot += amp
        amp *= 0.5
    return out / tot


def remap(img, dx, dy):
    h, w = img.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x = np.clip(xx + dx, 0, w - 1.001)
    y = np.clip(yy + dy, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    a = img[y0, x0] * (1 - fx) + img[y0, x0 + 1] * fx
    b = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def blur(a, r):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


def halftone(d, size, angle_deg, cell):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    a = np.deg2rad(angle_deg)
    u = (xx * np.cos(a) + yy * np.sin(a)) * (2 * np.pi / cell)
    v = (-xx * np.sin(a) + yy * np.cos(a)) * (2 * np.pi / cell)
    screen = ((np.cos(u) + np.cos(v)) * 0.25 + 0.5) * 0.94 + 0.03   # 0.03..0.97
    return np.clip((d - (1 - screen)) * 20 + 0.5, 0, 1)


def print_layers(name, layers, size=1024, paper=PAPER, wobble=1.0, grain=1.0, misreg=1.0):
    """layers : liste de (encre, corps SVG, options). Ordre = ordre d'impression."""
    rng = rng_for(name)
    k = size / 1024
    out = np.ones((size, size, 3), np.float32) * (np.array(paper, np.float32) / 255.0)
    # Papier : fibres légères.
    fib = fbm(rng, size, 48, 3)
    out *= (1 - 0.035 * (fib - 0.5))[..., None]
    for idx, (ink, body, opt) in enumerate(layers):
        opt = opt or {}
        m = render(body, size)
        lr = rng_for(name, f"layer{idx}")
        # Bords coupés à la main : une ondulation lente.
        amp = 5.0 * k * wobble * opt.get("wobble", 1.0)
        if amp > 0:
            dx = (fbm(lr, size, 5, 3) - 0.5) * 2 * amp
            dy = (fbm(lr, size, 5, 3) - 0.5) * 2 * amp
            m = remap(m, dx, dy)
        # Passage décalé.
        mr = misreg * opt.get("misreg", 1.0)
        sx, sy = (lr.random(2) - 0.5) * 2 * 6 * k * mr
        m = remap(m, np.full_like(m, -sx), np.full_like(m, -sy))
        if opt.get("screen"):
            m = halftone(m, size, opt.get("angle", 22 + 30 * idx), opt.get("cell", 11) * k)
        # Bavure d'encre : un bord rugueux.
        fine = value_noise(lr, size, int(220 * k) or 1)
        m = np.clip((blur(m, 1.2 * k) - 0.5 + (fine - 0.5) * 0.35) * 5 + 0.5, 0, 1) * (m > 0.01) + 0 * m
        # Encre marbrée, mouchetures sans encre.
        g = grain * opt.get("grain", 1.0)
        mott = fbm(lr, size, 24, 4)
        speck = value_noise(lr, size, int(300 * k) or 1)
        dens = 1 - g * (0.16 * mott + 0.55 * np.clip((speck - 0.86) * 8, 0, 1))
        d = m * np.clip(dens, 0, 1) * opt.get("density", 1.0)
        col = np.array(INKS[ink], np.float32) / 255.0
        out *= 1 - d[..., None] * (1 - col)
    return np.clip(out, 0, 1)


def save(arr, path, out_size=512, circle_preview=False):
    im = Image.fromarray((arr * 255).astype(np.uint8), "RGB").resize((out_size, out_size), Image.LANCZOS)
    if circle_preview:
        mask = Image.new("L", (out_size * 4, out_size * 4), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).ellipse((0, 0, out_size * 4 - 1, out_size * 4 - 1), fill=255)
        mask = mask.resize((out_size, out_size), Image.LANCZOS)
        bg = Image.new("RGB", (out_size, out_size), (14, 12, 22))
        bg.paste(im, (0, 0), mask)
        im = bg
    im.save(path)
    return im
