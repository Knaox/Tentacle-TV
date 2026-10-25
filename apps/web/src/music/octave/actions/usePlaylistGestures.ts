/**
 * Octave — les gestes de PLAYLIST sur un titre, d'où qu'il soit montré (liste, lecteur, plein écran, accès
 * rapide) : ajouter, et retirer — un titre de la bibliothèque comme un titre hors bibliothèque (retirer son
 * ajout en attente annule la demande ; l'extension libère sa copie si plus rien ne la tient).
 *
 * Un titre DÉJÀ dans la playlist (entrée, ou ajout en attente) n'y entre qu'après confirmation (« Déjà dans la
 * playlist — l'ajouter quand même ? ») : un doublon reste permis, jamais par mégarde (retour de Damien, 25/10).
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAddToMusicPlaylist, useMusicGestures, useMusicPlaylistReader, useRemoveMusicPlaylistEntry } from "@tentacle-tv/api-client";
import type { MusicPlaylist, MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { playlistHasTrack, playlistOccurrences } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../contexts/ToastContext";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { usePendingMusic } from "../pending/usePendingMusic";
import { askDuplicate } from "./duplicateConfirm";

export interface PlaylistGestures {
  canAddToPlaylist: (track: MusicTrack) => boolean;
  /** `position` : la place voulue (0 = en tête) ; absente, à la fin. Demande confirmation d'un doublon. */
  addToPlaylist: (track: MusicTrack, playlist: MusicPlaylist, position?: number) => Promise<boolean>;
  canRemoveFromPlaylist: (track: MusicTrack) => boolean;
  /** Retire UNE occurrence du titre de cette playlist (une entrée Jellyfin, sinon un ajout en attente). */
  removeFromPlaylist: (track: MusicTrack, playlist: MusicPlaylist) => Promise<boolean>;
  /** Retire une entrée EN ATTENTE (rangée `pending:` d'une playlist). */
  removePending: (operationId: string) => Promise<boolean>;
}

export function isLibraryTrack(track: MusicTrack): track is MusicTrack & { jellyfinId: string } {
  return track.availability === "library" && track.jellyfinId !== null;
}

export function usePlaylistGestures(): PlaylistGestures {
  const { t } = useTranslation("music");
  const toast = useToast();
  const provider = useOctaveProvider();
  const gestures = useMusicGestures(provider);
  const readPlaylist = useMusicPlaylistReader();
  const { mutateAsync: insertEntries } = useAddToMusicPlaylist();
  const { mutateAsync: removeEntry } = useRemoveMusicPlaylistEntry();
  // Lue au geste, jamais une dépendance : les gestes restent STABLES (une liste de 500 rangées ne se redessine pas
  // à chaque relecture des attentes).
  const pending = usePendingMusic();
  const pendingRef = useRef<readonly PendingMusicItem[]>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const failed = useCallback((reason: string = "failed") => toast.show("error", t(`refusal.${reason}`), { title: t("refusal.title") }), [t, toast]);
  const ownsTrack = useCallback((track: MusicTrack) => isFromProvider(provider, track.external?.pluginId), [provider]);

  /** Le titre est-il déjà dans la playlist ? Une lecture impossible ne bloque pas l'ajout. */
  const alreadyIn = useCallback(
    async (track: MusicTrack, playlist: MusicPlaylist): Promise<boolean> => {
      const detail = await readPlaylist(playlist.jellyfinId).catch(() => null);
      return playlistHasTrack(detail?.entries ?? [], pendingRef.current, playlist.jellyfinId, track);
    },
    [readPlaylist],
  );

  const addToPlaylist = useCallback(
    async (track: MusicTrack, playlist: MusicPlaylist, position?: number): Promise<boolean> => {
      try {
        const duplicate = await alreadyIn(track, playlist);
        if (duplicate && !(await askDuplicate(track.title, playlist.name))) return false;
        if (isLibraryTrack(track)) {
          await insertEntries({ playlistId: playlist.jellyfinId, itemIds: [track.jellyfinId], position, tracks: [track] });
          toast.show("success", t("playlist.added", { name: playlist.name }));
          return true;
        }
        if (!track.external || !ownsTrack(track)) return false;
        const outcome = await gestures.playlistAdd(track.external.id, playlist.jellyfinId, position ?? playlist.trackCount, duplicate);
        if (!outcome.ok) {
          failed(outcome.reason);
          return false;
        }
        toast.show("success", t(outcome.state === "pending" ? "playlist.addedPending" : "playlist.added", { name: playlist.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [alreadyIn, failed, gestures, insertEntries, ownsTrack, t, toast],
  );

  const removePending = useCallback(
    async (operationId: string): Promise<boolean> => {
      const done = await gestures.removePending(operationId).catch(() => false);
      if (!done) failed();
      return done;
    },
    [failed, gestures],
  );

  const removeFromPlaylist = useCallback(
    async (track: MusicTrack, playlist: MusicPlaylist): Promise<boolean> => {
      try {
        const detail = await readPlaylist(playlist.jellyfinId);
        const found = playlistOccurrences(detail.entries, pendingRef.current, playlist.jellyfinId, track);
        const entryId = found.entryIds[0];
        const operationId = found.operationIds[0];
        if (entryId) await removeEntry({ playlistId: playlist.jellyfinId, entryId });
        else if (!operationId || !(await removePending(operationId))) {
          if (!operationId) toast.show("info", t("playlist.notIn", { title: track.title, name: playlist.name }));
          return false;
        }
        toast.show("success", t("playlist.removed", { name: playlist.name }));
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [failed, readPlaylist, removeEntry, removePending, t, toast],
  );

  return useMemo(
    () => ({
      canAddToPlaylist: (track: MusicTrack) => isLibraryTrack(track) || (ownsTrack(track) && gestures.canPlaylistAdd),
      addToPlaylist,
      canRemoveFromPlaylist: (track: MusicTrack) => isLibraryTrack(track) || (ownsTrack(track) && gestures.canRemovePending),
      removeFromPlaylist,
      removePending,
    }),
    [addToPlaylist, gestures.canPlaylistAdd, gestures.canRemovePending, ownsTrack, removeFromPlaylist, removePending],
  );
}
