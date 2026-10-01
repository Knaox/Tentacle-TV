// Le backend Tentacle tel que le client web le voit, pour la vitrine : les
// routes qui nourrissent les écrans montrés (accueil, Pour vous, fiche,
// recherche, notes), tirées de l'instantané libre. Une route inconnue répond
// 404 et entre au journal : c'est lui qui dit quoi ajouter ici.
import { idOf } from "../lib/items.mjs";
import { DEMO_USER_ID, itemOf } from "./library.mjs";
import { search, searchEpisodes } from "./search.mjs";


const NOW = "2026-10-01T18:00:00.000Z";

/** Le catalogue des rangées que ce serveur « sait afficher » (TMDB configuré). */
const HOME_ROW_CATALOG = [
  "resume", "nextUp", "reco:forYou", "watched", "watchlist", "favorites",
  "reco:inLibrary", "reco:bestOfLibrary",
].map((key) => ({ key, enabled: ["resume", "nextUp", "reco:forYou", "watchlist"].includes(key) }));

/** Le héros est FIXE (`ctx.hero`, réglé par `/__vitrine/hero?set=<slug>`) :
 *  une capture ne tombe jamais au milieu d'un fondu, et la vitrine choisit
 *  son affiche. */
function homeLayout(library, hero) {
  const libraries = library.snapshot.libraries.map((lib) => ({ key: `library:${lib.id}`, enabled: true }));
  const rows = [
    { key: "resume", enabled: true },
    { key: "nextUp", enabled: true },
    { key: "reco:forYou", enabled: true },
    ...libraries,
    { key: "watchlist", enabled: true },
    { key: "favorites", enabled: true },
  ];
  return {
    stored: true,
    layout: { heroMode: "fixed", heroFixedItemId: idOf(hero), rows, cardDensity: "normal" },
    catalog: HOME_ROW_CATALOG,
  };
}

function recoPage(library) {
  const reco = library.snapshot.extras.recoState;
  return {
    state: "ready",
    signalCount: 24,
    generating: false,
    refining: false,
    exploring: false,
    generatedAt: NOW,
    poolGeneratedAt: NOW,
    tmdbConfigured: true,
    personalized: true,
    filter: null,
    rows: reco.rows,
  };
}

function ratings(library) {
  return Object.entries(library.snapshot.ratings ?? {}).map(([id, score]) => {
    const item = itemOf(library, id);
    return {
      id: `rating-${id}`,
      mediaType: item?.Type === "Series" ? "series" : item?.Type === "Episode" ? "episode" : "movie",
      tmdbId: 0,
      jellyfinItemId: id,
      seasonNumber: 0,
      episodeNumber: 0,
      score,
      syncStatus: "disabled",
      updatedAt: NOW,
    };
  });
}

/**
 * Sert une route du backend (chemin complet, `/api/...`).
 * Rend { status, json } | null (inconnue).
 */
export function backendRoute(library, method, route, params, journal, ctx) {
  const ok = (json) => ({ status: 200, json });
  switch (route) {
    case "/api/health": return ok({ status: "ok", version: "1.22.0", uptime: 3600 });
    case "/api/setup/status": return ok({ state: "running" });
    case "/api/config/streaming": return ok({ directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null } });
    // `publicUrl` posée : sans elle, « Jumeler votre TV » affiche l'avertissement d'administration.
    case "/api/config": return ok({ jellyfinUrl: "http://localhost:8096", publicUrl: "https://tentacle.example", features: {} });
    case "/api/config/autoplay": return ok({ maxResumePct: 90 });
    case "/api/auth/me": return ok({ user: library.user });
    case "/api/auth/refresh": return ok({ ok: true });
    case "/api/preferences/language": return ok({ language: library.lang });
    case "/api/preferences/home-layout": return ok(homeLayout(library, ctx.hero));
    case "/api/preferences/hints": return ok({ dismissed: [] });
    case "/api/preferences/reco": return ok({ stored: true, settings: { personalized: true, includeVigie: false, community: false, shareHistory: false, explorationBalance: 0.3, providerFilter: [], vigieAvailable: false } });
    case "/api/preferences/playback": return ok({ stored: false, settings: {} });
    case "/api/preferences": return ok({ language: library.lang });
    case "/api/reco/page": return ok(recoPage(library));
    case "/api/reco/people": return ok({ people: [] });
    case "/api/reco/people/suggestions": return ok({ results: [] });
    case "/api/preferences/resolve": return ok({ audioIndex: 1, subtitleIndex: null });
    case "/api/pair/devices": return ok([]);
    case "/api/reco/coldstart": return ok({ needed: false, items: [] });
    case "/api/ratings": return method === "GET" ? ok(ratings(library)) : (journal(`${method} /api/ratings`), ok({ ok: true }));
    case "/api/notifications":
    case "/api/notifications/": return ok([]);
    case "/api/notifications/unread-count": return ok({ count: 0 });
    case "/api/admin/jellyfin-key": return ok({ configured: true });
    case "/api/admin/metadata": return ok({ tmdb: { configured: true }, regions: [] });
    case "/api/trailers/readiness": return ok(library.snapshot.extras.trailerReadiness);
    case "/api/search": return ok(search(library, params));
    case "/api/search/episodes": return ok(searchEpisodes(library, params));
    case "/api/search/discover": return ok(library.snapshot.extras.searchDiscover);
    case "/api/watchlist/pending":
    case "/api/likes/pending": return ok({ items: [] });
    case "/api/watchlist/auto-retired": return ok({ items: [] });
    case "/api/plugins/active": return ok([]);
    case "/api/plugins": return ok([]);
    case "/api/watch-together/invites": return ok([]);
    case "/api/watch-together/group": return { status: 404, json: { error: "aucun groupe" } };
    case "/api/tmdb/watch-providers": return ok({ providers: [] });
    case "/api/invites": return ok([]);
    case "/api/tickets": return ok([]);
    case "/api/pair": return ok({ devices: [] });
    case "/api/stats/me": return { status: 404, json: { error: "pas de statistiques dans la vitrine" } };
    default: break;
  }
  if (route.startsWith("/api/playback/segments/")) return ok({ segments: [] });
  if (route.startsWith("/api/sagas/")) return { status: 404, json: { error: "pas de saga" } };
  if (route.startsWith("/api/search/person/")) return ok({ person: null, credits: [] });
  if (route.startsWith("/api/preferences/hints/")) return (journal(`${method} ${route}`), ok({ dismissed: [] }));
  if (route.startsWith("/api/reco/feedback")) return (journal(`${method} ${route}`), ok({ ok: true }));
  if (route.startsWith("/api/watchlist/tmdb") || route.startsWith("/api/likes/tmdb")) return ok({ ok: true });
  return null;
}

export { DEMO_USER_ID };
