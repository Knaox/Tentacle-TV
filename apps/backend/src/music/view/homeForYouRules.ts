/**
 * Octave — les règles PURES des suggestions de l'accueil (`homeForYou.ts`) :
 * quels artistes comptent pour ce compte, comment se compose un mix, et un
 * mélange stable pour la journée. Aucune lecture : des lignes de l'index en
 * entrée, des identifiants et des lignes en sortie.
 */

import type { IndexRow } from "../index/indexTypes";

export const MIX_SIZE = 25;
const FAVORITE_ARTIST_SCORE = 3;
const MOST_PLAYED_SCORE = 1.5;
const FAVORITE_TRACK_SCORE = 1;

/** L'artiste principal d'une ligne (le premier crédité qui a un élément Jellyfin). */
export function mainArtistId(row: IndexRow): string | null {
  return row.artists.find((a) => a.id)?.id ?? null;
}

/** Les éléments distincts, dans l'ordre de leur première apparition. */
export function distinctInOrder<T>(items: readonly T[], key: (item: T) => string | null): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (k && !seen.has(k)) seen.add(k);
  }
  return [...seen];
}

export interface ArtistSignals {
  /** Les titres écoutés, le plus récent d'abord. */
  recent: readonly IndexRow[];
  /** Les titres les plus écoutés. */
  most: readonly IndexRow[];
  /** Les titres aimés. */
  favoriteTracks: readonly IndexRow[];
  /** Les artistes aimés (identifiants Jellyfin). */
  favoriteArtists: ReadonlySet<string>;
}

/**
 * Les artistes qui comptent, du plus au moins : une écoute récente pèse d'autant plus qu'elle est
 * récente (1 → 0,5), un titre parmi les plus écoutés 1,5, un titre aimé 1 ; un artiste aimé n'entre
 * qu'avec AU MOINS une écoute ou un titre aimé (+3) — un cœur ancien sans écoute ne fait pas un mix.
 */
export function rankArtists({ recent, most, favoriteTracks, favoriteArtists }: ArtistSignals): string[] {
  const score = new Map<string, number>();
  const add = (id: string | null, points: number) => {
    if (id) score.set(id, (score.get(id) ?? 0) + points);
  };
  recent.forEach((row, i) => add(mainArtistId(row), 1 - (0.5 * i) / Math.max(recent.length, 1)));
  for (const row of most) add(mainArtistId(row), MOST_PLAYED_SCORE);
  for (const row of favoriteTracks) add(mainArtistId(row), FAVORITE_TRACK_SCORE);
  for (const id of score.keys()) if (favoriteArtists.has(id)) add(id, FAVORITE_ARTIST_SCORE);
  return [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
}

/** FNV-1a : une graine de texte → un entier. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Un mélange déterminé par la graine (mulberry32) : le même jour, le même ordre. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = hash(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Un mix d'artiste : ses titres (les aimés d'abord, puis le reste mélangé) entrelacés avec des titres
 * VOISINS (aimés ou écoutés d'autres artistes du compte) — deux du principal pour un voisin —, chaque
 * titre une fois, jamais deux fois de suite le même album. Sans voisin : l'artiste seul.
 */
export function composeArtistMix(
  primary: readonly IndexRow[],
  companions: readonly IndexRow[],
  favorites: ReadonlySet<string>,
  seed: string,
  size = MIX_SIZE,
): IndexRow[] {
  const shuffled = seededShuffle(primary, `${seed}|p`);
  const own = [...shuffled.filter((r) => favorites.has(r.id)), ...shuffled.filter((r) => !favorites.has(r.id))];
  const others = seededShuffle(companions, `${seed}|c`);
  const out: IndexRow[] = [];
  const used = new Set<string>();
  // Le premier titre inédit qui ne reprend pas l'album du précédent ; à défaut, le premier inédit.
  const pickFrom = (queue: IndexRow[]): IndexRow | null => {
    const last = out[out.length - 1];
    const fresh = queue.findIndex((r) => !used.has(r.id) && !(last?.albumId && r.albumId === last.albumId));
    const index = fresh !== -1 ? fresh : queue.findIndex((r) => !used.has(r.id));
    if (index === -1) return null;
    const [row] = queue.splice(index, 1);
    return row ?? null;
  };
  while (out.length < size) {
    const companionTurn = out.length % 3 === 2;
    // Le mix finit avec les titres de son artiste : des voisins seuls ne font plus « son » mix.
    const row = companionTurn ? (pickFrom(others) ?? pickFrom(own)) : pickFrom(own);
    if (!row) break;
    out.push(row);
    used.add(row.id);
  }
  return out;
}

/** Les artistes d'un mix, les plus présents d'abord. */
export function mixArtistOrder(rows: readonly IndexRow[]): string[] {
  const count = new Map<string, number>();
  for (const row of rows) {
    const name = row.artists[0]?.name;
    if (name) count.set(name, (count.get(name) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}
