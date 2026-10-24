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
/*                                                                     */
/*  Un `extract` reprend une instance YoutubeDL GARDÉE pour le même    */
/*  jeu d'options (une par fil, au plus 4) : l'extracteur reste        */
/*  chargé et le lecteur JS de YouTube reste en mémoire — plus de      */
/*  base.js re-téléchargé à chaque vidéo. Une instance sert 30 min ou */
/*  200 extractions au plus, jamais après un échec. L'ouvrier se      */
/*  préchauffe au démarrage (extracteur YouTube importé) et garde le  */
/*  lecteur PRÉTRAITÉ par le solveur JS sur disque (les 2 derniers) : */
/*  node ne réanalyse plus 2,5 Mo de JavaScript à chaque défi.         */
/*  Mesures : docs/octave/EXTRACTION.md.                               */
/* ------------------------------------------------------------------ */

export const WORKER_SCRIPT = String.raw`
import hashlib, io, json, threading, os, time
import yt_dlp
from yt_dlp.utils import DownloadCancelled

DATA = _tentacle_paths["data"]
NODE = _tentacle_paths["node"]
CACHE = os.path.join(DATA, ".yt-dlp-cache")
lock = threading.Lock()
slots = threading.BoundedSemaphore(4)
cancels = {}
ANTI_BOT = ("confirm you" + "’re not a bot", "confirm you're not a bot", "sign in to confirm", "http error 429")
KEEP_S, KEEP_USES, KEEP_PER_KEY, KEEP_KEYS = 1800, 200, 4, 8
kept = {}
kept_lock = threading.Lock()
authors = {}

class HostYoutubeDL(yt_dlp.YoutubeDL):
    # Sans page watch ni initial_data, yt-dlp perd le nom de la chaîne ; la réponse player le porte
    # (videoDetails.author) : lu au passage, rendu dans channel/uploader quand yt-dlp n'en a pas.
    def urlopen(self, req):
        resp = super().urlopen(req)
        if "/youtubei/v1/player" in str(getattr(resp, "url", "")):
            body = resp.read()
            resp.fp = io.BytesIO(body)
            try:
                details = json.loads(body).get("videoDetails") or {}
                if details.get("videoId") and details.get("author"):
                    if len(authors) > 500:
                        authors.clear()
                    authors[str(details["videoId"])] = str(details["author"])[:200]
            except (ValueError, AttributeError):
                pass
        return resp

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
            "postprocessors": [], "cachedir": CACHE, "nopart": True,
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

def close_quietly(ydl):
    try:
        ydl.close()
    except BaseException:
        pass

def take(o, logger):
    # Une instance gardée pour ces options, sinon une neuve ; le journal est celui de CETTE requête.
    # La clé est une EMPREINTE des options : le visitorData n'y figure jamais en clair.
    key = hashlib.sha256(json.dumps(o or {}, sort_keys=True).encode()).hexdigest()[:32]
    with kept_lock:
        bucket = kept.get(key) or []
        while bucket:
            ydl, born, uses = bucket.pop()
            if time.monotonic() - born < KEEP_S and uses < KEEP_USES:
                ydl.params["logger"] = logger
                return key, ydl, born, uses
            close_quietly(ydl)
    prune_players()
    return key, HostYoutubeDL(options(o, logger)), time.monotonic(), 0

def give_back(key, ydl, born, uses):
    if not isinstance(getattr(ydl, "params", None), dict):
        return close_quietly(ydl)
    ydl.params["logger"] = SILENT
    with kept_lock:
        if key not in kept and len(kept) >= KEEP_KEYS:
            for old in kept.pop(next(iter(kept))):
                close_quietly(old[0])
        bucket = kept.setdefault(key, [])
        if len(bucket) < KEEP_PER_KEY:
            bucket.append((ydl, born, uses + 1))
            return
    close_quietly(ydl)

def prune_players(keep=2):
    # Le lecteur prétraité pèse ~4 Mo par version de lecteur : seuls les plus récents restent.
    folder = os.path.join(CACHE, "challenge-solver")
    try:
        files = sorted((os.path.join(folder, n) for n in os.listdir(folder) if n.startswith("player")), key=os.path.getmtime)
        for path in files[:-keep]:
            os.remove(path)
    except OSError:
        pass

def warm():
    # Au démarrage : l'extracteur YouTube importé et le cache du lecteur prétraité ouvert. Rien de bloquant :
    # un yt-dlp qui n'a pas ces modules (version, banc de test) garde le comportement d'origine.
    try:
        from yt_dlp.extractor.youtube.jsc._builtin.ejs import EJSBaseJCP
        EJSBaseJCP._ENABLE_PREPROCESSED_PLAYER_CACHE = True
    except BaseException:
        pass
    prune_players()
    try:
        with slots:
            key, ydl, born, uses = take(None, Quiet())
            ydl.get_info_extractor("Youtube")
            give_back(key, ydl, born, uses - 1)
    except BaseException:
        pass

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
    author = authors.pop(str(d.get("id") or ""), None) if depth == 0 else None
    artists = d.get("artists") or ([d["artist"]] if d.get("artist") else [])
    entries = [info(e, depth + 1) for e in (d.get("entries") or []) if e] if depth == 0 else []
    return {"id": str(d.get("id") or ""), "title": text(d.get("title")), "track": text(d.get("track")),
            "artists": [str(a)[:200] for a in artists][:20], "album": text(d.get("album")), "channel": text(d.get("channel") or author),
            "channelId": text(d.get("channel_id")), "uploader": text(d.get("uploader") or author), "durationS": num(d.get("duration")),
            "isLive": bool(d.get("is_live")), "webpageUrl": text(d.get("webpage_url") or d.get("url")),
            "categories": [str(c)[:100] for c in (d.get("categories") or [])][:20],
            "formats": [fmt(f) for f in (d.get("formats") or [])][:80], "entries": entries[:100]}

def secrets_of(o):
    # Le visitorData passé par l'extension : une session, jamais recopiée dans un message.
    return [v for v in (((o or {}).get("extractorArgs") or {}).get("youtube") or {}).get("visitor_data") or [] if v]

def failure(req_id, exc, logger, secrets=()):
    message = (str(exc) + " " + " ".join(logger.lines)).strip()
    for secret in secrets:
        message = message.replace(secret, "[visitor_data]")
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
                key, ydl, born, uses = take(req.get("options"), logger)
                try:
                    result = info(ydl.extract_info(req["target"], download=False))
                except BaseException:
                    close_quietly(ydl)
                    raise
                give_back(key, ydl, born, uses)
                send({"id": req["id"], "ok": True, "result": result})
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
            failure(req["id"], exc, logger, secrets_of(req.get("options")))
        finally:
            cancels.pop(req["id"], None)

SILENT = Quiet()
threading.Thread(target=warm, daemon=True).start()

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
