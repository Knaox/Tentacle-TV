"""Petits outils de dessin : un calque = une encre ; blanc = encre, noir = réserve."""


def A(*els):
    return f'<g fill="white">{"".join(els)}</g>'


def E(*els):
    return f'<g fill="black">{"".join(els)}</g>'


def SA(width, *els, cap="round"):
    return (f'<g fill="none" stroke="white" stroke-width="{width}" stroke-linecap="{cap}" '
            f'stroke-linejoin="round">{"".join(els)}</g>')


def SE(width, *els, cap="round"):
    return (f'<g fill="none" stroke="black" stroke-width="{width}" stroke-linecap="{cap}" '
            f'stroke-linejoin="round">{"".join(els)}</g>')


def T(alpha, *els):
    """Teinte (pour les trames) : une densité partielle."""
    v = int(round(alpha * 255))
    return f'<g fill="rgb({v},{v},{v})">{"".join(els)}</g>'


def c(x, y, r):
    return f'<circle cx="{x}" cy="{y}" r="{r}"/>'


def e(x, y, rx, ry, rot=0):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" transform="rotate({rot} {x} {y})"/>'


def p(d):
    return f'<path d="{d}"/>'


def rect(x, y, w, h, r=0, rot=0):
    cx, cy = x + w / 2, y + h / 2
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" transform="rotate({rot} {cx} {cy})"/>'


FULL = '<rect width="1000" height="1000"/>'


def radial(x, y, r, id_):
    """Dégradé radial blanc → noir, pour une lueur tramée."""
    return (f'<defs><radialGradient id="{id_}" cx="{x}" cy="{y}" r="{r}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient></defs>'
            f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#{id_})"/>')


_uid = [0]


def uid(prefix="u"):
    _uid[0] += 1
    return f"{prefix}{_uid[0]}"


def clipped(shape_els, inner, clip_rule="nonzero"):
    """`inner` dessiné seulement à l'intérieur de `shape_els`."""
    i = uid("cl")
    return (f'<defs><clipPath id="{i}" clip-rule="{clip_rule}">{shape_els}</clipPath></defs>'
            f'<g clip-path="url(#{i})">{inner}</g>')


def lin(x1, y1, x2, y2, stops=((0, 0.0), (1, 1.0))):
    """Rectangle plein cadre rempli d'un dégradé linéaire (densité 0 → 1)."""
    i = uid("lg")
    st = "".join(f'<stop offset="{o}" stop-color="rgb({int(v*255)},{int(v*255)},{int(v*255)})"/>' for o, v in stops)
    return (f'<defs><linearGradient id="{i}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" gradientUnits="userSpaceOnUse">'
            f'{st}</linearGradient></defs><rect width="1000" height="1000" fill="url(#{i})"/>')


def rad(x, y, r, stops=((0, 1.0), (1, 0.0))):
    i = uid("rg")
    st = "".join(f'<stop offset="{o}" stop-color="rgb({int(v*255)},{int(v*255)},{int(v*255)})"/>' for o, v in stops)
    return (f'<defs><radialGradient id="{i}" cx="{x}" cy="{y}" r="{r}" gradientUnits="userSpaceOnUse">'
            f'{st}</radialGradient></defs><rect width="1000" height="1000" fill="url(#{i})"/>')


def shade(shape_els, x1, y1, x2, y2, lo=0.0, hi=1.0):
    """Ombre tramée dans une forme : densité `lo` en (x1,y1) → `hi` en (x2,y2)."""
    return clipped(shape_els, lin(x1, y1, x2, y2, ((0, lo), (1, hi))))


def eye(x, y, r, look=(0.0, 0.0), pupil=0.45, lid=None, lid_ink_rect=None):
    """Un œil : renvoie (blanc à réserver, pupille noire + reflet).
    `look` en fraction du rayon ; la pupille reste dans le blanc."""
    pr = r * pupil
    px, py = x + look[0] * (r - pr) * 0.9, y + look[1] * (r - pr) * 0.9
    white = c(x, y, r)
    pup = c(px, py, pr)
    glint = c(px + pr * 0.35, py - pr * 0.35, max(4, pr * 0.3))
    return white, pup, glint


def lid_cap(x, y, r, a, b, name=None):
    """Paupière : tout ce qui est au-dessus de la droite (x-r-20, y+a)→(x+r+20, y+b), dans l'œil."""
    shape = c(x, y, r + 3)
    cover = p(f"M {x-r-30} {y-r-40} L {x+r+30} {y-r-40} L {x+r+30} {y+b} L {x-r-30} {y+a} Z")
    return clipped(shape, cover)


def _catmull(pts, n=24):
    import math
    pts = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(tuple(pts[-2]))
    return out


def spline(pts, n=24):
    """Chemin lisse passant par les points."""
    s = _catmull(pts, n)
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in s)


def tube(pts, w0, w1, n=24, cap=True):
    """Membre effilé (bras, queue, tentacule) : largeur w0 → w1 le long des points."""
    import math
    s = _catmull(pts, n)
    L, R = [], []
    m = len(s)
    for i, (x, y) in enumerate(s):
        a = s[max(0, i - 1)]
        b = s[min(m - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        w = (w0 + (w1 - w0) * i / (m - 1)) / 2
        L.append((x + nx * w, y + ny * w))
        R.append((x - nx * w, y - ny * w))
    poly = L + R[::-1]
    d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in poly) + " Z"
    out = p(d)
    if cap:
        out += c(s[-1][0], s[-1][1], w1 / 2) + c(s[0][0], s[0][1], w0 / 2)
    return out


def tube_pts(pts, n=24):
    return _catmull(pts, n)


def poly(*pts):
    return p("M " + " L ".join(f"{x} {y}" for x, y in pts) + " Z")


def suckers(pts, w0, w1, side=1, every=3, start=2, scale=0.2, n=24):
    """Ventouses le long d'un tube (côté `side`)."""
    import math
    s = _catmull(pts, n)
    out = []
    m = len(s)
    for i in range(start, m - 2, every):
        a, b = s[i - 1], s[i + 1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d * side, dx / d * side
        w = w0 + (w1 - w0) * i / (m - 1)
        x, y = s[i]
        out.append(c(round(x + nx * w * 0.24, 1), round(y + ny * w * 0.24, 1), round(max(3, w * scale), 1)))
    return "".join(out)


def ring(x, y, r_out, r_in):
    """Anneau (règle evenodd)."""
    return (f'<path fill-rule="evenodd" d="M {x-r_out} {y} a {r_out} {r_out} 0 1 0 {2*r_out} 0 a {r_out} {r_out} 0 1 0 {-2*r_out} 0 '
            f'M {x-r_in} {y} a {r_in} {r_in} 0 1 0 {2*r_in} 0 a {r_in} {r_in} 0 1 0 {-2*r_in} 0 Z"/>')


def capsule(x1, y1, x2, y2, w):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke-width="{w}" stroke-linecap="round" stroke="currentColor"/>')
