import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { PreviewZoneDetails } from "../../redesign/previewZone/zoneModel";
import { episodeLabel, metaOf } from "../hero/heroModel";

/** Gardés dix minutes : revenir sur un titre ne relit rien. */
const DETAILS_STALE_MS = 10 * 60_000;

/**
 * Les DÉTAILS d'un titre pour la zone d'aperçu — synopsis, genres, durée,
 * classification, qualité : une lecture d'UN titre, ses champs seuls, sans
 * images ni état de lecture, quand le focus de sa carte a tenu (`wanted`,
 * tv-core `previewZoneDetailsIn`). La fiche déjà en cache (`["item", id]`)
 * répond sans requête ; une réponse gardée sert au retour, même sans `wanted`.
 * `null` pour un titre hors de la bibliothèque.
 */
export function useZoneDetails(id: string | null, wanted: boolean): PreviewZoneDetails | null {
  const client = useJellyfinClient();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { data } = useQuery<MediaItem | undefined>({
    queryKey: ["preview-zone-details", id],
    enabled: wanted && id !== null && userId !== null,
    staleTime: DETAILS_STALE_MS,
    cacheTime: DETAILS_STALE_MS,
    initialData: () => (id ? queryClient.getQueryData<MediaItem>(["item", id]) : undefined),
    queryFn: () =>
      client
        .fetch<{ Items?: MediaItem[] }>(
          `/Users/${userId}/Items?Ids=${id}&Fields=Overview,Genres,ChildCount,MediaStreams&EnableImages=false&EnableUserData=false&EnableTotalRecordCount=false`,
        )
        .then((response) => response.Items?.[0]),
  });
  return useMemo(() => {
    if (!data) return null;
    const meta = data.Type === "Episode" ? [episodeLabel(data), ...metaOf(data, t, { genres: 0 })] : metaOf(data, t);
    return { meta, synopsis: data.Overview ?? undefined };
  }, [data, t]);
}
