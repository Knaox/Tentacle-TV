#!/usr/bin/env python3
"""Rejoue un compile_commands.json en compilation À BLANC (-fsyntax-only).

Usage : replay.py <compile_commands.json> <racine des sources> [--jobs N] [fichier…]
Seules les sources de <racine>/src sont rejouées (ni le wrapper de CEF, ni SQLite, ni le
code généré) ; chaque commande garde les définitions et chemins de SON module (CMake).
Code de sortie : nombre de commandes en erreur.
"""
import concurrent.futures
import json
import os
import shlex
import subprocess
import sys


def syntax_only(args):
    out, skip = [], 0
    for a in args:
        if skip:
            skip -= 1
            continue
        if a in ("-o", "-MT", "-MF", "-MQ"):
            skip = 1
            continue
        if a in ("-c", "-MD", "-MMD"):
            continue
        out.append(a)
    return out[:1] + ["-fsyntax-only"] + out[1:]


def main():
    argv = sys.argv[1:]
    jobs = 2
    if "--jobs" in argv:
        i = argv.index("--jobs")
        jobs = int(argv[i + 1])
        del argv[i : i + 2]
    db_path, root, wanted = argv[0], os.path.realpath(argv[1]), set(argv[2:])
    seen, work = set(), []
    for e in json.load(open(db_path)):
        path = os.path.realpath(os.path.join(e["directory"], e["file"]))
        rel = os.path.relpath(path, root)
        if not rel.startswith("src" + os.sep) or (wanted and rel not in wanted):
            continue
        args = syntax_only(e["arguments"] if "arguments" in e else shlex.split(e["command"]))
        key = (rel, tuple(args))
        if key in seen:
            continue
        seen.add(key)
        work.append((rel, e["directory"], args))

    def run(item):
        rel, cwd, args = item
        p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
        return rel, p.returncode, (p.stdout + p.stderr).strip()

    failed, files = 0, set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        for rel, code, text in pool.map(run, sorted(work)):
            files.add(rel)
            if code != 0 or text:
                print(f"=== {rel}")
                print(text)
            if code != 0:
                failed += 1
    print(f"replay : {len(work)} commandes ({len(files)} fichiers), {failed} en erreur")
    return min(failed, 125)


if __name__ == "__main__":
    sys.exit(main())
