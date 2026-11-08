#!/usr/bin/env python3
"""CPU exact (ns, proc_pid_rusage via cpuns) et réveils de l'arbre d'une app sur une fenêtre.

    python3 bench/mesures/cpu_repos.py --pid <racine> [--duree 60]
"""
import argparse, os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from diag import role  # noqa: E402
from fenetre import tree  # noqa: E402

CPUNS = os.path.expanduser("~/.cache/tentacle-cef/build/mesures/cpuns")


def snap(pids):
    out = subprocess.run([CPUNS, *map(str, pids)], capture_output=True, text=True).stdout
    return {int(p): (int(ns), int(idle), int(intr)) for p, ns, idle, intr in (l.split() for l in out.splitlines())}


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--pid", type=int, required=True)
    a.add_argument("--duree", type=float, default=60)
    o = a.parse_args()
    pids = sorted(tree(o.pid))
    t0, s0 = time.time(), snap(pids)
    time.sleep(o.duree)
    dt, s1 = time.time() - t0, snap(pids)
    tot = [0.0, 0.0]
    for p in pids:
        if p not in s0 or p not in s1:
            continue
        cpu = (s1[p][0] - s0[p][0]) / 1e9 / dt * 100
        wk = ((s1[p][1] - s0[p][1]) + (s1[p][2] - s0[p][2])) / dt
        tot[0] += cpu
        tot[1] += wk
        print(f"{p:>6} {role(p):<16} cpu {cpu:6.3f} %  réveils {wk:7.1f}/s")
    print(f"TOTAL cpu {tot[0]:.3f} % d'un cœur, réveils {tot[1]:.1f}/s sur {dt:.0f} s")


if __name__ == "__main__":
    main()
