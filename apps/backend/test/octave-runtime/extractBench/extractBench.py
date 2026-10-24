# Banc d'extraction de l'ouvrier yt-dlp de l'HÔTE (manuel, jamais lancé par la suite de tests).
#
# Il lance le VRAI programme (amorçage à crochets d'audit + couche réseau du banc + programme
# de l'ouvrier, lus dans les fichiers TypeScript), lui parle le protocole fermé sur stdin/stdout
# et mesure chaque `extract` de bout en bout (requête écrite → réponse lue).
#
#   python3 extractBench.py --zipapp <yt-dlp> --worker <workerScript.ts> --data <dossier>
#       --mode live|record|replay [--net] [--cold] [--reps N] [--options '<json>'] <videoId>...
#
# --cold : un processus NEUF par extraction (ouvrier « froid » : yt-dlp importé, `version`
#          répondue, mais aucune extraction encore) ; sinon un seul processus, chaud après la 1re.
# --settle S : attente après `version` (un ouvrier naît au démarrage de l'extension, bien avant un clic).
# --clear-cache : vide le cache disque de yt-dlp avant chaque processus.
# Sortie : une ligne JSON par extraction, puis p50 / p95.
#
# BUDGET : en live/record, chaque requête youtube.com compte (yt-budget.sh du lot). Enregistrer UNE
# fois (record), puis tout mesurer en rejeu (replay --net rejoue les latences mesurées). Les
# enregistrements portent l'adresse IP publique dans les URL googlevideo : JAMAIS dans le dépôt.
import argparse, json, os, re, shutil, subprocess, sys, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, "..", "..", "..", "src", "plugins", "runtime", "tools")


def raw_string(ts_file, name):
    with open(ts_file, encoding="utf-8") as f:
        src = f.read()
    m = re.search(r"export const " + name + r" = String\.raw`(.*?)`;", src, re.S)
    if not m:
        sys.exit(f"{name} introuvable dans {ts_file}")
    return m.group(1)


class Worker:
    def __init__(self, args):
        boot = raw_string(os.path.join(TOOLS, "workerBootstrap.ts"), "WORKER_BOOTSTRAP")
        with open(os.path.join(HERE, "netShim.py"), encoding="utf-8") as f:
            shim = f.read()
        script = raw_string(args.worker, "WORKER_SCRIPT")
        for prelude in args.prelude or []:
            with open(prelude, encoding="utf-8") as f:
                shim += "\n" + f.read()
        data = os.path.realpath(args.data)
        node = shutil.which("node")
        env = {"PATH": os.path.dirname(node), "HOME": data, "XDG_CACHE_HOME": os.path.join(data, ".cache"),
               "TMPDIR": os.path.join(data, "tmp"), "YTDLP_NO_PLUGINS": "1"}
        os.makedirs(env["TMPDIR"], exist_ok=True)
        self.t0 = time.perf_counter()
        self.proc = subprocess.Popen(
            [sys.executable, "-I", "-u", "-c", boot + shim + script, args.zipapp, data, node, args.mode,
             "net" if args.net else "zero"],
            cwd=data, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.traces, self.errors = [], []
        threading.Thread(target=self._stderr, daemon=True).start()
        self.next_id = 1

    def _stderr(self):
        for line in self.proc.stderr:
            if line.startswith("TRACE "):
                self.traces.append(json.loads(line[6:]))
            elif line.strip():
                self.errors.append(line.rstrip()[:300])

    def call(self, req):
        req = {"id": self.next_id, **req}
        self.next_id += 1
        self.traces.clear()
        t0 = time.perf_counter()
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("ouvrier mort : " + " | ".join(self.errors[-5:]))
            msg = json.loads(line)
            if msg.get("id") == req["id"] and "event" not in msg:
                return msg, round((time.perf_counter() - t0) * 1000), list(self.traces)

    def stop(self):
        self.proc.stdin.close()
        self.proc.kill()


def audio_https(result):
    fmts = result.get("formats") or []
    return [f["formatId"] for f in fmts if f.get("vcodec") in ("none", None) and f.get("acodec") not in (None, "none")
            and f.get("protocol") == "https" and f.get("url")]


def pct(values, p):
    s = sorted(values)
    return s[min(len(s) - 1, int(round(p / 100 * (len(s) - 1))))] if s else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zipapp", required=True)
    ap.add_argument("--worker", default=os.path.join(TOOLS, "workerScript.ts"))
    ap.add_argument("--data", required=True)
    ap.add_argument("--mode", default="replay", choices=["live", "record", "replay"])
    ap.add_argument("--net", action="store_true")
    ap.add_argument("--cold", action="store_true")
    ap.add_argument("--clear-cache", action="store_true")
    ap.add_argument("--reps", type=int, default=1)
    ap.add_argument("--options", default=None)
    ap.add_argument("--label", default="")
    ap.add_argument("--dump-info", action="store_true", help="rend aussi l'info (sans les formats)")
    ap.add_argument("--settle", type=float, default=0, help="attente (s) après `version` d'un processus neuf")
    ap.add_argument("--dump-format", default=None, help="rend aussi ce format en entier (URL comprise)")
    ap.add_argument("--prelude", action="append", help="code Python posé avant le programme (variante mesurée)")
    ap.add_argument("videos", nargs="+")
    args = ap.parse_args()
    options = json.loads(args.options) if args.options else None
    worker, times = None, []
    for rep in range(args.reps):
        for vid in args.videos:
            if worker is None or args.cold:
                if worker:
                    worker.stop()
                if args.clear_cache:
                    shutil.rmtree(os.path.join(args.data, ".yt-dlp-cache"), ignore_errors=True)
                worker = Worker(args)
                _, version_ms, _ = worker.call({"op": "version"})
                time.sleep(args.settle)
            req = {"op": "extract", "target": f"https://www.youtube.com/watch?v={vid}"}
            if options:
                req["options"] = options
            msg, ms, traces = worker.call(req)
            http = [t for t in traces if t["kind"] == "http"]
            node = [t for t in traces if t["kind"] == "node"]
            row = {"label": args.label, "rep": rep, "video": vid, "ms": ms, "ok": msg.get("ok"),
                   "audio": audio_https(msg.get("result") or {}) if msg.get("ok") else msg.get("error"),
                   "meta": {k: (msg.get("result") or {}).get(k) for k in ("track", "artists", "album", "channel", "channelId", "uploader", "title", "durationS", "isLive")},
                   "http": [(t["key"][:90], t["ms"]) for t in http], "httpMs": sum(t["ms"] for t in http),
                   "nodeMs": sum(t["ms"] for t in node), "versionMs": version_ms if args.cold else None}
            if args.dump_info and msg.get("ok"):
                row["info"] = {k: v for k, v in msg["result"].items() if k not in ("formats", "entries")}
            if args.dump_format and msg.get("ok"):
                row["dump"] = [f for f in msg["result"]["formats"] if f["formatId"] == args.dump_format]
            print(json.dumps(row, ensure_ascii=False), flush=True)
            times.append(ms)
    worker.stop()
    print(json.dumps({"label": args.label, "n": len(times), "p50": pct(times, 50), "p95": pct(times, 95),
                      "min": min(times), "max": max(times)}), flush=True)


if __name__ == "__main__":
    main()
