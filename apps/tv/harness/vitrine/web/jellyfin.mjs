// Jellyfin tel que le client web le voit derrière le proxy `/api/jellyfin` :
// les routes de lecture du catalogue, servies depuis l'instantané libre. Les
// gestes du compte (favori, vu, note, lecture) répondent comme Jellyfin et
// entrent au journal du faux serveur — ils ne changent rien d'autre.
import path from "node:path";
import { SNAPSHOT } from "../lib/paths.mjs";
import { DEMO_USER_ID, itemOf, listItems, queryItems, viewsOf } from "./library.mjs";

const page = (items) => ({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });

const SYSTEM_INFO = {
  ServerName: "Tentacle",
  Version: "10.11.6",
  ProductName: "Jellyfin Server",
  Id: "tentacle-vitrine",
  StartupWizardCompleted: true,
  OperatingSystem: "Linux",
  LocalAddress: "http://localhost:8096",
};

/** Le dossier de l'image demandée, ou null (Jellyfin répond alors 404). */
function imageFile(library, id, type) {
  const images = library.imagesOf(id);
  const relative = images[type];
  return relative ? path.join(SNAPSHOT, library.lang, relative) : null;
}

/** Une réponse de geste (favori, vu, note) : l'état du compte, comme Jellyfin. */
function userDataReply(item, patch) {
  return { ...(item?.UserData ?? {}), ...patch };
}

/**
 * Sert une route Jellyfin. `route` est le chemin APRÈS `/api/jellyfin`.
 * Rend { status, json } | { status, file } | { status, video } | null.
 */
export function jellyfinRoute(library, method, route, params, journal) {
  const parts = route.split("/").filter(Boolean);
  const [head, a, b, c, d] = parts;
  const lowerHead = head?.toLowerCase();

  if (lowerHead === "system" && a?.toLowerCase().startsWith("info")) return { status: 200, json: { ...SYSTEM_INFO } };
  if (lowerHead === "system" && a === "Ping") return { status: 200, json: "Jellyfin Server" };
  // Mesure de débit du client : quelques octets suffisent, la vitrine est locale.
  if (lowerHead === "playback" && a === "BitrateTest") return { status: 200, bytes: Math.min(Number(params.get("size") ?? 1024), 3_000_000) };
  if (lowerHead === "branding") return { status: 200, json: { LoginDisclaimer: "", CustomCss: "", SplashscreenEnabled: false } };
  if (lowerHead === "displaypreferences") return { status: 200, json: { Id: a, CustomPrefs: {}, SortBy: "SortName", SortOrder: "Ascending" } };

  // ─── Images ─────────────────────────────────────────────────────────────────
  if (lowerHead === "items" && b === "Images" && c) {
    const file = imageFile(library, a, c);
    return file ? { status: 200, file } : { status: 404, json: { error: "image absente" } };
  }
  if (lowerHead === "users" && b === "Images") return { status: 404, json: { error: "pas d'avatar" } };

  // ─── Utilisateurs et vues ───────────────────────────────────────────────────
  if (lowerHead === "users" && (a === "Me" || (a === DEMO_USER_ID && !b))) return { status: 200, json: library.user };
  if (lowerHead === "users" && b === "Views") return { status: 200, json: page(viewsOf(library)) };
  if (lowerHead === "userviews") return { status: 200, json: page(viewsOf(library)) };

  // ─── Gestes du compte ───────────────────────────────────────────────────────
  if (lowerHead === "users" && (b === "FavoriteItems" || b === "PlayedItems")) {
    const field = b === "FavoriteItems" ? "IsFavorite" : "Played";
    journal(`${method} ${b} ${c}`);
    return { status: 200, json: userDataReply(itemOf(library, c), { [field]: method === "POST" }) };
  }
  if (lowerHead === "userfavoriteitems" || lowerHead === "userplayeditems") {
    const field = lowerHead === "userfavoriteitems" ? "IsFavorite" : "Played";
    journal(`${method} ${head} ${a}`);
    return { status: 200, json: userDataReply(itemOf(library, a), { [field]: method === "POST" }) };
  }
  if (lowerHead === "users" && b === "Items" && d === "Rating") {
    journal(`${method} Rating ${c} ${params.get("likes") ?? ""}`);
    return { status: 200, json: userDataReply(itemOf(library, c), { Likes: method === "POST" ? params.get("likes") === "true" : undefined }) };
  }
  if (lowerHead === "useritems" && b === "UserData") {
    journal(`${method} UserData ${a}`);
    return { status: 200, json: userDataReply(itemOf(library, a), {}) };
  }

  // ─── Listes de l'accueil ────────────────────────────────────────────────────
  if ((lowerHead === "users" && b === "Items" && c === "Resume") || (lowerHead === "useritems" && a === "Resume")) {
    return { status: 200, json: page(listItems(library, "resume")) };
  }
  if ((lowerHead === "users" && b === "Items" && c === "Latest") || (lowerHead === "items" && a === "Latest")) {
    const parentId = params.get("ParentId") ?? params.get("parentId");
    const latest = listItems(library, "latest").filter((item) => !parentId || library.libraryOf.get(item.Id) === parentId);
    return { status: 200, json: latest.slice(0, Number(params.get("Limit") ?? 16)) };
  }
  if (lowerHead === "shows" && a === "NextUp") return { status: 200, json: page(listItems(library, "nextUp")) };

  // ─── Séries ─────────────────────────────────────────────────────────────────
  if (lowerHead === "shows" && b === "Seasons") {
    const seasons = (library.snapshot.seasons[a] ?? []).map((id) => itemOf(library, id)).filter(Boolean);
    return { status: 200, json: page(seasons) };
  }
  if (lowerHead === "shows" && b === "Episodes") {
    const seasonId = params.get("SeasonId") ?? params.get("seasonId");
    const seasonIds = seasonId ? [seasonId] : library.snapshot.seasons[a] ?? [];
    const episodes = seasonIds.flatMap((id) => library.snapshot.episodes[id] ?? []).map((id) => itemOf(library, id)).filter(Boolean);
    return { status: 200, json: page(episodes) };
  }

  // ─── Éléments ───────────────────────────────────────────────────────────────
  if (lowerHead === "items" && (a === "Filters" || a === "Filters2")) {
    const parentId = params.get("ParentId") ?? params.get("parentId");
    const genres = library.snapshot.genres[parentId] ?? Object.values(library.snapshot.genres).flat();
    if (a === "Filters2") return { status: 200, json: { Genres: genres.map((g) => ({ Name: g.name, Id: g.id })), Tags: [] } };
    return { status: 200, json: { Genres: genres.map((g) => g.name), Tags: [], OfficialRatings: [], Years: [] } };
  }
  if (lowerHead === "genres") {
    const parentId = params.get("ParentId") ?? params.get("parentId");
    const genres = library.snapshot.genres[parentId] ?? [];
    return { status: 200, json: page(genres.map((g) => ({ Id: g.id, Name: g.name, Type: "Genre", ImageTags: {} }))) };
  }
  if (lowerHead === "studios" || lowerHead === "persons" || lowerHead === "artists") return { status: 200, json: page([]) };
  if (lowerHead === "items" && b === "Similar") {
    const similar = (library.snapshot.detail[a]?.similar ?? []).map((id) => itemOf(library, id)).filter(Boolean);
    return { status: 200, json: page(similar.slice(0, Number(params.get("Limit") ?? 24))) };
  }
  if (lowerHead === "items" && b === "Ancestors") {
    const libId = library.libraryOf.get(a);
    return { status: 200, json: viewsOf(library).filter((view) => view.Id === libId) };
  }
  if ((lowerHead === "items" || lowerHead === "users") && (b === "Collections" || c === "Collections")) return { status: 200, json: page([]) };
  if (lowerHead === "users" && b === "Items" && (d === "SpecialFeatures" || d === "LocalTrailers")) return { status: 200, json: [] };
  if (lowerHead === "items" && (b === "SpecialFeatures" || b === "LocalTrailers" || b === "ThemeMedia")) return { status: 200, json: [] };
  if (lowerHead === "mediasegments") return { status: 200, json: page([]) };

  // ─── Lecture ────────────────────────────────────────────────────────────────
  if (lowerHead === "items" && b === "PlaybackInfo") {
    const item = itemOf(library, a);
    return { status: 200, json: { MediaSources: item?.MediaSources ?? [], PlaySessionId: "vitrine-session" } };
  }
  if (lowerHead === "videos" && (b?.startsWith("stream") || b === "master.m3u8" || b === "main.m3u8")) {
    return { status: 200, video: a };
  }
  if (lowerHead === "videos" && a === "ActiveEncodings") return { status: 204 };
  if (lowerHead === "sessions") {
    journal(`${method} /${parts.join("/")}`);
    return { status: 204 };
  }

  if (lowerHead === "users" && b === "Items" && c) {
    const item = itemOf(library, c);
    return item ? { status: 200, json: item } : { status: 404, json: { error: "inconnu" } };
  }
  if ((lowerHead === "users" && b === "Items") || (lowerHead === "items" && !a)) {
    return { status: 200, json: queryItems(library, params) };
  }
  if (lowerHead === "items" && a && !b) {
    const item = itemOf(library, a);
    return item ? { status: 200, json: item } : { status: 404, json: { error: "inconnu" } };
  }
  return null;
}
