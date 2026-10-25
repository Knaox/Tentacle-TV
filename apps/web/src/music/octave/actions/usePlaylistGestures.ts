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
import { useAddToMusicPlaylist, useCreateMusicPlaylist, useMusicGestures, useMusicPlaylistReader, useMusicPlaylists, useRemoveMusicPlaylistEntry } from "@tentacle-tv/api-client";
import type { ExternalActionRefusal, MusicPlaylist, MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { playlistHasTrack, playlistOccurrences } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../contexts/ToastContext";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";
import { usePendingMusic } from "../pending/usePendingMusic";
import { askDuplicate } from "./duplicateConfirm";
import { lastPlaylistId, quickTarget, rememberPlaylist } from "./lastPlaylist";
import { openPlaylistChooser } from "./playlistChooserStore";
import { useAcquireRights } from "../rights/useAcquireRights";

export interface PlaylistGestures {
  canAddToPlaylist: (track: MusicTrack) => boolean;
  /** `position` : la place voulue (0 = en tête) ; absente, à la fin. Demande confirmation d'un doublon. */
  addToPlaylist: (track: MusicTrack, playlist: MusicPlaylist, position?: number) => Promise<boolean>;
  canRemoveFromPlaylist: (track: MusicTrack) => boolean;
  /** Retire UNE occurrence du titre de cette playlist (une entrée Jellyfin, sinon un ajout en attente). */
  removeFromPlaylist: (track: MusicTrack, playlist: MusicPlaylist) => Promise<boolean>;
  /** Retire une entrée EN ATTENTE (rangée `pending:` d'une playlist). */
  removePending: (operationId: string) => Promise<boolean>;
  /** « Nouvelle playlist… » : la crée sous ce nom, et le titre y entre aussitôt. */
  createPlaylistAndAdd: (track: MusicTrack, name: string) => Promise<boolean>;
  /** Le « + » : d'un geste dans la DERNIÈRE playlist utilisée (avis « Ajouté à X — Changer ») ; sans elle, le choix. */
  quickAdd: (track: MusicTrack) => Promise<boolean>;
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
  const { mutateAsync: createPlaylist } = useCreateMusicPlaylist();
  const playlists = useMusicPlaylists();
  const playlistsRef = useRef<readonly MusicPlaylist[]>([]);
  useEffect(() => {
    playlistsRef.current = playlists.data ?? [];
  }, [playlists.data]);
  // Lue au geste, jamais une dépendance : les gestes restent STABLES (une liste de 500 rangées ne se redessine pas
  // à chaque relecture des attentes).
  const pending = usePendingMusic();
  const pendingRef = useRef<readonly PendingMusicItem[]>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Ajouter à une playlist un titre hors bibliothèque l'AJOUTE à la bibliothèque : le droit et la limite du jour.
  const acquire = useAcquireRights();
  const acquireRef = useRef(acquire);
  useEffect(() => {
    acquireRef.current = acquire;
  }, [acquire]);
  const failed = useCallback((reason: ExternalActionRefusal = "failed") => {
    const said = acquireRef.current.refusal(reason);
    toast.show("error", said.message, { title: said.title });
  }, [toast]);
  /** L'avis d'un ajout réussi ; s'il attend la bibliothèque, le reste du jour quand on approche de la limite. */
  const added = useCallback((pending: boolean, name: string, change?: { action: { label: string; onPress: () => void } }) => {
    const message = t(pending ? "playlist.addedPending" : "playlist.added", { name });
    const left = pending ? acquireRef.current.acquired() : null;
    toast.show("success", left ?? message, left ? { ...change, title: message } : change);
  }, [t, toast]);
  const ownsTrack = useCallback((track: MusicTrack) => isFromProvider(provider, track.external?.pluginId), [provider]);

  /** Le titre est-il déjà dans la playlist ? Une lecture impossible ne bloque pas l'ajout. */
  const alreadyIn = useCallback(
    async (track: MusicTrack, playlist: MusicPlaylist): Promise<boolean> => {
      const detail = await readPlaylist(playlist.jellyfinId).catch(() => null);
      return playlistHasTrack(detail?.entries ?? [], pendingRef.current, playlist.jellyfinId, track);
    },
    [readPlaylist],
  );

  /** L'ajout ; `offerChange` : l'avis porte « Changer » (le « + » a choisi la playlist tout seul). */
  const add = useCallback(
    async (track: MusicTrack, playlist: MusicPlaylist, position?: number, offerChange = false): Promise<boolean> => {
      try {
        const duplicate = await alreadyIn(track, playlist);
        if (duplicate && !(await askDuplicate(track.title, playlist.name))) return false;
        let pending = false;
        if (isLibraryTrack(track)) {
          await insertEntries({ playlistId: playlist.jellyfinId, itemIds: [track.jellyfinId], position, tracks: [track] });
        } else {
          if (!track.external || !ownsTrack(track)) return false;
          if (acquireRef.current.exhausted) return failed("quota"), false;
          const outcome = await gestures.playlistAdd(track.external.id, playlist.jellyfinId, position ?? playlist.trackCount, duplicate);
          if (!outcome.ok) {
            failed(outcome.reason);
            return false;
          }
          pending = outcome.state === "pending";
        }
        rememberPlaylist(playlist.jellyfinId);
        const change = offerChange ? { action: { label: t("playlist.change"), onPress: () => openPlaylistChooser(track, playlist) } } : undefined;
        added(pending, playlist.name, change);
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [added, alreadyIn, failed, gestures, insertEntries, ownsTrack, t],
  );
  const addToPlaylist = useCallback((track: MusicTrack, playlist: MusicPlaylist, position?: number) => add(track, playlist, position), [add]);

  const quickAdd = useCallback(
    async (track: MusicTrack): Promise<boolean> => {
      const target = quickTarget(playlistsRef.current, lastPlaylistId());
      if (!target) {
        openPlaylistChooser(track);
        return false;
      }
      return add(track, target, undefined, true);
    },
    [add],
  );

  const createPlaylistAndAdd = useCallback(
    async (track: MusicTrack, name: string): Promise<boolean> => {
      try {
        const library = isLibraryTrack(track);
        if (!library && (!track.external || !ownsTrack(track))) return false;
        const created = await createPlaylist({ name, itemIds: library ? [track.jellyfinId] : [] });
        let pending = false;
        if (!library && track.external) {
          const outcome = await gestures.playlistAdd(track.external.id, created.jellyfinId, 0);
          if (!outcome.ok) {
            failed(outcome.reason);
            return false;
          }
          pending = outcome.state === "pending";
        }
        rememberPlaylist(created.jellyfinId);
        added(pending, created.name);
        return true;
      } catch {
        failed();
        return false;
      }
    },
    [added, createPlaylist, failed, gestures, ownsTrack],
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
      canAddToPlaylist: (track: MusicTrack) => isLibraryTrack(track) || (ownsTrack(track) && gestures.canPlaylistAdd && acquire.canAcquire),
      addToPlaylist,
      canRemoveFromPlaylist: (track: MusicTrack) => isLibraryTrack(track) || (ownsTrack(track) && gestures.canRemovePending),
      removeFromPlaylist,
      removePending,
      createPlaylistAndAdd,
      quickAdd,
    }),
    [acquire.canAcquire, addToPlaylist, createPlaylistAndAdd, gestures.canPlaylistAdd, gestures.canRemovePending, ownsTrack, quickAdd, removeFromPlaylist, removePending],
  );
}
