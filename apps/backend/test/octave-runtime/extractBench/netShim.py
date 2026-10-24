# Banc d'extraction (hors suite de tests) : la couche RÉSEAU de l'ouvrier, posée entre
# l'amorçage (workerBootstrap.ts) et le programme de l'ouvrier (workerScript.ts).
#
#   argv[4] = live | record | replay     argv[5] = net | zero (replay : latence enregistrée ou nulle)
#
# - live   : réseau réel, chaque requête HTTP tracée (clé, durée, octets) sur stderr ;
# - record : idem, et la réponse est gardée dans <données>/fixtures (une par clé) ;
# - replay : AUCUN réseau — la réponse enregistrée est rendue, après sa durée mesurée (net)
#            ou tout de suite (zero) : on mesure Python et le solveur JS seuls.
# Le solveur JS (node) est tracé aussi. Rien de ceci n'est livré : l'ouvrier de production
# n'a ni trace ni rejeu.
import json as _bj, time as _bt, io as _bio, os as _bo, hashlib as _bh
import yt_dlp as _by
from urllib.parse import urlsplit as _bsplit, parse_qs as _bqs
from yt_dlp.networking.common import Request as _BReq, Response as _BResp
from yt_dlp.networking.exceptions import HTTPError as _BHTTPError

_B_MODE = sys.argv[4] if len(sys.argv) > 4 else "live"
_B_NET = len(sys.argv) > 5 and sys.argv[5] == "net"
_B_FIX = _bo.path.join(_tentacle_paths["data"], "fixtures")
_B_DROP = ("content-encoding", "content-length", "transfer-encoding")


def _btrace(**k):
    sys.stderr.write("TRACE " + _bj.dumps(k) + "\n")
    sys.stderr.flush()


def _bkey(req):
    u = _bsplit(req.url)
    vid, client = "", ""
    if u.path == "/watch":
        vid = _bqs(u.query).get("v", [""])[0]
    if req.data:
        try:
            body = _bj.loads(req.data)
            vid = body.get("videoId", "") or vid
            c = body["context"]["client"]
            client = f"{c.get('clientName', '')}/{c.get('clientVersion', '')}"
        except Exception:
            pass
    return f"{req.method} {u.netloc}{u.path} {vid} {client}".strip()


def _bfile(key):
    return _bo.path.join(_B_FIX, _bh.sha1(key.encode()).hexdigest() + ".json")


def _bresp(rec, body):
    headers = {k: v for k, v in rec["headers"].items() if k.lower() not in _B_DROP}
    resp = _BResp(_bio.BytesIO(body), rec["url"], headers, rec["status"])
    if rec["status"] >= 400:
        raise _BHTTPError(resp)
    return resp


_b_orig = _by.YoutubeDL.urlopen


def _burlopen(self, req):
    if isinstance(req, str):
        req = _BReq(req)
    key = _bkey(req)
    t0 = _bt.perf_counter()
    if _B_MODE == "replay":
        with open(_bfile(key), encoding="utf-8") as f:
            rec = _bj.load(f)
        if _B_NET:
            _bt.sleep(rec["ms"] / 1000)
        _btrace(kind="http", key=key, ms=round((_bt.perf_counter() - t0) * 1000), status=rec["status"], replay=True)
        return _bresp(rec, rec["body"].encode("latin-1"))
    try:
        resp = _b_orig(self, req)
        status = resp.status
    except _BHTTPError as e:
        resp = e.response
        status = e.status
    body = resp.read()
    ms = round((_bt.perf_counter() - t0) * 1000)
    rec = {"key": key, "url": resp.url, "status": status, "headers": dict(resp.headers.items()), "ms": ms}
    if _B_MODE == "record":
        _bo.makedirs(_B_FIX, exist_ok=True)
        with open(_bfile(key), "w", encoding="utf-8") as f:
            _bj.dump({**rec, "body": body.decode("latin-1")}, f)
    _btrace(kind="http", key=key, ms=ms, status=status, bytes=len(body))
    return _bresp(rec, body)


_by.YoutubeDL.urlopen = _burlopen

try:
    from yt_dlp.extractor.youtube.jsc._builtin.node import NodeJCP as _BNode
    _b_run = _BNode._run_js_runtime

    def _brun(self, stdin):
        t0 = _bt.perf_counter()
        out = _b_run(self, stdin)
        _btrace(kind="node", ms=round((_bt.perf_counter() - t0) * 1000), stdin=len(stdin), stdout=len(out))
        return out

    _BNode._run_js_runtime = _brun
except Exception as _be:
    _btrace(kind="warn", message=str(_be))
