/**
 * Octave — l'état AVANT la frappe : le « déjà écouté » relié aux recherches
 * récentes. Règle pure : pour chaque recherche (la plus récente d'abord), ce
 * qu'on a écouté ENSUITE — la file née de cette recherche, ou un titre dont le
 * texte lui répond (« imagine dragons » → un titre d'Imagine Dragons, même
 * lancé depuis la page de l'album) —, puis l'historique de la bibliothèque
 * (« Écoutés récemment » du serveur, qui connaît aussi les autres appareils).
 * Une carte par recherche : l'ALBUM écouté (le plus récent dont on connaît
 * l'album : page d'album, bibliothèque) ET les titres écoutés (deux au plus,
 * le plus récent d'abord, chacun dit une fois). Un titre venu des résultats
 * d'une extension n'a souvent pas d'album (`album: null`) : le cœur ne
 * l'invente pas — sans album connu, la carte montre le titre seul, une fois.
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import { searchTokens } from "@tentacle-tv/shared";
import type { SearchListen } from "./searchListens";
import { matchesDraft } from "./suggestionModel";

export const LISTENED_CARDS_MAX = 4;
const TRACKS_PER_CARD = 2;

export interface ListenedAlbum {
  title: string;
  artists: string;
  artworkUrl: string | null;
  /** Où ouvrir l'album (`octavePaths.album`), sinon `null`. */
  target: string | null;
}

export interface ListenedCard {
  /** Stable : la recherche, pliée (clé React). */
  id: string;
  query: string;
  /** L'album écouté après cette recherche, s'il est connu. */
  album: ListenedAlbum | null;
  /** Les titres écoutés, le plus récent d'abord (un au moins sans album, deux au plus). */
  tracks: MusicTrack[];
}

export interface SearchHomeSources {
  recents: readonly string[];
  listens: readonly SearchListen[];
  /** L'historique de lecture de la bibliothèque, le plus récent d'abord. */
  history: readonly MusicTrack[];
  max?: number;
}

interface Candidate {
  track: MusicTrack;
  albumTarget: string | null;
}

const fold = (text: string): string => searchTokens(text).join(" ");
const artistsOf = (track: MusicTrack): string => track.artists.map((a) => a.name).join(", ");

function trackText(track: MusicTrack): string {
  return `${track.title} ${artistsOf(track)} ${track.album?.title ?? ""}`;
}

/** Deux titres d'un même album : même cible, sinon même titre d'album et même artiste. */
function albumKeyOf(c: Candidate): string {
  if (c.albumTarget) return `t:${c.albumTarget}`;
  if (c.track.album?.title) return `a:${fold(c.track.album.title)}|${fold(c.track.artists[0]?.name ?? "")}`;
  return `k:${c.track.key}`;
}

function candidatesFor(query: string, listens: readonly SearchListen[], history: readonly MusicTrack[]): Candidate[] {
  const words = searchTokens(query);
  const folded = words.join(" ");
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const l of listens) {
    const linked = l.query !== null && fold(l.query) === folded;
    if ((linked || matchesDraft(words, trackText(l.track))) && !seen.has(l.track.key)) {
      seen.add(l.track.key);
      out.push({ track: l.track, albumTarget: l.albumTarget ?? l.track.album?.jellyfinId ?? null });
    }
  }
  for (const track of history) {
    if (matchesDraft(words, trackText(track)) && !seen.has(track.key)) {
      seen.add(track.key);
      out.push({ track, albumTarget: track.album?.jellyfinId ?? null });
    }
  }
  return out;
}

/**
 * L'album dont une écoute est née d'une recherche lui APPARTIENT : une autre recherche
 * qui lui répond seulement par le texte ne le montre pas à sa place.
 */
function linkedOwners(recents: readonly string[], listens: readonly SearchListen[]): Map<string, string> {
  const recentKeys = new Set(recents.map(fold));
  const owners = new Map<string, string>();
  for (const l of listens) {
    const owner = l.query === null ? null : fold(l.query);
    if (owner === null || !recentKeys.has(owner)) continue;
    const album = albumKeyOf({ track: l.track, albumTarget: l.albumTarget ?? l.track.album?.jellyfinId ?? null });
    if (!owners.has(album)) owners.set(album, owner);
  }
  return owners;
}

export function buildListenedCards({ recents, listens, history, max = LISTENED_CARDS_MAX }: SearchHomeSources): ListenedCard[] {
  const owners = linkedOwners(recents, listens);
  const usedAlbums = new Set<string>();
  const usedTracks = new Set<string>();
  const cards: ListenedCard[] = [];
  for (const query of recents) {
    if (cards.length >= max) break;
    if (searchTokens(query).length === 0) continue;
    const folded = fold(query);
    const candidates = candidatesFor(query, listens, history);
    // L'album : un album déjà montré, ou né d'une AUTRE recherche, n'est pas redit ici.
    const albumOf = candidates.find((c) => c.track.album?.title && !usedAlbums.has(albumKeyOf(c)) && (owners.get(albumKeyOf(c)) ?? folded) === folded);
    // Les titres : jamais celui qu'une carte plus récente montre déjà, ni l'album d'une autre recherche.
    const tracks = candidates
      .filter((c) => !usedTracks.has(c.track.key) && (owners.get(albumKeyOf(c)) ?? folded) === folded)
      .slice(0, TRACKS_PER_CARD)
      .map((c) => c.track);
    if (!albumOf && tracks.length === 0) continue;
    if (albumOf) usedAlbums.add(albumKeyOf(albumOf));
    for (const t of tracks) usedTracks.add(t.key);
    cards.push({
      id: folded,
      query,
      album: albumOf
        ? { title: albumOf.track.album?.title ?? "", artists: artistsOf(albumOf.track), artworkUrl: albumOf.track.artworkUrl, target: albumOf.albumTarget }
        : null,
      tracks: tracks.length > 0 ? tracks : albumOf ? [albumOf.track] : [],
    });
  }
  return cards;
}
