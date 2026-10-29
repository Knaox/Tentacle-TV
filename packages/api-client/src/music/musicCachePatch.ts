/**
 * Octave — les retouches OPTIMISTES du cache de la musique. Pur : on donne une
 * valeur du cache, on reçoit la valeur retouchée (la même référence si rien ne
 * change — TanStack ne redessine alors rien).
 *
 * - le cœur d'un titre, où qu'il paraisse (recherche, album, artiste, accueil,
 *   playlist, titres likés, pages infinies) ;
 * - les entrées d'une playlist : insérer, déplacer, retirer — positions
 *   renumérotées comme Jellyfin les rendra.
 */

import type { MusicPlaylistEntry, MusicTrack } from "@tentacle-tv/shared/music";

const MAX_DEPTH = 8;

function isTrack(value: object): value is MusicTrack {
  const v = value as Partial<MusicTrack>;
  return typeof v.key === "string" && typeof v.favorite === "boolean" && typeof v.availability === "string";
}

/** Pose `favorite` sur chaque titre dont l'élément Jellyfin est dans `changes`. */
export function withFavorites<T>(value: T, changes: ReadonlyMap<string, boolean>, depth = 0): T {
  if (value === null || typeof value !== "object" || depth > MAX_DEPTH || changes.size === 0) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item: unknown) => {
      const patched = withFavorites(item, changes, depth + 1);
      if (patched !== item) changed = true;
      return patched;
    });
    return (changed ? next : value) as T;
  }
  if (isTrack(value) && value.jellyfinId && changes.has(value.jellyfinId)) {
    const favorite = changes.get(value.jellyfinId)!;
    return (value.favorite === favorite ? value : { ...value, favorite }) as T;
  }
  // Un album, un artiste, une playlist qui portent leur favori (`music.libraryFavorites`) : posé, puis on descend
  // (un album porte ses titres). Un renvoi d'artiste (`MusicArtistRef`) n'a pas de favori : jamais touché.
  const bearer = value as { jellyfinId?: unknown; favorite?: unknown };
  const own = typeof bearer.jellyfinId === "string" && typeof bearer.favorite === "boolean" ? changes.get(bearer.jellyfinId) : undefined;
  let changed = own !== undefined && own !== bearer.favorite;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const patched = withFavorites(item, changes, depth + 1);
    if (patched !== item) changed = true;
    next[key] = patched;
  }
  if (own !== undefined) next.favorite = own;
  return (changed ? next : value) as T;
}

interface Pages<P> {
  pages: P[];
  pageParams: unknown[];
}

interface LikedPage {
  items: MusicTrack[];
  total: number | null;
  cursor: string | null;
}

/** « Titres likés » (pages infinies) : un cœur retiré sort, un cœur posé entre en tête. */
export function likedAfter<P extends LikedPage>(data: Pages<P> | undefined, track: MusicTrack, favorite: boolean): Pages<P> | undefined {
  if (!data) return data;
  const id = track.jellyfinId;
  const present = data.pages.some((p) => p.items.some((t) => t.jellyfinId === id));
  if (favorite === present) return data;
  if (!favorite) {
    return {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.filter((t) => t.jellyfinId !== id), total: p.total === null ? null : Math.max(0, p.total - 1) })),
    };
  }
  const [first, ...rest] = data.pages;
  if (!first) return data;
  return { ...data, pages: [{ ...first, items: [{ ...track, favorite: true }, ...first.items], total: first.total === null ? null : first.total + 1 }, ...rest] };
}

function renumber(entries: MusicPlaylistEntry[]): MusicPlaylistEntry[] {
  return entries.map((e, position) => (e.position === position ? e : { ...e, position }));
}

/** Insérer des titres à `position` (fin si absente) ; une entrée en attente porte `pending:<clé>`. */
export function insertedEntries(entries: readonly MusicPlaylistEntry[], tracks: readonly MusicTrack[], position?: number): MusicPlaylistEntry[] {
  const at = position === undefined ? entries.length : Math.max(0, Math.min(position, entries.length));
  // Jellyfin ne garde pas un même titre deux fois : celui qui y était déjà change de place.
  const ids = new Set(tracks.map((t) => t.jellyfinId));
  const kept = entries.filter((e) => !ids.has(e.track.jellyfinId));
  const before = kept.filter((e) => e.position < at);
  const after = kept.filter((e) => e.position >= at);
  const added = tracks.map((track) => ({ entryId: `pending:${track.key}`, position: 0, track }));
  return renumber([...before, ...added, ...after]);
}

export function movedEntries(entries: readonly MusicPlaylistEntry[], entryId: string, position: number): MusicPlaylistEntry[] {
  const from = entries.findIndex((e) => e.entryId === entryId);
  if (from < 0) return [...entries];
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(position, next.length)), 0, moved!);
  return renumber(next);
}

export function removedEntry(entries: readonly MusicPlaylistEntry[], entryId: string): MusicPlaylistEntry[] {
  return renumber(entries.filter((e) => e.entryId !== entryId));
}
