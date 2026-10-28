/**
 * Octave — ce qu'on a ÉCOUTÉ, gardé sur l'appareil, pour le « déjà écouté » de
 * la recherche (`SearchHome`) : chaque titre dont le premier son est sorti,
 * avec la recherche qui l'a lancé quand la file en vient (`search:<requête>`)
 * et l'album d'où il a été lancé. Le plus récent en tête, un titre une fois.
 * Rien ne part du serveur ni de l'extension : c'est la mémoire de l'appareil,
 * comme les recherches récentes.
 */

import type { MusicTrack } from "../../music";
import type { OctavePlayer } from "../octavePlayer";
import { currentItem } from "../queueModel";
import { readJson, writeJson, type OctaveDeviceStore } from "./deviceStore";

/** Clé de stockage : ne jamais la renommer (l'historique de l'appareil y vit). */
export const SEARCH_LISTENS_KEY = "tentacle_octave_search_listens";
export const LISTENS_MAX = 40;

export interface SearchListen {
  /** Le titre tel que la file le jouait : le relancer n'attend aucune requête. */
  track: MusicTrack;
  /** La recherche validée d'où vient la file, sinon `null`. */
  query: string | null;
  /** Où ouvrir son album : identifiant Jellyfin ou clé `ext:<pluginId>:<id>`, sinon `null`. */
  albumTarget: string | null;
  at: number;
}

/** Les files nées d'une recherche : `search:<requête>`, et ses listes `:side` (meilleur résultat), `:tracks` (puce). */
export function queryOfContext(contextId: string | null): string | null {
  if (!contextId?.startsWith("search:")) return null;
  const query = contextId.slice("search:".length).replace(/:(side|tracks)$/, "").trim();
  return query || null;
}

export function albumTargetOf(track: MusicTrack, contextId: string | null): string | null {
  if (track.album?.jellyfinId) return track.album.jellyfinId;
  if (contextId?.startsWith("album:")) return contextId.slice("album:".length) || null;
  return null;
}

/**
 * Le titre écouté passe en tête. Réécouté hors d'une recherche, il GARDE la recherche
 * qui l'avait fait découvrir — et l'album d'où on l'avait lancé.
 */
export function withListen(list: readonly SearchListen[], listen: SearchListen, max = LISTENS_MAX): SearchListen[] {
  const previous = list.find((l) => l.track.key === listen.track.key);
  const merged: SearchListen = {
    ...listen,
    query: listen.query ?? previous?.query ?? null,
    albumTarget: listen.albumTarget ?? previous?.albumTarget ?? null,
  };
  return [merged, ...list.filter((l) => l.track.key !== listen.track.key)].slice(0, max);
}

function isTrack(value: unknown): value is MusicTrack {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Partial<MusicTrack>;
  return typeof t.key === "string" && typeof t.title === "string" && Array.isArray(t.artists);
}

function isListen(value: unknown): value is SearchListen {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Partial<SearchListen>;
  return isTrack(l.track) && typeof l.at === "number" && (l.query === null || typeof l.query === "string")
    && (l.albumTarget === null || typeof l.albumTarget === "string");
}

export function readSearchListensFrom(store: OctaveDeviceStore | null): SearchListen[] {
  const parsed = readJson(store, SEARCH_LISTENS_KEY);
  return Array.isArray(parsed) ? parsed.filter(isListen).slice(0, LISTENS_MAX) : [];
}

export function writeSearchListensTo(store: OctaveDeviceStore | null, list: readonly SearchListen[]): void {
  writeJson(store, SEARCH_LISTENS_KEY, list);
}

/** Note un titre écouté (premier son sorti) depuis la file `contextId`. */
export function recordSearchListenTo(store: OctaveDeviceStore | null, track: MusicTrack, contextId: string | null, at: number): void {
  const listen: SearchListen = { track, query: queryOfContext(contextId), albumTarget: albumTargetOf(track, contextId), at };
  writeSearchListensTo(store, withListen(readSearchListensFrom(store), listen));
}

/** Une recherche oubliée emporte le lien de ses écoutes (les titres restent, sans recherche). */
export function forgetSearchListensIn(store: OctaveDeviceStore | null, query: string): void {
  const key = query.trim().toLocaleLowerCase();
  const list = readSearchListensFrom(store);
  if (!list.some((l) => l.query?.toLocaleLowerCase() === key)) return;
  writeSearchListensTo(store, list.map((l) => (l.query?.toLocaleLowerCase() === key ? { ...l, query: null } : l)));
}

/**
 * L'enregistreur du « déjà écouté » : suit le lecteur et note chaque titre dont le PREMIER son est sorti (pas un
 * clic sans son, pas un préchargement), une écriture par titre. Rend sa désinscription. Web et mobile.
 */
export function recordSearchListensTo(player: OctavePlayer, store: OctaveDeviceStore | null, now: () => number = Date.now): () => void {
  let noted: string | null = null;
  return player.snapshot.subscribe(() => {
    const snap = player.snapshot.get();
    const item = currentItem(snap.queue);
    if (!item || snap.phase !== "playing" || item.uid === noted) return;
    noted = item.uid;
    recordSearchListenTo(store, item.track, snap.queue.contextId, now());
  });
}
