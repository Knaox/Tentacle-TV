#!/usr/bin/env python3
"""Tableau scénario × app : médiane des passes et écart (min–max), en Markdown.

    python3 bench/mesures/synthese.py ~/.cache/tentacle-cef/build/mesures/resultats.jsonl
"""
import json, statistics, sys
from collections import defaultdict

COLS = [("rss_mo", "RSS Mo", 0), ("empreinte_mo", "Empreinte Mo", 0), ("cpu_pct_coeur", "CPU % cœur", 1),
        ("gpu_app_pct", "GPU app %", 1), ("gpu_windowserver_pct", "GPU WindowServer %", 1),
        ("gpu_sys_actif_pct", "GPU actif % (IOReport)", 1), ("gpu_sys_mw", "GPU mW", 0),
        ("agx_device_util_pct", "AGX util %", 1), ("edr_max", "EDR max", 2)]
ORDER = ["systeme", "accueil", "hdr10", "dv", "hdr10-plein-ecran", "musique"]

rows = defaultdict(list)
for line in open(sys.argv[1]):
    r = json.loads(line)
    if r.get("verrouille"):
        continue  # session verrouillée pendant la fenêtre : rien n'était à l'écran
    app, scen, _ = r["etiquette"].split("/")
    rows[(scen, app)].append(r)


def cell(vals, digits):
    vals = [v for v in vals if v is not None]
    if not vals:
        return "—"
    f = lambda v: f"{v:.{digits}f}".replace(".", ",")
    med = statistics.median(vals)
    return f"{f(med)} ({f(min(vals))}–{f(max(vals))})" if len(vals) > 1 else f(med)


print("| Scénario | App | n | " + " | ".join(c[1] for c in COLS) + " |")
print("|---|---|---|" + "---|" * len(COLS))
for scen in ORDER:
    for app in ["repos"] + sorted(a for (sc, a) in rows if sc == scen and a not in ("repos", "electron")) + ["electron"]:
        rs = rows.get((scen, app))
        if rs:
            print(f"| {scen} | {app} | {len(rs)} | " + " | ".join(cell([r[k] for r in rs], d) for k, _, d in COLS) + " |")
