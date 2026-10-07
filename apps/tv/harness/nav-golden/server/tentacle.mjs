// Le FAUX TENTACLE : les routes du backend que l'app TV lit, nourries par le
// jeu de données, et le faux Vigie du banc des demandes en direct
// (`../../live-requests/fakeVigie.mjs`), IMMOBILE par défaut (`still`) : rien
// n'avance d'une seconde à l'autre, le focus et les libellés restent stables.
// Aucune demande ne part nulle part : `POST titles/request` est journalisé.
import { Readable } from "node:stream";
import { createVigie } from "../../live-requests/fakeVigie.mjs";
import { ratingRow } from "./dataset.mjs";

/**
 * Une recherche par le nom, au format de `/api/search` (la réponse capturée si
 * c'est sa requête) — comme le moteur du serveur la rend
 * (`searchService.ts`, `respond`) : les films et séries dont le nom contient
 * la saisie, trouvés par leur titre (`match`, que l'écran lit : sans lui,
 * l'écran plantait à l'arrivée des résultats), le meilleur en tête et retiré
 * de sa catégorie, chaque catégorie bornée à `limit`, les totaux entiers.
 */
function search(data, q, limit) {
  const captured = data.snapshot.extras?.search;
  if (captured?.query && captured.query.toLowerCase() === q.toLowerCase()) return captured.response;
  const term = q.trim().toLowerCase();
  const hits = Object.values(data.snapshot.items).map((entry) => entry.item)
    .filter((item) => (item.Type === "Movie" || item.Type === "Series") && term && data.clean(item.Name).toLowerCase().includes(term))
    .sort((a, b) => data.clean(a.Name).localeCompare(data.clean(b.Name)) || a.Id.localeCompare(b.Id))
    .map((item) => ({ item, match: { field: "title" }, score: 1 }));
  const rest = hits.slice(1);
  const of = (type, list) => list.filter((hit) => hit.item.Type === type);
  return {
    query: q, ready: true, tookMs: 1, correction: null, partial: false,
    top: hits[0] ? { kind: "item", hit: hits[0] } : null,
    movies: of("Movie", rest).slice(0, limit), series: of("Series", rest).slice(0, limit), collections: [],
    people: [], genres: [], studios: [],
    totals: { movies: of("Movie", hits).length, series: of("Series", hits).length, collections: 0, people: 0 },
  };
}

export function createTentacle({ data, json, note, clock }) {
  const snapshot = new Proxy({}, { get: (_, key) => data.snapshot[key] });
  const vigie = createVigie({ snapshot, listOf: (kind) => data.list(kind), clean: data.clean, poster: data.poster, note, json, clock });

  /** Les modes du jeu de données valent pour le faux Vigie. */
  function syncVigie() {
    vigie.mode.vigie = data.modes.vigie;
    vigie.mode.scenario = data.modes.vigieScenario;
    vigie.mode.demandes = data.modes.demandes;
  }

  const routes = {
    "GET /api/health": (req, res) => (data.modes.health === "error" ? json(res, 500, { status: "error" }) : json(res, 200, { status: "ok" })),
    "GET /api/setup/status": (req, res) => json(res, 200, { state: "running" }),
    "POST /api/auth/refresh": (req, res) => json(res, 200, { AccessToken: "banc" }),
    "GET /api/plugins/active": (req, res) => json(res, 200, vigie.activePlugins()),
    "GET /api/watch-together/invites": (req, res) => json(res, 200, []),
    "GET /api/watch-together/group": (req, res) => json(res, 404, {}),
    "GET /api/config/streaming": (req, res) => json(res, 200, { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null, tokenExpired: false } }),
    "GET /api/config/autoplay": (req, res) => json(res, 200, { enabled: true, countdownSeconds: 10 }),
    "GET /api/preferences/language": (req, res) => json(res, 200, { language: "fr" }),
    "GET /api/preferences/home-layout": (req, res) => {
      const served = data.snapshot.extras?.homeLayout ?? { stored: false, layout: null };
      json(res, 200, served.layout ? { ...served, layout: { ...served.layout, heroMode: data.modes.heroMode } } : served);
    },
    "GET /api/preferences/reco": (req, res) => json(res, 200, { providers: [] }),
    "GET /api/preferences/hints": (req, res) => json(res, 200, { dismissed: [] }),
    "GET /api/ratings": (req, res) => json(res, 200, data.ratings),
    "PUT /api/ratings": (req, res, url, body) => {
      const row = ratingRow({ ...body, seasonNumber: body.seasonNumber ?? 0, episodeNumber: body.episodeNumber ?? 0 });
      data.ratings = data.ratings.filter((r) => !(r.mediaType === row.mediaType && r.tmdbId === row.tmdbId && r.seasonNumber === row.seasonNumber && r.episodeNumber === row.episodeNumber));
      data.ratings.push(row);
      return json(res, 200, row);
    },
    "DELETE /api/ratings/item": (req, res, url) => {
      const q = url.searchParams;
      const same = (r) => r.mediaType === q.get("mediaType") && r.tmdbId === Number(q.get("tmdbId"))
        && r.seasonNumber === Number(q.get("seasonNumber") ?? 0) && r.episodeNumber === Number(q.get("episodeNumber") ?? 0);
      data.ratings = data.ratings.filter((r) => !same(r));
      return json(res, 200, { ok: true });
    },
    "GET /api/reco/page": (req, res) => json(res, 200, data.snapshot.extras?.recoState ?? { state: "ready", generating: false, rows: [] }),
    "POST /api/reco/feedback": (req, res) => json(res, 200, { ok: true }),
    "GET /api/tmdb/trailers": (req, res, url) => {
      const tmdb = url.searchParams.get("tmdbId");
      const entry = Object.entries(data.snapshot.items).find(([, e]) => e.item?.ProviderIds?.Tmdb === tmdb);
      return json(res, 200, (entry && data.detail(entry[0])?.remoteTrailers) ?? { results: [] });
    },
    "GET /api/trailers/readiness": (req, res) => json(res, 200, data.snapshot.extras?.trailerReadiness ?? { state: "ready", reasons: [] }),
    "GET /api/trailers/resolve": (req, res) => json(res, data.modes.trailers === "broken" ? 502 : 404, { error: "banc : aucune bande-annonce" }),
    "GET /api/search/discover": (req, res) => json(res, 200, data.snapshot.extras?.searchDiscover ?? { ready: true, genres: [] }),
    "GET /api/search": (req, res, url) => json(res, 200, search(data, url.searchParams.get("q") ?? "", Number(url.searchParams.get("limit") ?? 6))),
    "GET /api/theme": (req, res) => json(res, 200, {}),
  };

  /** Rend `true` si la route est servie (le corps JSON est déjà lu : `body`). */
  return {
    vigie,
    syncVigie,
    async handle(req, res, url, body, raw) {
      const p = url.pathname;
      if (p.startsWith("/api/plugins/seer/")) {
        syncVigie();
        // Le faux Vigie relit le corps lui-même : on lui rend un flux neuf.
        const replay = Object.assign(Readable.from(raw.length ? [raw] : []), { method: req.method, url: req.url, headers: req.headers });
        await vigie.handle(replay, res, p.slice("/api/plugins/seer".length), url);
        return true;
      }
      const saga = p.match(/^\/api\/sagas\/(\d+)$/);
      if (saga) {
        const found = vigie.sagaOf(Number(saga[1]));
        json(res, found ? 200 : 404, found ?? {});
        return true;
      }
      const route = routes[`${req.method} ${p}`];
      if (!route) return false;
      await route(req, res, url, body);
      return true;
    },
  };
}
