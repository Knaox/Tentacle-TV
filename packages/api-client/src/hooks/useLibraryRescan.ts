import { useEffect } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  LIBRARY_RESCAN_PATH,
  lacksMetadata,
  libraryRescanErrorOf,
  type LibraryRescanError,
  type LibraryRescanStarted,
  type MediaItem,
} from "@tentacle-tv/shared";
import { tentacleApiFetch, TentacleApiError } from "./usePreferences";
import { acquireSocket, subscribeSocket } from "../socket/tentacleSocket";

/**
 * « Réanalyser maintenant » et l'arrivée des métadonnées sur une fiche.
 *
 * Le geste n'existe que face à un serveur qui déclare `admin.libraryRescan`
 * (aux appelants de le garder par `useServerCapability`) et pour un
 * administrateur en session personnelle — le serveur le revérifie.
 */

type RescanItem = Pick<MediaItem, "Id" | "Type" | "SeriesId">;

/** Les requêtes qu'une analyse renouvelle : la fiche, et ce que la fiche d'une série montre. */
export function metadataArrivalKeys(item: RescanItem): string[][] {
  const seriesId = item.Type === "Series" ? item.Id : item.SeriesId;
  const keys: string[][] = [["item", item.Id]];
  if (seriesId) {
    if (seriesId !== item.Id) keys.push(["item", seriesId]);
    keys.push(["seasons", seriesId], ["episodes", seriesId], ["episode-sources", seriesId], ["series-watch-state", seriesId]);
  }
  return keys;
}

function refreshItem(qc: QueryClient, item: RescanItem): void {
  for (const queryKey of metadataArrivalKeys(item)) void qc.invalidateQueries({ queryKey });
}

/** Le code d'un refus, lu dans le corps que `tentacleApiFetch` garde comme message. */
export function libraryRescanErrorCode(err: unknown): LibraryRescanError {
  if (!(err instanceof TentacleApiError)) return "unreachable";
  try {
    return libraryRescanErrorOf(JSON.parse(err.message));
  } catch {
    return "failed";
  }
}

/**
 * Relectures de rattrapage après une analyse lancée d'ici : l'annonce de
 * Jellyfin suffit d'ordinaire (`useMetadataArrival`), mais un canal fermé ne
 * doit pas laisser la fiche figée. Trois relectures d'UN titre, bornées.
 */
export const RESCAN_FOLLOW_UP_MS: readonly number[] = [20_000, 60_000, 180_000];

/**
 * POST /api/admin/library/rescan — un titre (`item`), ou toutes les
 * bibliothèques (sans argument). Rend « lancée » ; la fiche se met à jour
 * quand Jellyfin a fini.
 */
export function useLibraryRescan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item?: RescanItem) =>
      tentacleApiFetch<LibraryRescanStarted>(`/api/admin${LIBRARY_RESCAN_PATH}`, {
        method: "POST",
        body: JSON.stringify(item ? { itemId: item.Id } : {}),
      }),
    onSuccess: (_started, item) => {
      if (!item) {
        void qc.invalidateQueries({ queryKey: ["libraries"] });
        return;
      }
      for (const delay of RESCAN_FOLLOW_UP_MS) setTimeout(() => refreshItem(qc, item), delay);
    },
  });
}

/**
 * La fiche d'un titre sans métadonnées se met à jour SEULE : Jellyfin annonce
 * chaque titre ajouté OU mis à jour (`LibraryChanged`, relayé par le serveur en
 * `home:update` › `recently_added`). Tant que le titre manque de métadonnées —
 * et seulement alors —, chaque annonce relit la fiche et ce qu'elle montre.
 * Aucune requête au repos : on écoute le socket partagé, déjà ouvert.
 */
export function useMetadataArrival(
  item: (RescanItem & Parameters<typeof lacksMetadata>[0]) | undefined,
  options: { token?: string | null; enabled?: boolean } = {},
): void {
  const qc = useQueryClient();
  const { token, enabled = true } = options;
  const watching = enabled && !!item && lacksMetadata(item);
  const id = item?.Id;
  const type = item?.Type;
  const seriesId = item?.SeriesId;

  useEffect(() => {
    if (!watching || !id || !type) return;
    const target: RescanItem = { Id: id, Type: type, SeriesId: seriesId };
    const release = acquireSocket(token ?? undefined);
    const off = subscribeSocket((msg) => {
      if (msg.type === "home:update" && msg.carousel === "recently_added") refreshItem(qc, target);
    });
    return () => {
      off();
      release();
    };
  }, [watching, id, type, seriesId, token, qc]);
}
