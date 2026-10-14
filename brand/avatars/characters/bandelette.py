"""Bandelette — Trois mille ans de films à rattraper. Commence par les classiques."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def put_eye(s, x, y, r, look=(0, 0), pupil=0.45):
    w, pu, gl = eye(x, y, r, look=look, pupil=pupil)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)


# ---------------------------------------------------------------- Bandelette
def _band(y, ang, x0=150, x1=850, h=78):
    return rect(x0, y - h / 2, x1 - x0, h, rot=ang)


def ribbon(pts, w, notch=0.6, n=24):
    """Ruban plat de largeur constante, bout coupé en V (`notch` × largeur)."""
    from kit import _catmull
    s_ = _catmull(pts, n)
    L, R = [], []
    for i, (x, y) in enumerate(s_):
        a_, b_ = s_[max(0, i - 1)], s_[min(len(s_) - 1, i + 1)]
        dx, dy = b_[0] - a_[0], b_[1] - a_[1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d * w / 2, dx / d * w / 2
        L.append((x + nx, y + ny))
        R.append((x - nx, y - ny))
    ex, ey = s_[-1]
    a_ = s_[-2]
    dx, dy = ex - a_[0], ey - a_[1]
    d = math.hypot(dx, dy) or 1
    tip = (ex - dx / d * w * notch, ey - dy / d * w * notch)
    ptsx = L + [tip] + R[::-1]
    return p("M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in ptsx) + " Z")


def draw():
    s = Scene()
    s.fill("sun", FULL)
    s.tint("orange", rad(500, 500, 560, ((0, 0.0), (0.5, 0.0), (1, 0.85))), cell=12, angle=15)
    head = p("M 244 590 C 240 350 352 176 500 174 C 648 176 760 350 756 590 C 752 742 650 816 500 818 "
             "C 350 816 248 742 244 590 Z")
    body = p("M 100 1000 C 120 870 220 800 330 784 L 670 784 C 780 800 880 870 900 1000 Z")
    lit = lin(320, 0, 780, 0, ((0, 0.0), (1, 0.38)))
    count = [0]

    def wrap(shape, r, prev, drop, dens=0.7):
        if prev is not None:
            s.tint("brown", T(dens, clipped(shape, clipped(prev, drop))), screen="s", cell=8, angle=45)
        band = clipped(shape, r)
        s.paper(band)
        if count[0] % 2:
            s.tint("sun", T(0.35, band), screen="k", cell=7, angle=10)
        count[0] += 1
        s.tint("brown", clipped(shape, clipped(r, lit)), screen="g", cell=10, angle=45)
        return r

    # Corps emmailloté.
    s.fill("brown", body)
    prev = None
    for y, ang in [(1000, 4), (930, -5), (858, 6)]:
        prev = wrap(body, _band(y, ang, 60, 940, 90), prev, _band(y + 22, ang, 60, 940, 90))
    # Tête : le fond sombre, puis les bandes, du bas vers le haut.
    s.fill("brown", head)
    s.tint("black", T(0.45, head), screen="d", cell=9, angle=30)
    prev = None
    for y, ang in [(776, -5), (708, 6)]:
        prev = wrap(head, _band(y, ang, h=100), prev, _band(y + 24, ang, h=100))
    # La bouche : un petit « o » étonné, dans un jour entre deux bandes.
    s.fill("black", e(476, 630, 34, 38, -6))
    for y, ang in [(548, 7)]:
        prev = wrap(head, _band(y, ang, h=100), prev, _band(y + 24, ang, h=100))
    # L'œil curieux, dans une fente, sous une bande-sourcil relevée.
    s.fill("black", p("M 466 460 C 492 364 652 342 700 414 C 726 466 700 536 616 544 C 540 550 460 524 466 460 Z"))
    put_eye(s, 584, 450, 80, look=(-0.6, -0.5), pupil=0.46)
    s.tint("brown", T(0.75, clipped(c(584, 450, 82), _band(322 + 22, -17, h=100))), screen="s", cell=8, angle=45)
    for y, ang in [(322, -17), (256, 6), (202, -12)]:
        prev = wrap(head, _band(y, ang, h=100), prev, _band(y + 24, ang, h=100))
    # La paupière basse : une bande qui remonte sous l'œil.
    low = _band(512, -4, 230, 530, 84)
    s.paper(clipped(head, low))
    s.tint("brown", clipped(head, clipped(low, lit)), screen="g", cell=10, angle=45)
    # La bandelette qui se défait… et finit en pellicule.
    loose = [(640, 262), (752, 236), (830, 282), (846, 372), (884, 440)]
    rib = ribbon(loose, 78, notch=0.5)
    s.paper(rib)
    s.tint("sun", T(0.35, rib), screen="k", cell=7, angle=10)
    s.tint("brown", clipped(rib, lin(0, 300, 0, 460, ((0, 0.15), (1, 0.6)))), screen="s", cell=8, angle=45)
    return s.layers()
