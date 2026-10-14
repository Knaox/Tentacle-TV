/* ------------------------------------------------------------------ */
/*  L'ouvrier yt-dlp : le programme Python, tenu ici en texte          */
/*                                                                     */
/*  Lancé par `python3 -u -c <script> <zipapp> <node>` : il importe    */
/*  yt-dlp                                                             */
/*  UNE fois depuis le zipapp officiel (celui de l'image, ou la copie  */
/*  tenue à jour), puis répond aux extractions qu'on lui écrit, une    */
/*  par ligne JSON, chacune dans son fil. En texte et non en fichier : */
/*  `tsc` ne recopie que du TypeScript dans `dist/`.                   */
/*                                                                     */
/*  Entrée  : {"id", "url", "clients": [...], "ejs": bool}             */
/*  Sortie  : {"ready": true, "version"} au démarrage, puis            */
/*            {"id", "formats": [...], "subtitles", "automatic_captions",*/
/*            "stderr"} par extraction — `stderr` porte les erreurs et   */
/*            les avertissements (« WARNING: … » : la vérification       */
/*            anti-robot de YouTube y passe) — les seuls champs dont le */
/*            choix du flux et des pistes a besoin (trailerSubtitles : */
/*            les sous-titres automatiques réduits à la reconnaissance */
/*            vocale d'origine, au lieu de ~150 traductions).          */
/* ------------------------------------------------------------------ */

export const WORKER_SCRIPT = String.raw`
import json, sys, threading
sys.path.insert(0, sys.argv[1])
NODE = sys.argv[2] if len(sys.argv) > 2 else None
import yt_dlp

lock = threading.Lock()
KEEP = ("format_id", "protocol", "ext", "vcodec", "acodec", "height", "tbr", "url", "manifest_url", "has_drm")

def send(obj):
    line = json.dumps(obj, separators=(",", ":"))
    with lock:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

class Errors:
    def __init__(self):
        self.lines = []
    def debug(self, msg):
        pass
    info = debug
    def warning(self, msg):
        if len(self.lines) < 20:
            self.lines.append("WARNING: " + str(msg)[:500])
    def error(self, msg):
        self.lines.append(msg)

CAPTION_EXTS = ("json3", "vtt")

def captions(tracks, keep):
    out = {}
    for lang, entries in (tracks or {}).items():
        if not keep(lang):
            continue
        kept = [{k: e[k] for k in ("ext", "url", "name") if e.get(k) is not None}
                for e in entries or [] if e.get("ext") in CAPTION_EXTS and "/api/timedtext" in (e.get("url") or "")]
        if kept:
            out[lang] = kept
    return out

def extract(req):
    errors = Errors()
    opts = {
        "quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True,
        "ignore_no_formats_error": True, "socket_timeout": 10, "logger": errors,
        "extractor_args": {"youtube": {"player_client": req["clients"]}},
    }
    if req.get("ejs"):
        opts["remote_components"] = ["ejs:github"]
        if NODE:
            opts["js_runtimes"] = {"node": {"path": NODE}}
    formats = []
    subtitles = {}
    automatic = {}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(req["url"], download=False)
        for f in info.get("formats") or []:
            kept = {k: f[k] for k in KEEP if f.get(k) is not None}
            ua = (f.get("http_headers") or {}).get("User-Agent")
            if ua:
                kept["http_headers"] = {"User-Agent": ua}
            formats.append(kept)
        subtitles = captions(info.get("subtitles"), lambda lang: lang != "live_chat")
        automatic = captions(info.get("automatic_captions"), lambda lang: lang.endswith("-orig"))
    except Exception as exc:
        errors.lines.append("ERROR: " + str(exc))
    send({"id": req["id"], "formats": formats, "subtitles": subtitles, "automatic_captions": automatic,
          "stderr": "\n".join(errors.lines)})

send({"ready": True, "version": yt_dlp.version.__version__})
for raw in sys.stdin:
    try:
        req = json.loads(raw)
    except ValueError:
        continue
    threading.Thread(target=extract, args=(req,), daemon=True).start()
`;
