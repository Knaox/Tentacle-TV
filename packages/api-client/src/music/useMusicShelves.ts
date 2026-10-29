/**
 * Octave — les FAVORIS de la bibliothèque (albums, artistes, playlists) et
 * l'ORDRE PERSONNEL de chaque rubrique (capacité `music.libraryFavorites`,
 * contrat `musicLibraryShelves.ts`). Un geste se voit tout de suite partout
 * (optimiste : le drapeau `favorite` des cartes, la liste des favoris, l'ordre),
 * puis le serveur le garde ; un refus le défait. Les envois d'ordre d'une même
 * rubrique partent l'un après l'autre, seul le DERNIER compte.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  MUSIC_SHELF_ROUTES,
  shelfKeyOf,
  shelfListKey,
  shelfPlaylistKey,
  type MusicAlbum,
  type MusicArtist,
  type MusicLibraryShelves,
  type MusicShelfFavoriteOutcome,
  type MusicShelfFavoriteRequest,
  type MusicShelfPlaylist,
  type MusicShelfSection,
} from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { musicKeys } from "./musicQueryKeys";
import { patchFavorites } from "./useMusicFavorite";
import { useMusicCapability } from "./useMusicLibrary";
import { latestWinsQueue, markListPrefsSaving } from "./useMusicListOrder";

/** Un élément d'une rubrique, tel qu'un geste le reçoit. */
export type MusicShelfSubject =
  | { section: "albums"; item: MusicAlbum }
  | { section: "artists"; item: MusicArtist }
  | { section: "playlists"; item: MusicShelfPlaylist };

export const musicShelfApi = {
  shelves: (signal?: AbortSignal) => tentacleApiFetch<MusicLibraryShelves>(MUSIC_SHELF_ROUTES.shelves, { signal }),
  favorite: (request: MusicShelfFavoriteRequest) =>
    tentacleApiFetch<MusicShelfFavoriteOutcome>(MUSIC_SHELF_ROUTES.favorite, { method: "PUT", body: JSON.stringify(request) }),
  order: (section: MusicShelfSection, keys: readonly string[]) =>
    tentacleApiFetch<{ section: MusicShelfSection; keys: string[] }>(MUSIC_SHELF_ROUTES.order.replace(":section", section), { method: "PUT", body: JSON.stringify({ keys }) }),
};

/** Le serveur garde-t-il les favoris et l'ordre de la bibliothèque ? Sans lui : ni cœur sur une carte, ni « Vos favoris ». */
export function useMusicShelvesCapability(): boolean {
  const music = useMusicCapability();
  const shelves = useServerCapability("music.libraryFavorites");
  return music && shelves;
}

const EMPTY_SHELVES: MusicLibraryShelves = { albums: [], artists: [], playlists: [], order: { albums: [], artists: [], playlists: [] } };

/** Les favoris et l'ordre de chaque rubrique ; vides tant que le serveur n'a pas répondu (ou ne sait pas). */
export function useMusicShelves(options: { enabled?: boolean } = {}) {
  const capable = useMusicShelvesCapability();
  const query = useQuery({
    queryKey: musicKeys.shelves(),
    queryFn: ({ signal }) => musicShelfApi.shelves(signal),
    enabled: capable && options.enabled !== false,
    staleTime: 60_000,
  });
  return { capable, shelves: query.data ?? EMPTY_SHELVES, ready: !capable || query.isSuccess || query.isError, query };
}

/** La clé d'un élément dans sa rubrique (`shelfKeyOf`). */
export function shelfSubjectKey(subject: MusicShelfSubject): string {
  return subject.section === "playlists" ? shelfPlaylistKey(subject.item) : shelfKeyOf(subject.item);
}

function jellyfinIdOf(subject: MusicShelfSubject): string | null {
  if (subject.section === "playlists") return subject.item.kind === "library" ? subject.item.playlist.jellyfinId : null;
  return subject.item.jellyfinId;
}

/** La requête d'un geste ; l'instantané d'un élément d'extension sans ses titres (une vue en porte des centaines). */
function requestOf(subject: MusicShelfSubject, favorite: boolean): MusicShelfFavoriteRequest | null {
  const jellyfinId = jellyfinIdOf(subject);
  if (jellyfinId) return { section: subject.section, jellyfinId, favorite };
  if (subject.section === "playlists") {
    if (subject.item.kind !== "external") return null;
    const { key, external, title, owner, trackCount, artworkUrl } = subject.item.playlist;
    return { section: "playlists", external, playlist: { key, external, title, owner, trackCount, artworkUrl }, favorite };
  }
  const external = subject.item.external;
  if (!external) return null;
  if (subject.section === "albums") {
    const { tracks: _tracks, description: _description, ...album } = subject.item;
    return { section: "albums", external, album, favorite };
  }
  const { topTracks: _top, albums: _albums, ...artist } = subject.item;
  return { section: "artists", external, artist, favorite };
}

/** Les favoris en cache après un geste (retiré, ou ajouté s'il n'y était pas). Exportée pour les tests. */
export function shelvesAfter(shelves: MusicLibraryShelves, subject: MusicShelfSubject, favorite: boolean): MusicLibraryShelves {
  const key = shelfSubjectKey(subject);
  if (subject.section === "playlists") {
    const list = shelves.playlists.filter((p) => shelfPlaylistKey(p) !== key);
    const item: MusicShelfPlaylist = subject.item.kind === "library" ? { kind: "library", playlist: { ...subject.item.playlist, favorite: true } } : subject.item;
    return { ...shelves, playlists: favorite ? [item, ...list] : list };
  }
  if (subject.section === "albums") {
    const list = shelves.albums.filter((a) => shelfKeyOf(a) !== key);
    return { ...shelves, albums: favorite ? [{ ...subject.item, favorite: true }, ...list] : list };
  }
  const list = shelves.artists.filter((a) => shelfKeyOf(a) !== key);
  return { ...shelves, artists: favorite ? [{ ...subject.item, favorite: true }, ...list] : list };
}

/** L'état du favori d'un élément : son drapeau, sinon sa présence parmi les favoris ; `undefined` sans la capacité. */
export function shelfFavoriteOf(subject: MusicShelfSubject, shelves: MusicLibraryShelves, capable: boolean): boolean | undefined {
  if (!capable) return undefined;
  const flag = subject.section === "playlists" ? (subject.item.kind === "library" ? subject.item.playlist.favorite : undefined) : subject.item.favorite;
  if (flag !== undefined) return flag;
  const key = shelfSubjectKey(subject);
  const list: readonly { key: string }[] =
    subject.section === "playlists" ? shelves.playlists.map((p) => ({ key: shelfPlaylistKey(p) })) : (subject.section === "albums" ? shelves.albums : shelves.artists).map((i) => ({ key: shelfKeyOf(i) }));
  return list.some((i) => i.key === key);
}

type Snapshot = [readonly unknown[], unknown][];

/** Poser ou retirer un favori (bibliothèque ou extension). */
export function useToggleShelfFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subject, favorite }: { subject: MusicShelfSubject; favorite: boolean }) => {
      const request = requestOf(subject, favorite);
      if (!request) throw new Error("shelf_favorite_unsupported");
      return musicShelfApi.favorite(request);
    },
    onMutate: async ({ subject, favorite }) => {
      await qc.cancelQueries({ queryKey: ["music"] });
      const snapshot = qc.getQueriesData({ queryKey: ["music"] }) as Snapshot;
      const jellyfinId = jellyfinIdOf(subject);
      if (jellyfinId) patchFavorites(qc, new Map([[jellyfinId, favorite]]));
      qc.setQueryData<MusicLibraryShelves>(musicKeys.shelves(), (data) => shelvesAfter(data ?? EMPTY_SHELVES, subject, favorite));
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: musicKeys.shelves() });
    },
  });
}

const sendOrder = latestWinsQueue();

function setOrder(qc: QueryClient, section: MusicShelfSection, keys: string[]): void {
  qc.setQueryData<MusicLibraryShelves>(musicKeys.shelves(), (data) => {
    const base = data ?? EMPTY_SHELVES;
    return { ...base, order: { ...base.order, [section]: keys } };
  });
}

/** Garder l'ordre d'une rubrique : tout de suite à l'écran, puis par le serveur (l'écho de `music:shelves` ignoré). */
export function useSaveShelfOrder() {
  const qc = useQueryClient();
  return useCallback(
    (section: MusicShelfSection, keys: string[]) => {
      setOrder(qc, section, keys);
      const listKey = shelfListKey(section);
      const saved = markListPrefsSaving(listKey);
      void sendOrder(listKey, () => musicShelfApi.order(section, keys)).then(() => {
        saved();
        return qc.invalidateQueries({ queryKey: musicKeys.shelves(), refetchType: "none" });
      });
    },
    [qc],
  );
}
