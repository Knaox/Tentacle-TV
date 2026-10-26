/**
 * Octave — l'ORDRE des listes (capacité `music.listOrder`, contrat
 * `musicListOrder.ts`) : la préférence d'une liste (tri, sens, ordre
 * personnalisé), gardée par COMPTE, et l'ordre d'une playlist Jellyfin réécrit
 * après un glisser. Optimiste : le choix se voit tout de suite, le serveur le
 * garde derrière. Les envois d'une même liste partent l'un après l'autre et
 * seul le DERNIER compte (une rafale de glisser ne réécrit pas dix fois la
 * playlist).
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MUSIC_LIST_ROUTES,
  defaultListPrefs,
  type MusicListKey,
  type MusicListPrefs,
} from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { musicKeys } from "./musicQueryKeys";
import { useMusicCapability } from "./useMusicLibrary";

const at = (route: string, name: string, value: string) => route.replace(`:${name}`, encodeURIComponent(value));

export const musicListApi = {
  prefs: (key: MusicListKey, signal?: AbortSignal) => tentacleApiFetch<MusicListPrefs>(at(MUSIC_LIST_ROUTES.prefs, "key", key), { signal }),
  savePrefs: (key: MusicListKey, prefs: MusicListPrefs) =>
    tentacleApiFetch<MusicListPrefs>(at(MUSIC_LIST_ROUTES.prefs, "key", key), { method: "PUT", body: JSON.stringify(prefs) }),
  reorderPlaylist: (playlistId: string, entryIds: readonly string[]) =>
    tentacleApiFetch<{ ok: true }>(at(MUSIC_LIST_ROUTES.playlistOrder, "id", playlistId), { method: "PUT", body: JSON.stringify({ entryIds }) }),
};

/** Le serveur sait-il trier et garder l'ordre des listes ? Sans lui : aucune barre de tri. */
export function useMusicListOrderCapability(): boolean {
  const music = useMusicCapability();
  const order = useServerCapability("music.listOrder");
  return music && order;
}

/**
 * Une file « le dernier gagne » par clé : un envoi à la fois ; pendant qu'il part, seul le plus récent
 * attend son tour (les intermédiaires sont remplacés). Exportée pour les tests.
 */
export function latestWinsQueue() {
  const running = new Map<string, Promise<void>>();
  const waiting = new Map<string, () => Promise<unknown>>();
  const drain = async (key: string): Promise<void> => {
    for (let task = waiting.get(key); task; task = waiting.get(key)) {
      waiting.delete(key);
      try {
        await task();
      } catch {
        // L'échec d'un envoi ne bloque pas le suivant ; l'appelant relit la vérité du serveur.
      }
    }
    running.delete(key);
  };
  return (key: string, task: () => Promise<unknown>): Promise<void> => {
    waiting.set(key, task);
    let current = running.get(key);
    if (!current) {
      current = drain(key);
      running.set(key, current);
    }
    return current;
  };
}

const sendPrefs = latestWinsQueue();
const sendOrder = latestWinsQueue();

/** La préférence d'ordre d'une liste : celle du compte, la valeur par défaut tant qu'elle n'a pas répondu. */
export function useMusicListPrefs(key: MusicListKey | null) {
  const capable = useMusicListOrderCapability();
  const query = useQuery({
    queryKey: musicKeys.listPrefs(key ?? ""),
    queryFn: ({ signal }) => musicListApi.prefs(key!, signal),
    enabled: capable && key !== null,
    staleTime: 30_000,
  });
  return {
    capable,
    prefs: query.data ?? (key ? defaultListPrefs(key) : defaultListPrefs("liked")),
    /** La préférence du compte est-elle connue (pas seulement la valeur par défaut) ? */
    ready: !capable || query.isSuccess || query.isError,
  };
}

/** Changer la préférence d'une liste : tout de suite à l'écran, puis gardée par le serveur. */
export function useSaveMusicListPrefs(key: MusicListKey | null) {
  const qc = useQueryClient();
  return useCallback(
    (prefs: MusicListPrefs) => {
      if (!key) return;
      qc.setQueryData(musicKeys.listPrefs(key), prefs);
      void sendPrefs(key, () => musicListApi.savePrefs(key, prefs)).then(() => qc.invalidateQueries({ queryKey: musicKeys.listPrefs(key), refetchType: "none" }));
    },
    [key, qc],
  );
}

/** Réécrire l'ordre de la playlist Jellyfin (les entrées dans l'ordre voulu), puis la relire. */
export function useReorderMusicPlaylist() {
  const qc = useQueryClient();
  return useCallback(
    (playlistId: string, entryIds: readonly string[]) => {
      void sendOrder(playlistId, () => musicListApi.reorderPlaylist(playlistId, entryIds)).then(() =>
        qc.invalidateQueries({ queryKey: musicKeys.playlist(playlistId) }),
      );
    },
    [qc],
  );
}
