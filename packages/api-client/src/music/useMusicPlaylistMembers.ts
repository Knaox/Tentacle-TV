/**
 * Octave — une playlist PARTAGÉE entre comptes du serveur (capacité `music.playlistMembers`, contrat
 * `musicPlaylistMembers.ts`) : la porte (sans la capacité, aucun bouton, aucune requête), le partage d'une
 * playlist, les comptes à qui la partager, et les gestes — partager, changer un droit, retirer, quitter. Le
 * serveur décide de tout ; chaque geste relit la playlist et la liste (le serveur le dit aussi aux autres).
 * Web large, web étroit et mobile lisent ceci.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MUSIC_PLAYLIST_MEMBER_ROUTES,
  type MusicPlaylistMemberRight,
  type MusicPlaylistPerson,
  type MusicPlaylistSharing,
} from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { useMusicCapability } from "./useMusicLibrary";
import { musicKeys } from "./musicQueryKeys";

const at = (route: string, values: Record<string, string>) =>
  Object.entries(values).reduce((path, [name, value]) => path.replace(`:${name}`, encodeURIComponent(value)), route);

export const musicMembersApi = {
  sharing: (playlistId: string, signal?: AbortSignal) => tentacleApiFetch<MusicPlaylistSharing>(at(MUSIC_PLAYLIST_MEMBER_ROUTES.members, { id: playlistId }), { signal }),
  candidates: (signal?: AbortSignal) => tentacleApiFetch<MusicPlaylistPerson[]>(MUSIC_PLAYLIST_MEMBER_ROUTES.candidates, { signal }),
  put: (playlistId: string, userId: string, right: MusicPlaylistMemberRight) =>
    tentacleApiFetch<MusicPlaylistSharing>(at(MUSIC_PLAYLIST_MEMBER_ROUTES.members, { id: playlistId }), { method: "PUT", body: JSON.stringify({ userId, right }) }),
  setRight: (playlistId: string, userId: string, right: MusicPlaylistMemberRight) =>
    tentacleApiFetch<MusicPlaylistSharing>(at(MUSIC_PLAYLIST_MEMBER_ROUTES.member, { id: playlistId, userId }), { method: "PATCH", body: JSON.stringify({ right }) }),
  remove: (playlistId: string, userId: string) =>
    tentacleApiFetch<MusicPlaylistSharing>(at(MUSIC_PLAYLIST_MEMBER_ROUTES.member, { id: playlistId, userId }), { method: "DELETE" }),
  leave: (playlistId: string) => tentacleApiFetch<{ ok: true }>(at(MUSIC_PLAYLIST_MEMBER_ROUTES.membership, { id: playlistId }), { method: "DELETE" }),
};

/** Sous la clé de la playlist : `music:playlist` (un geste d'un autre) la relit avec elle. */
export const musicMembersKey = (playlistId: string) => [...musicKeys.playlist(playlistId), "members"] as const;
const CANDIDATES_KEY = ["music", "playlist-members", "candidates"] as const;

/** Le serveur sait-il partager une playlist entre comptes ? Sans lui : ni bouton, ni badge, ni requête. */
export function useMusicPlaylistMembersAvailable(): boolean {
  const music = useMusicCapability();
  const capable = useServerCapability("music.playlistMembers");
  return music && capable;
}

export type MembersBusy = "add" | "right" | "remove" | "leave" | null;

/** Le partage d'une playlist (feuille « Partager avec… » ou « Personnes »), et ses gestes. */
export function useMusicPlaylistMembers(playlistId: string | null, enabled = true) {
  const available = useMusicPlaylistMembersAvailable();
  const qc = useQueryClient();
  const on = available && enabled && !!playlistId;
  const query = useQuery({
    queryKey: musicMembersKey(playlistId ?? ""),
    queryFn: ({ signal }) => musicMembersApi.sharing(playlistId!, signal),
    enabled: on,
    staleTime: 15_000,
  });
  const [busy, setBusy] = useState<MembersBusy>(null);
  const [failed, setFailed] = useState(false);

  const run = useCallback(
    async <T,>(kind: Exclude<MembersBusy, null>, task: () => Promise<T>): Promise<T | null> => {
      if (!playlistId) return null;
      setBusy(kind);
      setFailed(false);
      try {
        const result = await task();
        if (result && typeof result === "object" && "role" in result) qc.setQueryData(musicMembersKey(playlistId), result);
        return result;
      } catch {
        setFailed(true);
        return null;
      } finally {
        setBusy(null);
        // La playlist (son badge, ses droits) et la liste (une playlist quittée en sort) se relisent.
        void qc.invalidateQueries({ queryKey: musicKeys.playlist(playlistId) });
        void qc.invalidateQueries({ queryKey: musicKeys.playlists() });
      }
    },
    [playlistId, qc],
  );

  return {
    available,
    sharing: query.data ?? null,
    loading: on && query.isPending,
    /** La lecture a échoué (un compte qui ne peut pas partager : invité, « voir en tant que »). */
    unreadable: query.isError,
    busy,
    failed,
    add: (userId: string, right: MusicPlaylistMemberRight) => run("add", () => musicMembersApi.put(playlistId!, userId, right)),
    setRight: (userId: string, right: MusicPlaylistMemberRight) => run("right", () => musicMembersApi.setRight(playlistId!, userId, right)),
    remove: (userId: string) => run("remove", () => musicMembersApi.remove(playlistId!, userId)),
    leave: () => run("leave", () => musicMembersApi.leave(playlistId!)),
  };
}

/** Les comptes à qui partager (ni soi, ni invité, ni compte désactivé) ; `null` tant que ce n'est pas su. */
export function useMusicShareCandidates(enabled = true) {
  const available = useMusicPlaylistMembersAvailable();
  const query = useQuery({
    queryKey: CANDIDATES_KEY,
    queryFn: ({ signal }) => musicMembersApi.candidates(signal),
    enabled: available && enabled,
    staleTime: 60_000,
  });
  return { candidates: query.data ?? null, loading: available && enabled && query.isPending, failed: query.isError };
}
