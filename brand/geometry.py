"""
Tentacules en SPIRALE, rendus en FORMES PLEINES effilées.

Le dessin de 2026-09 (« l'Étreinte » : le poulpe enlace l'écran) abandonne le
rendu en trait à paliers de `stroke-dasharray` : les bras sont désormais des
contours fermés — un spine (Bézier puis spirale) rééchantillonné à pas
constant, décalé de part et d'autre d'une demi-largeur dégressive. Le
retournement de bord qui avait condamné cette voie en 2026-08 venait du
festonnage et des enroulements serrés : sur un contour LISSE, il suffit de
garder la demi-largeur locale sous le rayon de courbure, ce que garantissent
le rééchantillonnage dense et l'effilement (la largeur a déjà fondu à l'entrée
de spire). En formes pleines, l'enroulement peut dépasser le demi-tour
(0,55–0,66 ici) sans que la pointe lise « crochet » — cette limite-là ne
valait que pour le trait.
"""
import math

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
            u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1])

def arm_spine(base, c1, c2, centre, r0, r1, theta0, turns, cw=True,
              n_lead=26, n_spin=44):
    """Spine complet : descente en Bézier vers l'entrée de spirale, puis vrille."""
    sign = 1 if cw else -1
    entry = (centre[0] + r0 * math.cos(theta0), centre[1] + r0 * math.sin(theta0))
    pts = [bez(base, c1, c2, entry, i / n_lead) for i in range(n_lead)]
    for i in range(n_spin + 1):
        s = i / n_spin
        th = theta0 + sign * s * turns * 2 * math.pi
        r = r0 + (r1 - r0) * s
        pts.append((centre[0] + r * math.cos(th), centre[1] + r * math.sin(th)))
    return pts

def resample(pts, step=1.6):
    """Rééchantillonnage à pas constant — l'offset de contour se tord moins."""
    out = [pts[0]]
    acc = 0.0
    for i in range(1, len(pts)):
        x0, y0 = pts[i-1]; x1, y1 = pts[i]
        d = math.hypot(x1-x0, y1-y0)
        while acc + d >= step:
            t = (step - acc) / d
            x0, y0 = x0 + (x1-x0)*t, y0 + (y1-y0)*t
            d = math.hypot(x1-x0, y1-y0)
            out.append((x0, y0))
            acc = 0.0
        acc += d
    out.append(pts[-1])
    return out

def _normals(pts):
    n = len(pts) - 1
    out = []
    for i, p in enumerate(pts):
        a = pts[max(i-1, 0)]; b = pts[min(i+1, n)]
        tx, ty = b[0]-a[0], b[1]-a[1]
        norm = math.hypot(tx, ty) or 1e-6
        out.append((-ty/norm, tx/norm))
    return out

def width_at(t, w_base, w_tip, exponent=1.15):
    """Largeur locale du bras : dégressive de la base vers la pointe."""
    return w_tip + (w_base - w_tip) * ((1 - t) ** exponent)

def tapered(pts, w_base, w_tip=1.5, exponent=1.15):
    """Contour fermé : bord gauche, pointe, bord droit inversé — prêt à `fill`."""
    pts = resample(pts)
    nrm = _normals(pts)
    n = len(pts) - 1
    left, right = [], []
    for i, p in enumerate(pts):
        half = width_at(i / n, w_base, w_tip, exponent) / 2
        nx, ny = nrm[i]
        left.append((p[0] + nx*half, p[1] + ny*half))
        right.append((p[0] - nx*half, p[1] - ny*half))
    poly = left + right[::-1]
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in poly) + " Z"

def suckers(pts, w_base, towards, count=5, start=0.16, end=0.84,
            exponent=1.15, offset_ratio=0.34, size_ratio=0.30, size_cap=2.7):
    """
    Ventouses sur la face tournée vers `towards` — le relief du dessin.
    Une arête lumineuse décalée délave le bras au lieu de l'arrondir ; des
    points discrets, échelonnés et décroissants, suffisent à faire lire un
    volume. Acquis du dessin précédent, conservé tel quel.
    """
    pts = resample(pts)
    nrm = _normals(pts)
    out, n = [], len(pts) - 1
    for j in range(count):
        t = start + (end - start) * j / max(count - 1, 1)
        i = int(t * n)
        p = pts[i]
        nx, ny = nrm[i]
        if (towards[0]-p[0])*nx + (towards[1]-p[1])*ny < 0:
            nx, ny = -nx, -ny
        half = width_at(t, w_base, 1.5, exponent) / 2
        r = min(size_cap, max(0.9, half * size_ratio))
        out.append((p[0] + nx*half*offset_ratio, p[1] + ny*half*offset_ratio, r))
    return out

def mirror_pts(pts, axis=120.0):
    """Miroir vertical d'un spine — la symétrie du dessin s'obtient ici."""
    return [(2*axis - x, y) for x, y in pts]

def spire_gap(r0, r1, turns):
    """Jour entre deux spires : la demi-largeur locale doit rester dessous."""
    return abs(r0 - r1) / max(turns, 1e-6)

def polyline_length(pts):
    """Longueur développée d'une polyligne."""
    return sum(math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1])
               for i in range(len(pts) - 1))
