#!/usr/bin/env python3
"""Écart d'empreinte CEF − Electron par scénario ET par processus (médianes des passes valides).

    python3 bench/mesures/ecarts.py <resultats.jsonl> [étiquette CEF] [étiquette Electron]
"""
import json, statistics, sys
from collections import defaultdict

src = sys.argv[1]
cef = sys.argv[2] if len(sys.argv) > 2 else "cef-integ"
ele = sys.argv[3] if len(sys.argv) > 3 else "electron"
ORDER = ["accueil", "hdr10", "dv", "hdr10-plein-ecran", "musique"]
v = defaultdict(lambda: defaultdict(list))
for line in open(src):
    r = json.loads(line)
    if r.get("verrouille"):
        continue
    app, scen, _ = r["etiquette"].split("/")
    if app not in (cef, ele):
        continue
    roles = defaultdict(float)
    helpers = []
    for name, (rss, fp) in r["detail"].items():
        base = name.split("[")[0]
        if "Renderer" in base:
            roles["renderer"] += fp or 0
        elif base in ("Tentacle", "Tentacle TV"):
            roles["principal"] += fp or 0
        else:
            helpers.append(fp or 0)
    helpers.sort(reverse=True)
    roles["gpu"] = helpers[0] if helpers else 0
    roles["autres"] = sum(helpers[1:])
    roles["total"] = r["empreinte_mo"]
    for k, x in roles.items():
        v[(scen, app)][k].append(x)
med = lambda xs: statistics.median(xs) if xs else float("nan")
print("| Scénario | Total CEF / Electron | Écart | principal | GPU | Renderer | autres |")
print("|---|---|---|---|---|---|---|")
for s in ORDER:
    a, b = v[(s, cef)], v[(s, ele)]
    if not a or not b:
        continue
    d = {k: med(a[k]) - med(b[k]) for k in ("total", "principal", "gpu", "renderer", "autres")}
    print(f"| {s} | {med(a['total']):.0f} / {med(b['total']):.0f} | **{d['total']:+.0f}** | "
          f"{d['principal']:+.0f} | {d['gpu']:+.0f} | {d['renderer']:+.0f} | {d['autres']:+.0f} |")
