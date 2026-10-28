/**
 * Octave — chercher dans la musique GARDÉE, sans réseau (règle PURE,
 * `keptSearch.test.ts`) : la même pertinence que les recherches du cœur
 * (`searchScore`, accents et casse ignorés, mots soudés ou dispersés), sur le
 * titre, l'artiste et l'album de chaque titre gardé, et sur le nom des albums et
 * playlists gardés en entier. Hors ligne, la recherche d'Octave y ajoute ses
 * recherches déjà faites (la cache de la coquille, catalogue de l'extension
 * compris) : rien de plus n'est inventé.
 */

import { searchScore } from "@tentacle-tv/shared";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { DeviceCollection } from "./deviceModel";

export interface KeptSearchResult {
  tracks: MusicTrack[];
  collections: DeviceCollection[];
}

const MAX_TRACKS = 50;

function trackScore(track: MusicTrack, query: string): number {
  const artist = track.artists.map((a) => a.name).join(" ");
  // Le titre d'abord : un titre qui répond passe devant un artiste qui répond.
  return Math.max(searchScore(track.title, query), searchScore(artist, query) * 0.9, searchScore(track.album?.title ?? "", query) * 0.8);
}

export function searchKept(tracks: readonly MusicTrack[], collections: readonly DeviceCollection[], query: string): KeptSearchResult {
  if (query.trim().length === 0) return { tracks: [], collections: [] };
  const scored = tracks.map((track) => ({ track, score: trackScore(track, query) })).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const found = collections
    .map((collection) => ({ collection, score: Math.max(searchScore(collection.title, query), searchScore(collection.subtitle ?? "", query) * 0.9) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return { tracks: scored.slice(0, MAX_TRACKS).map((s) => s.track), collections: found.map((s) => s.collection) };
}
