// Les jeux de la BANDE-ANNONCE LISIBLE (lot BA) : le faux serveur relaie une
// vraie bande-annonce, à la forme de `GET /api/trailers/resolve` d'un serveur
// qui déclare `trailers.player` — maître HLS, une variante par hauteur (le
// même flux : seule la navigation compte ici), deux pistes de sous-titres
// WebVTT. Le flux se génère une fois par machine (README, « La bande-annonce
// lisible »), à partir de la vidéo du domaine lecteur.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CACHE = path.join(os.homedir(), "Library/Caches/tentacle-nav-golden/bande-annonce");
const MEDIA = path.join(CACHE, "media.m3u8");
const HEIGHTS = [1080, 720, 480, 360];
const SUBTITLES = [
  { lang: "fr", label: "French", auto: true },
  { lang: "en-US", label: "English (United States)", auto: false },
];
const TYPES = { m3u8: "application/vnd.apple.mpegurl", ts: "video/mp2t", vtt: "text/vtt" };

/** Un maître HLS d'une seule variante : le flux du banc. */
const MASTER = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=640x360,CODECS=\"avc1.4d401e,mp4a.40.2\"\nmedia.m3u8\n";

function send(res, type, body) {
  res.writeHead(200, { "Content-Type": type, "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

/** Les fichiers du flux : maîtres (tous pareils), liste des segments, segments, sous-titres. */
function serveStream(req, res, { url }) {
  const name = path.basename(url.pathname);
  if (/^master(-\d+)?\.m3u8$/.test(name)) return send(res, TYPES.m3u8, MASTER);
  if (url.pathname.includes("/subs/")) return send(res, TYPES.vtt, fs.readFileSync(path.join(CACHE, "sub.vtt")));
  const file = path.join(CACHE, name);
  if (!/^(media\.m3u8|seg-\d+\.ts)$/.test(name) || !fs.existsSync(file)) return send(res, "text/plain", "");
  const body = fs.readFileSync(file);
  res.writeHead(200, { "Content-Type": TYPES[name.split(".").pop()], "Content-Length": body.length });
  return res.end(body);
}

/** La réponse de `resolve` : celle d'un serveur avec `trailers.player`, ou d'avant (sans choix). */
function resolveBody(ytId, player) {
  const base = `/api/trailers/hls/${ytId}`;
  const body = { path: `${base}/master.m3u8?t=banc`, mimeType: TYPES.m3u8, expiresAt: Date.now() + 3_600_000 };
  if (!player) return body;
  return {
    ...body,
    qualities: HEIGHTS.map((height) => ({ height, path: `${base}/master-${height}.m3u8?t=banc` })),
    subtitles: SUBTITLES.map((s) => ({ ...s, path: `/api/trailers/subs/${ytId}/t-${s.lang}.vtt?t=banc` })),
  };
}

function playable(player) {
  return (data) => {
    if (!fs.existsSync(MEDIA)) throw new Error(`bande-annonce du banc absente (${MEDIA}) : voir scenarios/ecrans/README.md`);
    data.route("GET", /^\/api\/config$/, (req, res, { json }) => json(res, 200, player ? { capabilities: ["trailers.player"] } : {}));
    data.route("GET", /^\/api\/trailers\/resolve$/, (req, res, { url, json }) =>
      json(res, 200, resolveBody(url.searchParams.get("ytId") ?? "banc", player)));
    data.route("GET", /^\/api\/trailers\/(hls|subs)\//, serveStream);
  };
}

export default {
  "bande-annonce-lisible": {
    description: "une bande-annonce lisible (HLS), 4 hauteurs et 2 pistes de sous-titres ; le serveur déclare `trailers.player`",
    apply: playable(true),
  },
  "bande-annonce-ancien-serveur": {
    description: "la même bande-annonce lisible, chez un serveur qui ne déclare rien (ni sous-titres, ni qualité)",
    apply: playable(false),
  },
};
