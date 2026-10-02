/* ------------------------------------------------------------------ */
/*  L'ouvrier yt-dlp : le programme Python, tenu ici en texte          */
/*                                                                     */
/*  Lancé par `python3 -u -c <script> <zipapp>` : il importe yt-dlp    */
/*  UNE fois depuis le zipapp officiel (celui de l'image, ou la copie  */
/*  tenue à jour), puis répond aux extractions qu'on lui écrit, une    */
/*  par ligne JSON, chacune dans son fil. En texte et non en fichier : */
/*  `tsc` ne recopie que du TypeScript dans `dist/`.                   */
/*                                                                     */
/*  Entrée  : {"id", "url", "clients": [...], "ejs": bool}             */
/*  Sortie  : {"ready": true, "version"} au démarrage, puis            */
/*            {"id", "formats": [...], "stderr"} par extraction —      */
/*            les seuls champs dont le choix du flux a besoin.         */
/* ------------------------------------------------------------------ */

export const WORKER_SCRIPT = String.raw`
import json, sys, threading
sys.path.insert(0, sys.argv[1])
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
    warning = debug
    def error(self, msg):
        self.lines.append(msg)

def extract(req):
    errors = Errors()
    opts = {
        "quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True,
        "ignore_no_formats_error": True, "socket_timeout": 10, "logger": errors,
        "extractor_args": {"youtube": {"player_client": req["clients"]}},
    }
    if req.get("ejs"):
        opts["remote_components"] = ["ejs:github"]
    formats = []
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(req["url"], download=False)
        for f in info.get("formats") or []:
            kept = {k: f[k] for k in KEEP if f.get(k) is not None}
            ua = (f.get("http_headers") or {}).get("User-Agent")
            if ua:
                kept["http_headers"] = {"User-Agent": ua}
            formats.append(kept)
    except Exception as exc:
        errors.lines.append("ERROR: " + str(exc))
    send({"id": req["id"], "formats": formats, "stderr": "\n".join(errors.lines)})

send({"ready": True, "version": yt_dlp.version.__version__})
for raw in sys.stdin:
    try:
        req = json.loads(raw)
    except ValueError:
        continue
    threading.Thread(target=extract, args=(req,), daemon=True).start()
`;
