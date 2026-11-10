/**
 * Labo d'Octave — le FAUX SERVEUR : tant que le labo est monté, `window.fetch` répond lui-même à
 * tout ce qui vise `/api/…` (les routes musique du cœur, la configuration, les extensions), sans
 * qu'aucune requête ne parte. Une route inconnue reçoit un 404 immédiat ; tout se note dans
 * `window.__octaveLab` (`calls`, et `misses` que le banc affiche). Le reste (modules, images)
 * passe tel quel.
 *
 * Une scène peut RETENIR des routes (jamais de réponse : les squelettes) ou les faire ÉCHOUER (500).
 */

import { albumDetail, LAB_TRACKS, sourceOf } from "./data/labTracks";
import { LAB_ALBUMS, LAB_ARTISTS } from "./data/labCatalog";
import { labId } from "./data/labIds";
import { artistDetail, LAB_HOME, LAB_LIKED, LAB_LIKED_EMPTY, LAB_SHELVES, LAB_STATUS, searchResponse } from "./data/labHome";
import { LAB_PLAYLISTS, playlistDetail, playlistSharing } from "./data/labPlaylists";

/** Ce que le faux serveur DÉCLARE : la musique et ses fonctions de compte ; aucune extension, aucun hors ligne. */
export const LAB_CONFIG = {
  version: "1.41.0",
  brandName: "Tentacle TV",
  features: { downloads: false, demo: false },
  capabilities: ["music.library", "music.listOrder", "music.playlistManage", "music.playlistMembers", "music.libraryFavorites", "music.addOnTop", "music.searchHistory", "octave.rights"],
} as const;

export interface LabServerRules {
  /** Ces routes ne répondent jamais (l'attente d'une vue). */
  hold: readonly RegExp[];
  /** Ces routes répondent 500 (une vue en erreur). */
  fail: readonly RegExp[];
  /** Aucun titre aimé (l'état vide de « Titres likés »). */
  emptyLiked: boolean;
}

export const NO_RULES: LabServerRules = { hold: [], fail: [], emptyLiked: false };

const LAB_NOW = Date.UTC(2026, 10, 10, 9, 0, 0);

/** `null` : la route n'existe pas dans le faux serveur (à distinguer d'un 404 voulu : un élément absent). */
type Answer = { status: number; body: unknown } | null;
const ok = (body: unknown): Answer => ({ status: 200, body });

const page = <T,>(items: readonly T[]) => ({ items: [...items], total: items.length, cursor: null });

/** La réponse d'une route connue ; `null` : inconnue. */
function answer(method: string, path: string, query: URLSearchParams, rules: LabServerRules): Answer {
  const id = (prefix: string): string | null => (path.startsWith(prefix) ? decodeURIComponent(path.slice(prefix.length)) : null);
  if (path === "/api/config") return ok(LAB_CONFIG);
  if (path === "/api/plugins/active") return ok([]);
  // Les sondes de connectivité : le serveur et Jellyfin « répondent ».
  if (path === "/api/health") return ok({ status: "ok" });
  if (path === "/api/jellyfin/System/Info/Public") return ok({ Id: "lab-jellyfin", ServerName: "Labo", Version: "10.11.0" });
  if (!path.startsWith("/api/music/")) return null;
  if (method !== "GET") return path === "/api/music/match" ? ok({ tracks: [], albums: [] }) : ok({ ok: true });
  if (path === "/api/music/status") return ok(LAB_STATUS);
  if (path === "/api/music/home") return ok(LAB_HOME);
  if (path === "/api/music/albums") return ok(page(sortedAlbums(query.get("sort"))));
  if (path === "/api/music/artists") return ok(page(LAB_ARTISTS));
  if (path === "/api/music/liked") return ok(rules.emptyLiked ? LAB_LIKED_EMPTY : LAB_LIKED);
  if (path === "/api/music/playlists") return ok(LAB_PLAYLISTS);
  if (path === "/api/music/library/shelves") return ok(LAB_SHELVES);
  if (path === "/api/music/playlist-members/candidates") return ok([{ userId: labId("user-lea"), name: "Léa", imageTag: null }]);
  if (path === "/api/music/search") return ok(searchResponse(query.get("q") ?? "", Number(query.get("limit")) || 20));
  if (path === "/api/music/search-history") {
    return ok({ queries: ["marées", "nuit blanche", "canal"].map((text, i) => ({ text, at: LAB_NOW - i * 3_600_000 })), tracks: LAB_TRACKS.slice(15, 19).map((track, i) => ({ track, at: LAB_NOW - i * 7_200_000 })) });
  }
  const prefs = /^\/api\/music\/lists\/([^/]+)\/prefs$/.exec(path);
  if (prefs) return ok(decodeURIComponent(prefs[1] ?? "") === "liked" ? { sort: "added", direction: "desc", custom: null } : { sort: "custom", direction: "asc", custom: null });
  const members = /^\/api\/music\/playlists\/([^/]+)\/members$/.exec(path);
  if (members) return found(playlistSharing(decodeURIComponent(members[1] ?? "")));
  const album = id("/api/music/albums/");
  if (album !== null) return found(albumDetail(album));
  const artist = id("/api/music/artists/");
  if (artist !== null) return found(artistDetail(artist));
  const playlist = id("/api/music/playlists/");
  if (playlist !== null && !playlist.includes("/")) return found(playlistDetail(playlist));
  const source = id("/api/music/source/");
  if (source !== null) return found(LAB_TRACKS.filter((t) => t.jellyfinId === source).map(sourceOf)[0] ?? null);
  return null;
}

const found = (body: unknown): Answer => (body === null ? { status: 404, body: { error: "not_found" } } : ok(body));

function sortedAlbums(sort: string | null) {
  const albums = [...LAB_ALBUMS];
  if (sort === "year") return albums.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  if (sort === "name") return albums.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  return albums;
}

interface LabJournal {
  /** Les routes inconnues (404 immédiat). */
  misses: string[];
  /** Tout ce que le faux serveur a reçu, dans l'ordre : `MÉTHODE chemin → statut`. */
  calls: string[];
}

interface LabWindow {
  __octaveLab?: LabJournal;
}

function journal(): LabJournal {
  const host = window as unknown as LabWindow;
  host.__octaveLab ??= { misses: [], calls: [] };
  return host.__octaveLab;
}

function note(line: string, outcome: number | "retenue" | "inconnue"): void {
  const log = journal();
  log.calls.push(`${line} → ${outcome}`);
  if (outcome === "inconnue" && !log.misses.includes(line)) log.misses.push(line);
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Pose le faux serveur ; rend de quoi rendre `fetch` à la page. Les règles se lisent à CHAQUE requête. */
export function installLabServer(rules: () => LabServerRules): () => void {
  const real = window.fetch;
  const fake: typeof window.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (!url.pathname.startsWith("/api/")) return real.call(window, input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const current = rules();
    const line = `${method} ${url.pathname}`;
    if (current.hold.some((rule) => rule.test(url.pathname))) {
      note(line, "retenue");
      return new Promise<Response>(() => undefined);
    }
    if (current.fail.some((rule) => rule.test(url.pathname))) {
      note(line, 500);
      return Promise.resolve(json(500, { error: "lab_failure" }));
    }
    const reply = answer(method, url.pathname, url.searchParams, current);
    note(line, reply?.status ?? "inconnue");
    return Promise.resolve(reply ? json(reply.status, reply.body) : json(404, { error: "lab_unknown_route" }));
  };
  window.fetch = fake;
  return () => {
    if (window.fetch === fake) window.fetch = real;
  };
}
