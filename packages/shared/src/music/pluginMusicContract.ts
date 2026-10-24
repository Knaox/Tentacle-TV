/**
 * Octave — le contrat `music` qu'une EXTENSION déclare dans son manifeste, et
 * les formes de ses réponses : les points d'extension 1 à 5
 * (docs/octave/CONTRATS.md, § Points d'extension).
 *
 * Le cœur ne sait RIEN de ce que l'extension cherche ni d'où elle le tient :
 * il valide la forme, l'affiche, relaie les gestes. Aucune extension active,
 * configurée, déclarant `music` et permise au compte : aucun résultat, aucun
 * bouton, aucune trace — comme `search` et `titles` (pluginSearch.ts, pluginTitles.ts).
 *
 * Toutes les routes sont celles DE l'extension, sous `/api/plugins/<id>`, relayées
 * par le cœur après `requireAuth` (runtime isolé, pluginServerRuntime.ts).
 */

import type { ExternalRef, MusicAlbum, MusicArtist, MusicPlaylistEntry, MusicTrack } from "./musicTypes";
import type { PlaybackSource } from "./musicPlayback";

/** Ce que déclare le manifeste (`plugin.json` → `music`), relayé par `/api/plugins/active`. */
export interface PluginMusicManifest {
  /** 1 · Recherche — GET ?q=&limit=&cursor= → `ExternalMusicSearchPage`. */
  search: string;
  /** 2 · Source de lecture — POST { ids } → `ExternalSourcesResponse`. */
  resolve: string;
  /** 2 · Anticipation — POST `MusicPrefetchRequest` → 204. Jamais bloquant. */
  prefetch?: string;
  /** 3 · Cœur — POST { externalId, liked } → `ExternalActionOutcome`. */
  like?: string;
  /** 3 · Playlist — POST { externalId, playlistId, position } → `ExternalActionOutcome`. */
  playlistAdd?: string;
  /** 4 · En attente — GET → `PendingMusicResponse` (les entrées du COMPTE). */
  pending?: string;
  /** Écoute menée au bout d'un titre hors bibliothèque — POST { externalId, completed } → 204. */
  played?: string;
  /** Vue album hors bibliothèque — GET <album>/<albumId> → `MusicAlbum` avec `tracks`. */
  album?: string;
  /** Vue artiste hors bibliothèque — GET <artist>/<artistId> → `MusicArtist` avec `topTracks`, `albums`. */
  artist?: string;
  /** Nom de la section de recherche, par langue (« Pas encore dans la bibliothèque »). */
  labels?: Record<string, string>;
}

/** Ce que les clients lisent d'une extension active (forme réduite d'`ActivePluginMeta`). */
export interface MusicCapablePlugin {
  pluginId: string;
  name: string;
  configEnabled?: boolean;
  music?: PluginMusicManifest;
}

/** 1 · Une page de résultats PROGRESSIVE : `complete` faux → redemander avec `cursor`. */
export interface ExternalMusicSearchPage {
  query: string;
  complete: boolean;
  cursor: string | null;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  /**
   * v2 (requête `revise=1`) : la page porte la liste ENTIÈRE, classée, et REMPLACE tout ce qui
   * précède ; absent : elle s'ajoute (première occurrence d'une clé gardée).
   */
  replace?: boolean;
  /** v2 : ce classement peut encore changer — une page suivante le révisera. */
  provisional?: boolean;
}

/** 2 · Une source par identifiant demandé ; absent = pas de source (le client passe au suivant). */
export interface ExternalSourcesResponse {
  sources: { externalId: string; source: PlaybackSource }[];
}

export type PrefetchIntent =
  /** Les premiers résultats d'une recherche. */
  | "results"
  /** Survol ou focus d'un titre. */
  | "hover"
  /** Appui commencé (mousedown / touchstart) : le clic arrive. */
  | "press"
  /** Le titre suivant de la file. */
  | "next";

export interface MusicPrefetchRequest {
  ids: string[];
  intent: PrefetchIntent;
}

/** 3 · Le résultat d'un geste : le cœur affiche l'état tout de suite, la résolution arrive par `music:resolved`. */
export type ExternalActionOutcome =
  | { ok: true; state: "pending" | "library"; operationId: string | null; jellyfinId: string | null }
  | { ok: false; reason: ExternalActionRefusal; message: string | null };

/** Liste FERMÉE : le client a ses mots pour chacune. */
export type ExternalActionRefusal = "quota" | "forbidden" | "unavailable" | "notFound" | "failed";

/** 4 · Une entrée en attente, pour « Titres likés » ou une playlist. */
export interface PendingMusicItem {
  operationId: string;
  externalId: string;
  kind: "like" | "playlistAdd";
  /** Pour `playlistAdd` : la playlist Jellyfin et la position voulue. */
  playlistId: string | null;
  position: number | null;
  track: MusicTrack;
  state: "pending" | "failed";
  createdAt: number;
}

export interface PendingMusicResponse {
  items: PendingMusicItem[];
}

/** Une entrée en attente rendue comme une entrée de playlist (`pending:<operationId>`). */
export function pendingAsPlaylistEntry(item: PendingMusicItem): MusicPlaylistEntry {
  return { entryId: `pending:${item.operationId}`, position: item.position ?? Number.MAX_SAFE_INTEGER, track: item.track };
}

export function externalRefOf(pluginId: string, externalId: string): ExternalRef {
  return { pluginId, id: externalId };
}

/* ── Lecture du manifeste (même garde que `search` et `titles`) ── */

const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;

function safePath(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.includes("//") ? value : undefined;
}

/** Le contrat `music` d'un manifeste, validé ; `null` si absent ou sans `search` ET `resolve` valides. */
export function readPluginMusicManifest(raw: unknown): PluginMusicManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const search = safePath(m.search);
  const resolve = safePath(m.resolve);
  if (!search || !resolve) return null;
  const out: PluginMusicManifest = { search, resolve };
  for (const key of ["prefetch", "like", "playlistAdd", "pending", "played", "album", "artist"] as const) {
    const path = safePath(m[key]);
    if (path) out[key] = path;
  }
  if (m.labels && typeof m.labels === "object") {
    const labels: Record<string, string> = {};
    for (const [lang, text] of Object.entries(m.labels as Record<string, unknown>)) {
      if (/^[a-z]{2}$/.test(lang) && typeof text === "string" && text.length <= 60) labels[lang] = text;
    }
    out.labels = labels;
  }
  return out;
}
