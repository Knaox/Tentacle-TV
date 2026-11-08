"""Faux serveur Tentacle pour le banc d'Octave : sert un dossier en HTTP avec
les requêtes partielles (Range — mpv en a besoin pour chercher dans un FLAC),
et EXIGE l'en-tête d'authentification que le moteur doit poser (sinon 401).
Journalise chaque requête sur stderr (preuve que l'en-tête est arrivé).

Usage : python3 -I serve_range.py <dossier> <port> <valeur Authorization attendue>
"""
import http.server
import os
import sys
import urllib.parse

ROOT, PORT, AUTH = sys.argv[1], int(sys.argv[2]), sys.argv[3]


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get("Authorization") != AUTH:
            self.send_error(401)
            return
        rel = urllib.parse.unquote(urllib.parse.urlparse(self.path).path).lstrip("/")
        path = os.path.realpath(os.path.join(ROOT, rel))
        if not path.startswith(os.path.realpath(ROOT)) or not os.path.isfile(path):
            self.send_error(404)
            return
        size = os.path.getsize(path)
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        if rng and rng.startswith("bytes="):
            a, _, b = rng[6:].partition("-")
            start = int(a) if a else max(0, size - int(b))
            end = int(b) if a and b else size - 1
            if start >= size:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Content-Type", "application/octet-stream")
        self.end_headers()
        with open(path, "rb") as fh:
            fh.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = fh.read(min(65536, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def log_message(self, fmt, *args):
        sys.stderr.write("[serveur] " + (fmt % args) + " auth=ok\n")


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
