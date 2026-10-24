/* ------------------------------------------------------------------ */
/*  L'ouvrier yt-dlp d'une extension : le programme Python de l'HÔTE   */
/*                                                                     */
/*  Exécuté APRÈS l'amorçage (workerBootstrap.ts, crochets d'audit) :  */
/*  yt_dlp est déjà importable depuis le zipapp en service. Il parle   */
/*  le protocole FERMÉ du contrat (pluginServerRuntime.ts) :           */
/*  `WorkerRequest` en entrée, une ligne JSON chacune — déjà validées */
/*  par l'hôte (Zod, toolWorkerProtocol.ts), `output` rendu absolu     */
/*  sous le dossier de données — et `WorkerMessage` en sortie.         */
/*  `download` écrit le format choisi TEL QUEL : aucun post-traitement,*/
/*  aucune fusion, aucun fichier `.part` (le fichier se lit pendant    */
/*  qu'il s'écrit, `progress` le dit). Chaque requête dans son fil,   */
/*  quatre à la fois ; `cancel` arrête un `download` en cours.         */
/* ------------------------------------------------------------------ */

export const WORKER_SCRIPT = String.raw`
import json, threading, os
import yt_dlp
from yt_dlp.utils import DownloadCancelled

DATA = _tentacle_paths["data"]
NODE = _tentacle_paths["node"]
lock = threading.Lock()
slots = threading.BoundedSemaphore(4)
cancels = {}
ANTI_BOT = ("confirm you" + "’re not a bot", "confirm you're not a bot", "sign in to confirm", "http error 429")

def send(obj):
    line = json.dumps(obj, separators=(",", ":"))
    with lock:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

class Quiet:
    def __init__(self):
        self.lines = []
    def debug(self, msg):
        pass
    info = debug
    def warning(self, msg):
        if len(self.lines) < 20:
            self.lines.append(str(msg)[:300])
    def error(self, msg):
        self.lines.append(str(msg)[:300])

def options(o, logger):
    o = o or {}
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "logger": logger, "noprogress": True,
            "postprocessors": [], "cachedir": os.path.join(DATA, ".yt-dlp-cache"), "nopart": True,
            "js_runtimes": {"node": {"path": NODE}}, "socket_timeout": o.get("socketTimeoutS", 15)}
    if "extractorArgs" in o:
        opts["extractor_args"] = o["extractorArgs"]
    if "format" in o:
        opts["format"] = o["format"]
    if "retries" in o:
        opts["retries"] = o["retries"]
    if "concurrentFragments" in o:
        opts["concurrent_fragment_downloads"] = o["concurrentFragments"]
    if o.get("flat"):
        opts["extract_flat"] = "in_playlist"
    if "limit" in o:
        opts["playlistend"] = o["limit"]
    return opts

def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

def text(v):
    return str(v)[:500] if v is not None else None

def fmt(f):
    headers = f.get("http_headers") or {}
    return {"formatId": str(f.get("format_id") or ""), "ext": str(f.get("ext") or ""), "acodec": text(f.get("acodec")),
            "vcodec": text(f.get("vcodec")), "abr": num(f.get("abr")), "asr": num(f.get("asr")),
            "filesize": num(f.get("filesize") or f.get("filesize_approx")), "protocol": text(f.get("protocol")),
            # Jamais text() (500 caractères) : une URL googlevideo en fait ~1 100, tronquée elle répond 403.
            "url": str(f.get("url")) if f.get("url") and len(str(f.get("url"))) < 8000 else None,
            "httpHeaders": {str(k)[:100]: str(v)[:1000] for k, v in list(headers.items())[:20]}}

def info(d, depth=0):
    d = d or {}
    artists = d.get("artists") or ([d["artist"]] if d.get("artist") else [])
    entries = [info(e, depth + 1) for e in (d.get("entries") or []) if e] if depth == 0 else []
    return {"id": str(d.get("id") or ""), "title": text(d.get("title")), "track": text(d.get("track")),
            "artists": [str(a)[:200] for a in artists][:20], "album": text(d.get("album")), "channel": text(d.get("channel")),
            "channelId": text(d.get("channel_id")), "uploader": text(d.get("uploader")), "durationS": num(d.get("duration")),
            "isLive": bool(d.get("is_live")), "webpageUrl": text(d.get("webpage_url") or d.get("url")),
            "categories": [str(c)[:100] for c in (d.get("categories") or [])][:20],
            "formats": [fmt(f) for f in (d.get("formats") or [])][:80], "entries": entries[:100]}

def failure(req_id, exc, logger):
    message = (str(exc) + " " + " ".join(logger.lines)).strip()
    low = message.lower()
    code = "cancelled" if isinstance(exc, DownloadCancelled) else "antiBot" if any(k in low for k in ANTI_BOT) else \
        "unavailable" if ("unavailable" in low or "private video" in low or "not available" in low) else "failed"
    send({"id": req_id, "ok": False, "error": {"code": code, "message": message[:500]}})

def run(req):
    with slots:
        logger = Quiet()
        op = req["op"]
        try:
            if op == "version":
                send({"id": req["id"], "ok": True, "result": {"version": yt_dlp.version.__version__}})
            elif op == "extract":
                with yt_dlp.YoutubeDL(options(req.get("options"), logger)) as ydl:
                    send({"id": req["id"], "ok": True, "result": info(ydl.extract_info(req["target"], download=False))})
            elif op == "download":
                stop = cancels.setdefault(req["id"], threading.Event())
                last = [0]
                def hook(p):
                    if stop.is_set():
                        raise DownloadCancelled("cancelled")
                    done = p.get("downloaded_bytes") or 0
                    if p.get("status") == "downloading" and done - last[0] >= 262144:
                        last[0] = done
                        send({"id": req["id"], "event": "progress", "bytes": done, "total": num(p.get("total_bytes") or p.get("total_bytes_estimate"))})
                os.makedirs(os.path.dirname(req["output"]), exist_ok=True)
                opts = options(req.get("options"), logger)
                opts.update({"format": req["formatId"], "outtmpl": {"default": req["output"]}, "progress_hooks": [hook], "overwrites": True})
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.download([req["url"]])
                size = os.path.getsize(req["output"])
                send({"id": req["id"], "ok": True, "result": {"path": os.path.relpath(os.path.realpath(req["output"]), DATA), "bytes": size}})
        except BaseException as exc:
            failure(req["id"], exc, logger)
        finally:
            cancels.pop(req["id"], None)

for raw in sys.stdin:
    try:
        req = json.loads(raw)
    except ValueError:
        continue
    if req.get("op") == "cancel":
        cancels.setdefault(req.get("target"), threading.Event()).set()
        continue
    threading.Thread(target=run, args=(req,), daemon=True).start()
`;
