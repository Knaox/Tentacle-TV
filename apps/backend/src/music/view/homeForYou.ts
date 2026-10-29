/**
 * Octave — « pour vous » sur l'accueil (`MusicHomeForYou`) : albums et
 * artistes du moment, mixes du jour, « parce que vous avez écouté ». Tout vient
 * de l'index local et de ce que Jellyfin dit des écoutes et des cœurs du compte
 * (déjà lus par l'accueil) : aucune requête de plus à Jellyfin. Les règles sont
 * dans `homeForYouRules.ts` ; le résultat est gardé dix minutes par compte, tant
 * que ses écoutes et ses cœurs n'ont pas changé.
 */

import type { MusicHomeBecause, MusicHomeForYou, MusicHomeMix } from "../contract/musicCoreApi";
import { creditedTo, rowsByIds } from "../index/indexQueries";
import type { IndexRow } from "../index/indexTypes";
import { albumsOf, artistsOf, tracksOf, visibleInOrder, visibleRows, type UserView } from "./viewContext";
import { composeArtistMix, distinctInOrder, mainArtistId, mixArtistOrder, rankArtists, seededShuffle, MIX_SIZE } from "./homeForYouRules";

const RECENT_SHOWN = 12;
const ARTIST_MIXES = 3;
const MIX_MIN_TRACKS = 4;
const FAVORITES_MIX_MIN = 5;
const BECAUSE_MAX = 2;
const BECAUSE_MIN_ALBUMS = 2;
/** Combien d'artistes on essaie au plus pour trouver les mixes et les « parce que » (lectures de l'index). */
const CANDIDATES = 6;
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 200;

const cache = new Map<string, { at: number; signature: string; value: MusicHomeForYou }>();

export interface ForYouInput {
  /** Les titres écoutés, le plus récent d'abord (lignes visibles). */
  recent: readonly IndexRow[];
  most: readonly IndexRow[];
  /** La graine du jour (date UTC) : un mix change chaque jour, pas à chaque ouverture. */
  day: string;
}

async function favoriteRows(view: UserView): Promise<{ tracks: IndexRow[]; artists: Set<string> }> {
  const rows = visibleRows(view, (await rowsByIds([...view.favorites])).values());
  return {
    tracks: rows.filter((r) => r.kind === "track"),
    artists: new Set(rows.filter((r) => r.kind === "artist").map((r) => r.id)),
  };
}

/** Les artistes candidats, visibles du compte, dans l'ordre donné. */
async function visibleArtists(view: UserView, ids: readonly string[]): Promise<IndexRow[]> {
  return (await visibleInOrder(view, ids.slice(0, CANDIDATES))).filter((r) => r.kind === "artist");
}

async function artistMixes(view: UserView, ranked: readonly string[], neighbours: readonly IndexRow[], day: string): Promise<MusicHomeMix[]> {
  const mixes: MusicHomeMix[] = [];
  for (const artist of await visibleArtists(view, ranked)) {
    if (mixes.length >= ARTIST_MIXES) break;
    const own = visibleRows(view, await creditedTo(artist.id, "track"));
    if (own.length < MIX_MIN_TRACKS) continue;
    const others = neighbours.filter((r) => mainArtistId(r) !== artist.id);
    const rows = composeArtistMix(own, others, view.favorites, `${view.userId}|${day}|${artist.id}`);
    mixes.push({
      id: `artist:${artist.id}`,
      kind: "artist",
      artist: artistsOf([artist], view)[0] ?? null,
      artistNames: mixArtistOrder(rows).slice(0, 3),
      tracks: await tracksOf(view, rows),
    });
  }
  return mixes;
}

async function becauseRows(view: UserView, recentArtists: readonly string[], recentAlbumIds: ReadonlySet<string>): Promise<MusicHomeBecause[]> {
  const out: MusicHomeBecause[] = [];
  for (const artist of await visibleArtists(view, recentArtists)) {
    if (out.length >= BECAUSE_MAX) break;
    const albums = visibleRows(view, await creditedTo(artist.id, "album")).filter((a) => !recentAlbumIds.has(a.id));
    if (albums.length < BECAUSE_MIN_ALBUMS) continue;
    const [model] = artistsOf([artist], view);
    if (model) out.push({ artist: model, albums: await albumsOf(view, albums.slice(0, RECENT_SHOWN)) });
  }
  return out;
}

async function compute(view: UserView, input: ForYouInput): Promise<MusicHomeForYou> {
  // Les droits encore une fois, à l'entrée : rien d'invisible ne nourrit un mix, même par un voisin.
  const recent = visibleRows(view, input.recent);
  const most = visibleRows(view, input.most);
  const day = input.day;
  const favorites = await favoriteRows(view);
  const recentAlbumIds = distinctInOrder(recent, (r) => r.albumId);
  const recentArtistIds = distinctInOrder(recent, mainArtistId);
  const ranked = rankArtists({ recent, most, favoriteTracks: favorites.tracks, favoriteArtists: favorites.artists });
  // Les voisins d'un mix : ce que le compte aime ou écoute, d'autres artistes.
  const neighbours = [...new Map([...favorites.tracks, ...most, ...recent].map((r) => [r.id, r])).values()];
  const [albums, artists, mixes, because] = await Promise.all([
    visibleInOrder(view, recentAlbumIds.slice(0, RECENT_SHOWN)),
    visibleInOrder(view, recentArtistIds.slice(0, RECENT_SHOWN)),
    artistMixes(view, ranked, neighbours, day),
    becauseRows(view, recentArtistIds, new Set(recentAlbumIds)),
  ]);
  if (favorites.tracks.length >= FAVORITES_MIX_MIN) {
    const rows = seededShuffle(favorites.tracks, `${view.userId}|${day}|fav`).slice(0, MIX_SIZE * 2);
    mixes.push({ id: "favorites", kind: "favorites", artist: null, artistNames: mixArtistOrder(rows).slice(0, 3), tracks: await tracksOf(view, rows) });
  }
  return {
    recentAlbums: await albumsOf(view, albums),
    recentArtists: artistsOf(artists, view),
    mixes,
    because,
  };
}

export async function forYouView(view: UserView, input: ForYouInput): Promise<MusicHomeForYou> {
  const favorites = [...view.favorites].sort().join(",");
  const signature = [input.day, input.recent.map((r) => r.id).join(","), input.most.map((r) => r.id).join(","), favorites].join("|");
  const known = cache.get(view.userId);
  if (known && known.signature === signature && Date.now() - known.at < CACHE_MS) return known.value;
  const value = await compute(view, input);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(view.userId, { at: Date.now(), signature, value });
  return value;
}

export function resetForYouCacheForTests(): void {
  cache.clear();
}
