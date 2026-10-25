/**
 * Octave — les playlists du compte (des playlists JELLYFIN, contrat). Chaque
 * geste sur une playlist ouverte se voit tout de suite (optimiste : insérer à
 * une position, déplacer, retirer), puis la réponse du serveur — la playlist
 * telle que Jellyfin la tient — remplace l'optimiste ; un refus le défait.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { MusicPlaylistDetail, MusicTrack } from "@tentacle-tv/shared/music";
import { musicApi } from "./musicApi";
import { insertedEntries, movedEntries, removedEntry } from "./musicCachePatch";
import { musicKeys } from "./musicQueryKeys";
import { useMusicCapability } from "./useMusicLibrary";

export function useMusicPlaylists(options: { enabled?: boolean } = {}) {
  const capable = useMusicCapability();
  return useQuery({
    queryKey: musicKeys.playlists(),
    queryFn: ({ signal }) => musicApi.playlists(signal),
    enabled: capable && options.enabled !== false,
    staleTime: 60_000,
  });
}

export function useMusicPlaylist(id: string | null | undefined) {
  const capable = useMusicCapability();
  return useQuery({
    queryKey: musicKeys.playlist(id ?? ""),
    queryFn: ({ signal }) => musicApi.playlist(id!, signal),
    enabled: capable && !!id,
    staleTime: 30_000,
  });
}

/**
 * Lire une playlist À LA DEMANDE (avant un ajout : le titre y est-il déjà ? ; avant un retrait depuis le lecteur) :
 * le cache s'il est frais, sinon une requête — sans monter une requête par playlist dans chaque menu.
 */
export function useMusicPlaylistReader(): (id: string) => Promise<MusicPlaylistDetail> {
  const qc = useQueryClient();
  return useCallback(
    (id: string) => qc.fetchQuery({ queryKey: musicKeys.playlist(id), queryFn: ({ signal }) => musicApi.playlist(id, signal), staleTime: 30_000 }),
    [qc],
  );
}

type Edit = (entries: MusicPlaylistDetail["entries"]) => MusicPlaylistDetail["entries"];

/** Un geste optimiste sur une playlist ouverte : retouche, réponse du serveur, ou retour arrière. */
function usePlaylistEdit<V extends { playlistId: string }>(run: (vars: V) => Promise<MusicPlaylistDetail>, edit: (vars: V) => Edit | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async (vars: V) => {
      const key = musicKeys.playlist(vars.playlistId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<MusicPlaylistDetail>(key);
      const change = edit(vars);
      if (previous && change) {
        const entries = change(previous.entries);
        qc.setQueryData<MusicPlaylistDetail>(key, { ...previous, entries, trackCount: entries.length });
      }
      return { previous };
    },
    onError: (_error, vars, context) => {
      if (context?.previous) qc.setQueryData(musicKeys.playlist(vars.playlistId), context.previous);
    },
    onSuccess: (detail, vars) => {
      qc.setQueryData(musicKeys.playlist(vars.playlistId), detail);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: musicKeys.playlists() });
    },
  });
}

/** Ajouter des titres, à une position (fin si absente). `tracks` permet l'optimiste ; sans eux, la réponse fait foi. */
export function useAddToMusicPlaylist() {
  return usePlaylistEdit(
    (v: { playlistId: string; itemIds: string[]; position?: number; tracks?: MusicTrack[] }) => musicApi.insertEntries(v.playlistId, v.itemIds, v.position),
    (v) => (v.tracks?.length ? (entries) => insertedEntries(entries, v.tracks!, v.position) : null),
  );
}

export function useMoveMusicPlaylistEntry() {
  return usePlaylistEdit(
    (v: { playlistId: string; entryId: string; position: number }) => musicApi.moveEntry(v.playlistId, v.entryId, v.position),
    (v) => (entries) => movedEntries(entries, v.entryId, v.position),
  );
}

export function useRemoveMusicPlaylistEntry() {
  return usePlaylistEdit(
    (v: { playlistId: string; entryId: string }) => musicApi.removeEntry(v.playlistId, v.entryId),
    (v) => (entries) => removedEntry(entries, v.entryId),
  );
}

export function useRenameMusicPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { playlistId: string; name: string }) => musicApi.renamePlaylist(v.playlistId, v.name),
    onSuccess: (detail, v) => {
      qc.setQueryData(musicKeys.playlist(v.playlistId), detail);
      void qc.invalidateQueries({ queryKey: musicKeys.playlists() });
    },
  });
}

export function useCreateMusicPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; itemIds?: string[] }) => musicApi.createPlaylist(v.name, v.itemIds ?? []),
    onSuccess: (detail) => {
      qc.setQueryData(musicKeys.playlist(detail.jellyfinId), detail);
      void qc.invalidateQueries({ queryKey: musicKeys.playlists() });
    },
  });
}

export function useDeleteMusicPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { playlistId: string }) => musicApi.deletePlaylist(v.playlistId),
    onSuccess: (_ok, v) => forgetPlaylist(qc, v.playlistId),
  });
}

function forgetPlaylist(qc: QueryClient, playlistId: string): void {
  qc.removeQueries({ queryKey: musicKeys.playlist(playlistId) });
  void qc.invalidateQueries({ queryKey: musicKeys.playlists() });
  void qc.invalidateQueries({ queryKey: musicKeys.home() });
}
