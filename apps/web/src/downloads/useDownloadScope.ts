/**
 * Le périmètre d'une demande partie d'UN épisode : lui seul, sa saison, ou
 * toute la série — décidé DANS le dialogue, qui change de contenu sur place.
 *
 * Portage de `apps/mobile/src/offline/keep/useKeepScope.ts` ; la requête, elle,
 * est partagée (`useSeriesEpisodes` d'`api-client`) et ne part qu'au premier
 * élargissement.
 */

import { useMemo, useState } from "react";
import { useSeriesEpisodes } from "@tentacle-tv/api-client";
import { seasonKey } from "@tentacle-tv/offline-core";
import type { MediaItem } from "@tentacle-tv/shared";
import type { DownloadScope } from "./ScopeChoice";

export type DownloadMode = "single" | "season" | "series";

export interface DownloadScopeState {
  /** `null` quand la demande ne porte pas sur un épisode : rien à choisir. */
  scope: DownloadScope | null;
  setScope: (scope: DownloadScope) => void;
  /** Les titres du périmètre courant. */
  items: MediaItem[];
  /** Le mode effectif, qui pilote le titre et les cases à cocher. */
  mode: DownloadMode;
  /** Les épisodes ne sont pas encore là. */
  loading: boolean;
  /** La série n'a pas pu être lue : on reste sur l'épisode. */
  failed: boolean;
}

export function useDownloadScope(requested: MediaItem[], requestedMode: DownloadMode): DownloadScopeState {
  const episode = requestedMode === "single" && requested.length === 1 ? requested[0] : undefined;
  const seriesId = episode?.Type === "Episode" ? episode.SeriesId : undefined;
  const [scope, setScope] = useState<DownloadScope>("episode");
  const wanted = seriesId !== undefined && scope !== "episode";
  const { data: episodes, isError } = useSeriesEpisodes(seriesId, { enabled: wanted });

  const items = useMemo(() => {
    if (!wanted || episodes === undefined) return requested;
    if (scope === "series") return episodes;
    // La saison se reconnaît à son NUMÉRO, pas à son identifiant : Jellyfin en
    // donne parfois plusieurs pour une même saison, et filtrer sur l'un d'eux
    // n'en prendrait que la moitié.
    const wantedKey = episode === undefined ? null : seasonKey(episode);
    if (wantedKey === null) return requested;
    return episodes.filter((item) => seasonKey(item) === wantedKey);
  }, [wanted, episodes, scope, requested, episode]);

  const ready = !wanted || (episodes !== undefined && !isError);
  const mode: DownloadMode = !ready || scope === "episode"
    ? requestedMode
    : scope === "series"
      ? "series"
      : "season";

  return {
    scope: seriesId === undefined ? null : scope,
    setScope,
    items,
    mode,
    loading: wanted && episodes === undefined && !isError,
    failed: wanted && isError,
  };
}
