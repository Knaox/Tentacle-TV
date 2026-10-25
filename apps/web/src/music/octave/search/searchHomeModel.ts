/**
 * Octave — l'état AVANT la frappe : le « déjà écouté » relié aux recherches
 * récentes. Règle pure : pour chaque recherche (la plus récente d'abord), ce
 * qu'on a écouté ENSUITE — la file née de cette recherche, ou un titre dont le
 * texte lui répond (« imagine dragons » → un titre d'Imagine Dragons, même
 * lancé depuis la page de l'album) —, puis l'historique de la bibliothèque
 * (« Écoutés récemment » du serveur, qui connaît aussi les autres appareils).
 * Une carte par recherche : l'album, et le titre écouté (deux au plus).
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import { searchTokens } from "@tentacle-tv/shared";
import type { SearchListen } from "./searchListens";
import { matchesDraft } from "./suggestionModel";

export const LISTENED_CARDS_MAX = 4;
const TRACKS_PER_CARD = 2;

export interface ListenedCard {
  /** Stable : la recherche, pliée (clé React). */
  id: string;
  query: string;
  /** Le titre écouté en tête, puis un autre du même album s'il y en a un. */
  tracks: MusicTrack[];
  /** L'album du premier titre, sinon `null` (la carte montre alors le titre seul). */
  albumTitle: string | null;
  artists: string;
  artworkUrl: string | null;
  /** Où ouvrir l'album (`octavePaths.album`), sinon `null`. */
  albumTarget: string | null;
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
  const cards: ListenedCard[] = [];
  for (const query of recents) {
    if (cards.length >= max) break;
    if (searchTokens(query).length === 0) continue;
    const folded = fold(query);
    // Un album déjà montré, ou né d'une AUTRE recherche, n'est pas redit ici : on prend le suivant.
    const candidates = candidatesFor(query, listens, history).filter((c) => (owners.get(albumKeyOf(c)) ?? folded) === folded);
    const lead = candidates.find((c) => !usedAlbums.has(albumKeyOf(c)));
    if (!lead) continue;
    const album = albumKeyOf(lead);
    usedAlbums.add(album);
    const tracks = [lead, ...candidates.filter((c) => c !== lead && albumKeyOf(c) === album)].slice(0, TRACKS_PER_CARD).map((c) => c.track);
    cards.push({
      id: folded,
      query,
      tracks,
      albumTitle: lead.track.album?.title ?? null,
      artists: artistsOf(lead.track),
      artworkUrl: lead.track.artworkUrl,
      albumTarget: lead.albumTarget,
    });
  }
  return cards;
}
