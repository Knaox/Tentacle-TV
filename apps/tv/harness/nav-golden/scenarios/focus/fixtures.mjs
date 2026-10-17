// Les jeux de données du domaine « focus » (T3), par-dessus la base du banc
// (docs/tv-navigation/banc.md, « Jeux de données »).

/** Les réglages reco du compte, avec un filtre de plateformes (Netflix · Disney+) :
 *  la pastille `filter:remove` paraît sur la 1re rangée recommandée. */
const RECO_WITH_FILTER = {
  settings: { personalized: true, includeVigie: false, community: false, shareHistory: false, explorationBalance: 0.3, providerFilter: [8, 337] },
  vigieAvailable: false,
};

function recoFilter(data) {
  data.route("GET", /^\/api\/preferences\/reco$/, (req, res, { json }) => json(res, 200, RECO_WITH_FILTER));
}

/** Les cinq titres du héros (les cinq premières reprises), reconnaissables à leur
 *  synopsis : « Synopsis du héros 1 » à « 5 », dans l'ordre de la rotation. */
function heroSynopses(data) {
  data.list("resume").slice(0, 5).forEach((item, index) => data.patchItem(item.Id, { Overview: `Synopsis du héros ${index + 1}` }));
}

/** Le serveur du kit des aperçus (`.claude/lot1014b/banc/serve-kit.mjs`, dossier principal) : flux HLS locaux. */
const PREVIEW_KIT = process.env.NAV_GOLDEN_PREVIEW_KIT ?? "http://127.0.0.1:3089";

/**
 * Les aperçus de bandes-annonces au focus : le serveur déclare la capacité,
 * `/api/trailers/preview` rend pour tout titre le flux `mha` du kit (sous
 * `/api/trailers/sim/…`, réécrit vers le kit). Sans le kit lancé, l'aperçu
 * échoue à la lecture — rien d'autre ne change.
 */
function previews(data) {
  data.route("GET", /^\/api\/config$/, (req, res, { json }) => json(res, 200, { capabilities: ["trailers.player", "trailers.preview", "trailers.previewWarm"] }));
  data.route("GET", /^\/api\/trailers\/preview$/, (req, res, { json }) => {
    const base = "/api/trailers/sim/_net=relay/mha";
    json(res, 200, {
      ytId: "dQw4w9WgXcQ", version: "original", path: `${base}/master.m3u8`, mimeType: "application/vnd.apple.mpegurl",
      expiresAt: Date.now() + 3_600_000, heights: [1080, 720, 360], qualities: [1080, 720, 360].map((height) => ({ height, path: `${base}/master-${height}.m3u8` })),
    });
  });
  data.route("POST", /^\/api\/trailers\/preview\/warm$/, (req, res, { json }) => json(res, 200, { ok: true }));
  data.route("GET", /^\/api\/trailers\/sim\//, (req, res) => {
    res.writeHead(302, { location: `${PREVIEW_KIT}${req.url}` });
    res.end();
  });
}

export default {
  home: {
    description: "accueil : filtre Netflix · Disney+ (pastille sur la rangée « Pour vous ») ; « Synopsis du héros N » sur les cinq reprises du héros",
    apply: (data) => {
      recoFilter(data);
      heroSynopses(data);
    },
  },
  apercus: {
    description: "aperçus au focus : capacité déclarée, chaque titre rend le flux « mha » du kit local (port 3089)",
    apply: previews,
  },
  foryou: {
    description: "« Pour vous » : filtre Netflix · Disney+ (pastille sur la 1re étagère)",
    apply: recoFilter,
  },
  "foryou-tendances": {
    description: "« Pour vous » : filtre Netflix · Disney+, la 1re étagère devient « Tendances actuelles » (titre long : la puce n'est plus à l'aplomb de la 1re carte)",
    apply: (data) => {
      recoFilter(data);
      const rows = data.snapshot.extras?.recoState?.rows;
      if (rows?.[0]) rows[0].key = "trendingNow";
    },
  },
};
