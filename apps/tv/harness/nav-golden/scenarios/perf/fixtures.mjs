// Les jeux du banc de fluidité (`perf.mjs`) — aucun scénario de navigation ici.

/** Le serveur du kit des aperçus (`.claude/lot1014b/banc/serve-kit.mjs`, dossier principal) : flux HLS locaux. */
const PREVIEW_KIT = process.env.NAV_GOLDEN_PREVIEW_KIT ?? "http://127.0.0.1:3089";
const STREAMS = ["mha", "spring", "mhaladder"];

/**
 * Comme `focus/apercus`, mais chaque titre a SA vraie adresse de flux (un des
 * flux du kit, et l'identifiant du titre dans la requête) : un lecteur
 * persistant qui reçoit la même adresse pour deux titres ne recharge rien, et
 * la latence focus → première image ne se mesurerait pas.
 */
function distinctPreviews(data) {
  data.route("GET", /^\/api\/config$/, (req, res, { json }) => json(res, 200, { capabilities: ["trailers.player", "trailers.preview", "trailers.previewWarm"] }));
  data.route("GET", /^\/api\/trailers\/preview$/, (req, res, { json, url }) => {
    const id = url.searchParams.get("itemId") ?? url.searchParams.get("tmdbId") ?? "x";
    const hash = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
    const base = `/api/trailers/sim/_net=relay/${STREAMS[hash % STREAMS.length]}`;
    const q = `?item=${encodeURIComponent(id)}`;
    json(res, 200, {
      ytId: "dQw4w9WgXcQ", version: "original", path: `${base}/master.m3u8${q}`, mimeType: "application/vnd.apple.mpegurl",
      expiresAt: Date.now() + 3_600_000, heights: [1080, 720, 360], qualities: [1080, 720, 360].map((height) => ({ height, path: `${base}/master-${height}.m3u8${q}` })),
    });
  });
  data.route("POST", /^\/api\/trailers\/preview\/warm$/, (req, res, { json }) => json(res, 200, { ok: true }));
  data.route("GET", /^\/api\/trailers\/sim\//, (req, res) => {
    res.writeHead(302, { location: `${PREVIEW_KIT}${req.url}` });
    res.end();
  });
}

export default {
  "apercus-distincts": {
    description: "aperçus au focus, une adresse de flux PAR TITRE (mha, spring, mhaladder du kit local, port 3089)",
    apply: distinctPreviews,
  },
};
