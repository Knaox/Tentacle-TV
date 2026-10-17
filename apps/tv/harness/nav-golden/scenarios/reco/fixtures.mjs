// Les jeux de données du domaine « reco » (lot 1017, « Tendances actuelles »), par-dessus
// la base du banc (docs/tv-navigation/banc.md, « Jeux de données »).
//
// Le faux backend se comporte comme un serveur 1.31.0 : il déclare `reco.trending`,
// garde la préférence `trendingNow` du compte (lue et écrite par
// `/api/preferences/reco`) et, à la demande du client (`?trendingNow=1`), sert la
// rangée `trendingNow` en TÊTE de la page — les titres de la rangée `trending` de
// l'instantané, dans leur ordre ; les rangées suivantes perdent ses titres, sauf
// `trending`, gardée entière (règle de `services/reco/trendingHead.ts`).

const HEAD_KEY = "trendingNow";
const MIN_ITEMS = 6;

/** La page servie : la règle du serveur, recopiée (le banc ne lit pas le backend). */
export function withTrendingHead(page, enabled) {
  const trending = page.rows.find((row) => row.key === "trending");
  if (!enabled || !trending || trending.items.length < MIN_ITEMS) return page;
  const shown = new Set(trending.items.map((item) => item.key));
  const rows = [{ key: HEAD_KEY, items: trending.items }];
  for (const row of page.rows) {
    if (row.key === "trending") {
      rows.push(row);
      continue;
    }
    const items = row.items.filter((item) => !shown.has(item.key));
    if (items.length === row.items.length) rows.push(row);
    else if (items.length >= MIN_ITEMS) rows.push({ ...row, items });
  }
  return { ...page, rows };
}

function serveTrending(data, { enabled }) {
  const settings = { personalized: true, includeVigie: true, community: true, shareHistory: true, explorationBalance: 70, providerFilter: [], trendingNow: enabled };
  data.route("GET", /^\/api\/config$/, (req, res, { json }) => json(res, 200, { version: "1.31.0", capabilities: ["reco.trending"] }));
  data.route("GET", /^\/api\/preferences\/reco$/, (req, res, { json }) => json(res, 200, { stored: true, vigieAvailable: true, settings }));
  data.route("PUT", /^\/api\/preferences\/reco$/, (req, res, { body, json }) => {
    if (typeof body?.trendingNow === "boolean") settings.trendingNow = body.trendingNow;
    return json(res, 200, { ok: true });
  });
  data.route("GET", /^\/api\/reco\/page$/, (req, res, { url, json }) => {
    const page = data.snapshot.extras?.recoState ?? { state: "ready", generating: false, rows: [] };
    return json(res, 200, withTrendingHead(page, url.searchParams.get("trendingNow") === "1" && settings.trendingNow));
  });
}

export default {
  tendances: {
    description: "serveur 1.31.0 : « Tendances actuelles » en tête de « Pour vous » (préférence du compte allumée), interrupteur dans Réglages › Accueil",
    apply: (data) => serveTrending(data, { enabled: true }),
  },
  "tendances-coupee": {
    description: "serveur 1.31.0, « Tendances actuelles » coupée par le compte : la page d'avant, l'interrupteur éteint",
    apply: (data) => serveTrending(data, { enabled: false }),
  },
};
