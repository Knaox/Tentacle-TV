#!/usr/bin/env python3
"""Diagnostic RAM/CPU par processus d'une app en marche (arbre issu de --pid).

Pendant --duree secondes : CPU % d'un cœur par processus. À la fin : rôle Chromium
(--type, --utility-sub-type), RSS, empreinte et ses plus grosses catégories (footprint).

  python3 bench/mesures/diag.py --pid <pid> [--duree 20] [--categories 6]
"""
import argparse, os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fenetre import tree  # noqa: E402


def role(pid):
    args = subprocess.run(["ps", "-o", "args=", "-p", str(pid)], capture_output=True, text=True).stdout
    t = re.search(r"--type=(\S+)", args)
    if not t:
        return "principal"
    sub = re.search(r"--utility-sub-type=(\S+)", args)
    return sub.group(1).split(".")[0] if sub else t.group(1)


def footprint(pid, n):
    out = subprocess.run(["footprint", str(pid)], capture_output=True, text=True).stdout
    m = re.search(r"Footprint: ([\d.]+) (KB|MB|GB)", out)
    total = float(m.group(1)) * {"KB": 1 / 1024, "MB": 1, "GB": 1024}[m.group(2)] if m else 0
    cats = []
    for line in out.splitlines():
        c = re.match(r"\s*([\d.]+) (B|KB|MB|GB)\s+\S+ \S+\s+\S+ \S+\s+\d+\s+(.+)$", line)
        if c:
            mb = float(c.group(1)) * {"B": 1 / 2**20, "KB": 1 / 1024, "MB": 1, "GB": 1024}[c.group(2)]
            cats.append((mb, c.group(3).strip()))
    cats.sort(reverse=True)
    return total, cats[:n]


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--pid", type=int, required=True)
    a.add_argument("--duree", type=float, default=20)
    a.add_argument("--categories", type=int, default=6)
    o = a.parse_args()
    t0, p0 = time.time(), tree(o.pid)
    time.sleep(o.duree)
    dt, p1 = time.time() - t0, tree(o.pid)
    tot_cpu = tot_rss = tot_fp = 0
    for pid in sorted(p1):
        rss, cpu, _ = p1[pid]
        c = (cpu - p0[pid][1]) / dt * 100 if pid in p0 else 0
        fp, cats = footprint(pid, o.categories)
        tot_cpu, tot_rss, tot_fp = tot_cpu + c, tot_rss + rss / 1024, tot_fp + fp
        print(f"{pid:>6} {role(pid):<16} cpu {c:5.2f} %  rss {rss / 1024:5.0f}  empreinte {fp:6.1f} Mo")
        for mb, name in cats:
            print(f"{'':>24}{mb:7.1f}  {name}")
    print(f"TOTAL {len(p1)} processus  cpu {tot_cpu:.2f} %  rss {tot_rss:.0f} Mo  empreinte {tot_fp:.1f} Mo")


if __name__ == "__main__":
    main()
