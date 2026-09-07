import { useMemo, useState } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { useSeriesEpisodes } from "@/hooks/offline/useSeriesEpisodes";
import type { KeepOfflineMode, KeepOfflineRequest } from "./keepOfflineStore";
import type { KeepScope } from "./ScopeChoice";

/**
 * Le périmètre d'une demande partie d'UN épisode : lui seul, sa saison, ou
 * toute la série. Le dialogue change de contenu sur place — pas de seconde
 * modale, pas de fermeture / réouverture.
 *
 * Les épisodes de la série ne sont demandés qu'au premier élargissement, et
 * la requête est partagée avec les autres points d'entrée (même clé).
 */

export interface KeepScopeState {
  /** `null` quand la demande ne porte pas sur un épisode : rien à choisir. */
  scope: KeepScope | null;
  setScope: (scope: KeepScope) => void;
  /** Les titres du périmètre courant. */
  items: MediaItem[];
  /** Le mode effectif, qui pilote titre et cases à cocher. */
  mode: KeepOfflineMode;
  /** Les épisodes ne sont pas encore là. */
  loading: boolean;
  /** La série n'a pas pu être lue : on reste sur l'épisode. */
  failed: boolean;
}

export function useKeepScope(request: KeepOfflineRequest): KeepScopeState {
  const episode = request.mode === "single" ? request.items[0] : undefined;
  const seriesId = episode?.Type === "Episode" ? episode.SeriesId : undefined;
  const [scope, setScope] = useState<KeepScope>("episode");
  const wanted = seriesId !== undefined && scope !== "episode";
  const { data: episodes, isError } = useSeriesEpisodes(seriesId, { enabled: wanted });

  const items = useMemo(() => {
    if (!wanted || episodes === undefined) return request.items;
    if (scope === "series") return episodes;
    // La saison de l'épisode appuyé : par identifiant, avec repli sur le
    // numéro de saison — un épisode hors saison déclarée garde le sien.
    const seasonId = episode?.SeasonId;
    const seasonNumber = episode?.ParentIndexNumber;
    return episodes.filter((item) =>
      seasonId !== undefined ? item.SeasonId === seasonId : item.ParentIndexNumber === seasonNumber,
    );
  }, [wanted, episodes, scope, request.items, episode?.SeasonId, episode?.ParentIndexNumber]);

  const ready = !wanted || (episodes !== undefined && !isError);
  const mode: KeepOfflineMode = !ready || scope === "episode"
    ? request.mode
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
