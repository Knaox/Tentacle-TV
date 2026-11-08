#!/usr/bin/env python3
"""Résumé d'une passe du banc HDR : par fichier lu, headroom EDR mesuré par la sonde externe
pendant la lecture (hors 1re seconde), paramètres mpv et état de la couche.

Usage : summarize.py <journal banc> <journal sonde> [<stderr du banc>]
"""
import json
import sys
from datetime import datetime


def ts(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S.%f").timestamp()


def load_probe(path):
    out = []
    for line in open(path):
        parts = line.split()
        if len(parts) >= 3 and parts[2].startswith("edr="):
            out.append((ts(parts[0]), float(parts[2][4:])))
    return out


def segments(path):
    """Découpe le journal du banc : référence (départ → 1er loadfile), puis un segment par
    fichier (loadfile → loadfile suivant / fin). Garde aussi la marge EDR lue dans le banc."""
    segs, cur, inproc = [], None, []
    for line in open(path):
        stamp, kind, payload = line.rstrip("\n").split(" ", 2)
        t, data = ts(stamp), json.loads(payload.replace(":nan", ":null"))
        if kind == "edr-inproc":
            inproc.append((t, data["edr"]))
            continue
        if kind == "start":
            cur = {"file": "(référence : fenêtre noire, sans vidéo)", "start": t, "end": None,
                   "restart": t - 1.0, "vp": None, "vtp": None, "surface": [], "resizes": 0}
            segs.append(cur)
            continue
        if kind == "loadfile":
            if cur:
                cur["end"] = t
            cur = {"file": data["file"].rsplit("/", 1)[-1], "start": t, "end": None,
                   "restart": None, "vp": None, "vtp": None, "surface": [], "resizes": 0}
            segs.append(cur)
        elif cur is None:
            continue
        elif kind == "event" and data.get("name") == "playback-restart" and not cur["restart"]:
            cur["restart"] = t
        elif kind == "video-params" and data.get("gamma"):
            cur["vp"] = data
        elif kind == "video-target-params" and data.get("gamma"):
            cur["vtp"] = data
        elif kind == "surface":
            cur["surface"].append(data)
        elif kind == "resize":
            cur["resizes"] += 1
        cur["last"] = t
    if cur:
        cur["end"] = cur["end"] or cur.get("last")
    return segs, inproc


MTL_FORMATS = {"80": "BGRA8Unorm", "81": "BGRA8Unorm_sRGB", "90": "RGB10A2Unorm",
               "94": "BGR10A2Unorm", "115": "RGBA16Float", "554": "BGR10_XR"}


def pick(d, keys):
    return {k: d[k] for k in keys if d and k in d} if d else None


def main():
    probe = load_probe(sys.argv[2])
    segs, inproc = segments(sys.argv[1])
    for s in segs:
        t0 = (s["restart"] or s["start"]) + 1.0
        print(f"== {s['file']}")
        for name, series in (("sonde externe", probe), ("dans le banc ", inproc)):
            vals = [v for t, v in series if t0 <= t <= (s["end"] or t0)]
            if vals:
                print(f"   EDR {name} : min={min(vals):.2f} max={max(vals):.2f} "
                      f"médiane={sorted(vals)[len(vals)//2]:.2f} ({len(vals)} éch.)")
            else:
                print(f"   EDR {name} : aucun échantillon")
        keys = ("pixelformat", "hw-pixelformat", "primaries", "gamma", "max-luma", "max-cll", "sig-peak")
        print(f"   video-params        : {pick(s['vp'], keys + ('colormatrix',))}")
        print(f"   video-target-params : {pick(s['vtp'], keys + ('w', 'h'))}")
        for st in s["surface"]:
            if "colorspace" not in st:
                print(f"   couche[{st['when']}] : (aucune)")
                continue
            print(f"   couche[{st['when']}] : {st['colorspace'] or 'nil'} {MTL_FORMATS.get(st['pixelFormat'], st['pixelFormat'])} "
                  f"EDR={st['wantsEDR']} meta={st['edrMetadata']} {st['px']}")
        if s["resizes"]:
            print(f"   redimensionnements : {s['resizes']}")
    if len(sys.argv) > 3:
        lines = [l.rstrip() for l in open(sys.argv[3]) if "video-layer" in l]
        if lines:
            print("== journal de la couche")
            for l in lines:
                print("   " + l)


if __name__ == "__main__":
    main()
