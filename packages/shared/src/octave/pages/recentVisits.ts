/**
 * Octave — les albums et artistes CONSULTÉS récemment (leur page ouverte),
 * gardés sur l'appareil PAR IDENTITÉ (le propriétaire : serveur + compte, un
 * profil de la Famille ne voit pas ce qu'un autre a ouvert), pour la recherche
 * vide. L'album ou l'artiste tel que sa page l'a montré, sans ses titres. Le
 * plus récent en tête, une fois chacun. Rien ne part du serveur.
 */

import type { MusicAlbum, MusicArtist } from "../../music";
import { readJson, removeKey, writeJson, type OctaveDeviceStore } from "./deviceStore";

/** Clé de stockage : ne jamais la renommer (l'historique de l'appareil y vit). */
export const RECENT_VISITS_KEY = "tentacle_octave_recent_visits";
export const VISITS_MAX = 12;
const MAX_OWNERS = 4;

export type RecentVisit =
  | { kind: "album"; item: MusicAlbum; at: number }
  | { kind: "artist"; item: MusicArtist; at: number };

type Stored = Record<string, { visits: RecentVisit[]; at: number }>;

/** Ce que l'on garde d'une page : jamais ses titres ni ses albums (la carte n'en a pas besoin). */
export function visitOf(kind: "album", item: MusicAlbum, at: number): RecentVisit;
export function visitOf(kind: "artist", item: MusicArtist, at: number): RecentVisit;
export function visitOf(kind: "album" | "artist", item: MusicAlbum | MusicArtist, at: number): RecentVisit {
  if (kind === "album") {
    const { tracks: _tracks, ...album } = item as MusicAlbum;
    void _tracks;
    return { kind, item: album, at };
  }
  const { topTracks: _top, albums: _albums, ...artist } = item as MusicArtist;
  void _top;
  void _albums;
  return { kind, item: artist, at };
}

/** La page ouverte passe en tête ; la même (clé ou élément Jellyfin) n'est gardée qu'une fois. */
export function withVisit(list: readonly RecentVisit[], visit: RecentVisit, max = VISITS_MAX): RecentVisit[] {
  const same = (v: RecentVisit) => v.item.key === visit.item.key || (!!visit.item.jellyfinId && v.item.jellyfinId === visit.item.jellyfinId);
  return [visit, ...list.filter((v) => !same(v))].slice(0, max);
}

function isVisit(value: unknown): value is RecentVisit {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { kind?: unknown; item?: { key?: unknown }; at?: unknown };
  return (v.kind === "album" || v.kind === "artist") && typeof v.item?.key === "string" && typeof v.at === "number";
}

function readAll(store: OctaveDeviceStore | null): Stored {
  const parsed = readJson(store, RECENT_VISITS_KEY);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Stored) : {};
}

export function readRecentVisitsFrom(store: OctaveDeviceStore | null, owner: string | null): RecentVisit[] {
  if (!owner) return [];
  const list = readAll(store)[owner]?.visits;
  return Array.isArray(list) ? list.filter(isVisit).slice(0, VISITS_MAX) : [];
}

export function recordVisitTo(store: OctaveDeviceStore | null, visit: RecentVisit, owner: string | null): void {
  if (!owner) return;
  const all = { ...readAll(store), [owner]: { visits: withVisit(readRecentVisitsFrom(store, owner), visit), at: visit.at } };
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0))
    .slice(0, MAX_OWNERS);
  writeJson(store, RECENT_VISITS_KEY, Object.fromEntries(kept));
}

/** La déconnexion efface les pages consultées, toutes identités confondues. */
export function forgetRecentVisitsIn(store: OctaveDeviceStore | null): void {
  removeKey(store, RECENT_VISITS_KEY);
}
