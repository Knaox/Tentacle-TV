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
import type { JellyfinOrder } from "@tentacle-tv/shared/octave";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { sendOrderWrite } from "./orderOutbox/orderOutbox";
import { orderOutboxApi, readListPrefs } from "./orderOutbox/orderOutboxApi";
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

export { latestWinsQueue } from "./latestWinsQueue";

// Les listes dont CET appareil garde une préférence en ce moment : l'écho de `music:listPrefs` y est ignoré
// (relu avant que le dernier envoi soit parti, il ramènerait un ordre intermédiaire sous les yeux).
const savingPrefs = new Map<string, number>();

/** Cet appareil est-il en train de garder la préférence de cette liste ? */
export function isSavingListPrefs(key: string): boolean {
  return (savingPrefs.get(key) ?? 0) > 0;
}

/** Un envoi de la préférence commence ; la fonction rendue le dit fini (une fois). */
export function markListPrefsSaving(key: string): () => void {
  savingPrefs.set(key, (savingPrefs.get(key) ?? 0) + 1);
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const left = (savingPrefs.get(key) ?? 1) - 1;
    if (left > 0) savingPrefs.set(key, left);
    else savingPrefs.delete(key);
  };
}

/** La préférence d'ordre d'une liste : celle du compte, la valeur par défaut tant qu'elle n'a pas répondu. */
export function useMusicListPrefs(key: MusicListKey | null) {
  const capable = useMusicListOrderCapability();
  const query = useQuery({
    queryKey: musicKeys.listPrefs(key ?? ""),
    queryFn: ({ signal }) => readListPrefs(key!, signal),
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
    // `base` : les clés MONTRÉES avant un glisser (la file d'envoi lit contre elles ce qu'il a déplacé) ; un tri : rien.
    (prefs: MusicListPrefs, base: string[] | null = null) => {
      if (!key) return;
      qc.setQueryData(musicKeys.listPrefs(key), prefs);
      const saved = markListPrefsSaving(key);
      // Gardée sur l'appareil jusqu'à son départ : sans réseau, elle attend et se rejoue au retour (`orderOutbox`).
      void sendOrderWrite({ kind: "listPrefs", key, prefs, base }, orderOutboxApi).then(() => {
        saved();
        return qc.invalidateQueries({ queryKey: musicKeys.listPrefs(key), refetchType: "none" });
      });
    },
    [key, qc],
  );
}

/** Réécrire l'ordre de la playlist Jellyfin (les entrées dans l'ordre voulu), puis la relire. Par la file d'envoi. */
export function useReorderMusicPlaylist() {
  const qc = useQueryClient();
  return useCallback(
    (playlistId: string, order: JellyfinOrder) => {
      void sendOrderWrite({ kind: "playlistOrder", playlistId, ...order }, orderOutboxApi).then(() =>
        qc.invalidateQueries({ queryKey: musicKeys.playlist(playlistId) }),
      );
    },
    [qc],
  );
}
