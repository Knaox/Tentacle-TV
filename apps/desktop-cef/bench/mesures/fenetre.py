#!/usr/bin/env python3
"""Une fenêtre de mesure sur une app en marche (arbre de processus issu de --pid).

Pendant --duree secondes : GPU système (IOReport, gpumon : mW et % actif), « Device
Utilization % » d'AGXAccelerator (1 Hz), temps GPU par processus (ioreg AppUsage),
temps CPU par processus (ps), marge EDR (edr-probe, si --edr). À la fin : RSS et
empreinte physique (footprint) de chaque processus de l'arbre. Une ligne JSON sur stdout.
"""
import argparse, json, os, plistlib, re, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
GPUMON = os.path.expanduser("~/.cache/tentacle-cef/build/mesures/gpumon")
EDR = os.path.expanduser("~/.cache/tentacle-cef/build/video-hdr/edr-probe/edr-probe")


CPUNS = os.path.expanduser("~/.cache/tentacle-cef/build/mesures/cpuns")


def cpu_exact(pids):
    """{pid: secondes de CPU} exactes (proc_pid_rusage) ; {} si l'outil manque."""
    if not os.path.exists(CPUNS) or not pids:
        return {}
    out = subprocess.run([CPUNS, *map(str, pids)], capture_output=True, text=True).stdout
    return {int(l.split()[0]): int(l.split()[1]) / 1e9 for l in out.splitlines()}


def tree(root):
    """Le processus racine et tous ses descendants : {pid: (rss_ko, cputime_s, nom)}."""
    out = subprocess.run(["ps", "-A", "-o", "pid=,ppid=,rss=,cputime=,comm="], capture_output=True, text=True).stdout
    rows = {}
    for line in out.splitlines():
        pid, ppid, rss, cpu, comm = line.split(None, 4)
        rows[int(pid)] = (int(ppid), int(rss), cpu_seconds(cpu), os.path.basename(comm))
    keep, todo = {}, [root]
    while todo:
        p = todo.pop()
        if p in rows and p not in keep:
            keep[p] = rows[p][1:]
            todo += [c for c, r in rows.items() if r[0] == p]
    return keep


def cpu_seconds(s):
    # « 1:02.34 » ou « 1:02:03.45 »
    parts = [float(x) for x in s.split(":")]
    v = 0.0
    for x in parts:
        v = v * 60 + x
    return v


def gpu_times():
    """{pid: ns de GPU cumulés} d'après les clients d'AGXAccelerator ; WindowServer compris."""
    raw = subprocess.run(["ioreg", "-a", "-r", "-c", "AGXAccelerator", "-l", "-d", "3"], capture_output=True).stdout
    acc = {}

    def walk(node):
        if isinstance(node, dict):
            who = node.get("IOUserClientCreator", "")
            m = re.match(r"pid (\d+)", who)
            if m:
                for u in node.get("AppUsage", []) or []:
                    acc[int(m.group(1))] = acc.get(int(m.group(1)), 0) + int(u.get("accumulatedGPUTime", 0))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(plistlib.loads(raw))
    return acc


def device_util():
    out = subprocess.run(["ioreg", "-r", "-c", "AGXAccelerator", "-d", "1", "-w0"], capture_output=True, text=True).stdout
    m = re.search(r'"Device Utilization %"=(\d+)', out)
    return int(m.group(1)) if m else None


def footprint_mb(pid):
    out = subprocess.run(["footprint", str(pid)], capture_output=True, text=True).stdout
    m = re.search(r"Footprint: ([\d.]+) (KB|MB|GB)", out)
    if not m:
        return None
    return float(m.group(1)) * {"KB": 1 / 1024, "MB": 1, "GB": 1024}[m.group(2)]


def session_locked():
    """Session macOS verrouillée (rien n'est alors à l'écran : la fenêtre ne vaut rien)."""
    raw = subprocess.run(["ioreg", "-n", "Root", "-d1", "-a"], capture_output=True).stdout
    users = plistlib.loads(raw).get("IOConsoleUsers", [{}])
    return bool(users and users[0].get("CGSSessionScreenIsLocked", False))


def windowserver_pid():
    out = subprocess.run(["pgrep", "-x", "WindowServer"], capture_output=True, text=True).stdout.split()
    return int(out[0]) if out else None


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--pid", type=int, required=True)
    a.add_argument("--duree", type=int, default=20)
    a.add_argument("--edr", action="store_true")
    a.add_argument("--etiquette", default="")
    o = a.parse_args()
    ws = windowserver_pid()
    locked0 = session_locked()
    gm = subprocess.Popen([GPUMON, "1000", str(o.duree)], stdout=subprocess.PIPE, text=True)
    edr = subprocess.Popen([EDR, "--hz", "2", "--duration", str(o.duree)], stdout=subprocess.PIPE, text=True) if o.edr else None
    t0, procs0, g0 = time.time(), tree(o.pid), gpu_times()
    cpu0 = cpu_exact(sorted(procs0))
    utils = []
    while time.time() - t0 < o.duree:
        u = device_util()
        if u is not None:
            utils.append(u)
        time.sleep(1)
    t1, procs1, g1 = time.time(), tree(o.pid), gpu_times()
    dt = t1 - t0
    gm_rows = [l.split("\t") for l in gm.communicate()[0].splitlines()[1:] if l.strip()]
    gpu_mw = [float(r[1]) for r in gm_rows]
    gpu_act = [float(r[2]) for r in gm_rows]
    edr_vals = []
    if edr:
        for l in edr.communicate()[0].splitlines():
            m = re.search(r" edr=([\d.]+)", l)
            if m:
                edr_vals.append(float(m.group(1)))
    pids = set(procs0) & set(procs1)
    # CPU exact (ns) quand cpuns est là : ps arrondit à 10 ms, ±0,05 % par processus sur 20 s.
    c0, c1 = cpu0, cpu_exact(sorted(pids))
    if c0 and c1:
        cpu = sum(c1[p] - c0[p] for p in pids if p in c0 and p in c1) / dt * 100
    else:
        cpu = sum(procs1[p][1] - procs0[p][1] for p in pids) / dt * 100
    app_gpu = sum(g1.get(p, 0) - g0.get(p, 0) for p in pids) / 1e9 / dt * 100
    ws_gpu = (g1.get(ws, 0) - g0.get(ws, 0)) / 1e9 / dt * 100 if ws else None
    fps = {p: footprint_mb(p) for p in procs1}
    mean = lambda v: round(sum(v) / len(v), 1) if v else None
    print(json.dumps({
        "etiquette": o.etiquette, "t": time.strftime("%H:%M:%S"), "duree_s": round(dt, 1),
        "processus": len(procs1),
        "rss_mo": round(sum(v[0] for v in procs1.values()) / 1024, 1),
        "empreinte_mo": round(sum(v for v in fps.values() if v), 1),
        "detail": {f"{procs1[p][2]}[{p}]": [round(procs1[p][0] / 1024), fps[p]] for p in sorted(procs1)},
        "cpu_pct_coeur": round(cpu, 1),
        "gpu_app_pct": round(app_gpu, 2), "gpu_windowserver_pct": round(ws_gpu, 2) if ws_gpu is not None else None,
        "gpu_sys_mw": mean(gpu_mw), "gpu_sys_actif_pct": mean(gpu_act), "agx_device_util_pct": mean(utils),
        "edr_max": max(edr_vals) if edr_vals else None, "edr_moy": mean(edr_vals),
        "verrouille": locked0 or session_locked(),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
