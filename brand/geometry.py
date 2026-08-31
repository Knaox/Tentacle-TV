"""
Tentacules en SPIRALE, rendus en trait à largeur dégressive.

Le trait est la méthode fiable — aucun offset de contour, donc aucun
retournement possible. Ce qui change ici est la TRAJECTOIRE : chaque bras
s'enroule en vrille. Une spirale ne peut pas se lire comme un tube isolé, la
forme enroulée étant la signature du tentacule.

Seule contrainte à respecter : la décroissance du rayon sur un tour doit rester
supérieure à la largeur du trait, sinon les spires se touchent et l'enroulement
se referme en masse.
"""
import math

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
            u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1])

def arm(base, c1, c2, centre, r0, r1, theta0, turns, cw=True, n_lead=14, n_spin=32):
    """
    Bras complet : une descente en Bézier jusqu'à l'entrée de la spirale, puis
    l'enroulement. `theta0` est l'angle d'entrée, `turns` le nombre de tours.
    """
    sign = 1 if cw else -1
    entry = (centre[0] + r0 * math.cos(theta0), centre[1] + r0 * math.sin(theta0))
    pts = [bez(base, c1, c2, entry, i / n_lead) for i in range(n_lead)]
    for i in range(n_spin + 1):
        s = i / n_spin
        th = theta0 + sign * s * turns * 2 * math.pi
        r = r0 + (r1 - r0) * s
        pts.append((centre[0] + r * math.cos(th), centre[1] + r * math.sin(th)))
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts)

def spire_gap(r0, r1, turns):
    """Jour entre deux spires : sert à vérifier qu'elles ne se touchent pas."""
    return abs(r0 - r1) / max(turns, 1e-6)

def points(base, c1, c2, centre, r0, r1, theta0, turns, cw=True, n_lead=14, n_spin=32):
    """Les mêmes points que `arm`, mais brut — pour en dériver des décalages."""
    sign = 1 if cw else -1
    entry = (centre[0] + r0 * math.cos(theta0), centre[1] + r0 * math.sin(theta0))
    pts = [bez(base, c1, c2, entry, i / n_lead) for i in range(n_lead)]
    for i in range(n_spin + 1):
        s = i / n_spin
        th = theta0 + sign * s * turns * 2 * math.pi
        r = r0 + (r1 - r0) * s
        pts.append((centre[0] + r * math.cos(th), centre[1] + r * math.sin(th)))
    return pts

def offset(pts, w_max, k, towards=None, exponent=1.05):
    """
    Tracé parallèle, décalé proportionnellement à l'épaisseur locale du bras.

    Sert à poser l'arête lumineuse : un dégradé le long du trait ne donne aucune
    rondeur — le relief vient d'une arête plus claire décalée vers un bord.
    L'épaisseur locale suit les paliers du `stroke-dasharray`, que
    `w_max * (1-t)^1.05` approche à moins d'une demi-unité près.
    """
    out = []
    n = len(pts) - 1
    for i, p in enumerate(pts):
        t = i / n
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        norm = math.hypot(tx, ty) or 1e-6
        nx, ny = -ty / norm, tx / norm
        if towards is not None and (towards[0] - p[0]) * nx + (towards[1] - p[1]) * ny < 0:
            nx, ny = -nx, -ny
        d = k * w_max * (1 - t) ** exponent
        out.append((p[0] + nx * d, p[1] + ny * d))
    return out

def to_path(pts):
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts)

def suckers(pts, w_max, towards, count=5, start=0.18, end=0.82, exponent=1.05,
            offset_ratio=0.26, size_ratio=0.32, size_cap=2.6):
    """
    Rangée de ventouses sur la face interne du bras.

    C'est elle qui donne le relief, et non une arête lumineuse : une bande claire
    décalée le long du trait délave le bras au lieu de l'arrondir. Des points
    discrets, échelonnés et décroissants, suffisent à faire lire un volume.
    """
    out, n = [], len(pts) - 1
    for j in range(count):
        t = start + (end - start) * j / max(count - 1, 1)
        i = int(t * n)
        p = pts[i]
        a, b = pts[max(i-1, 0)], pts[min(i+1, n)]
        tx, ty = b[0]-a[0], b[1]-a[1]
        norm = math.hypot(tx, ty) or 1e-6
        nx, ny = -ty/norm, tx/norm
        if (towards[0]-p[0])*nx + (towards[1]-p[1])*ny < 0:
            nx, ny = -nx, -ny
        half = w_max * (1 - t) ** exponent / 2
        r = min(size_cap, max(0.9, half * size_ratio))
        out.append((p[0] + nx * half * offset_ratio, p[1] + ny * half * offset_ratio, r))
    return out
