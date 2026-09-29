import { useMemo } from "react";
import { localExtrasToFetch, type MediaItem } from "@tentacle-tv/shared";
import { useLocalTrailers, useSpecialFeatures } from "./useTrailers";

/** Ce que la fiche d'un titre (ou la liste des saisons) dit déjà de ses extras. */
export type ExtrasOwner = Pick<MediaItem, "Id" | "LocalTrailerCount" | "SpecialFeatureCount">;

export interface ItemExtras {
  /** Ses bandes-annonces LOCALES — fichiers du serveur, lus dans le lecteur de l'app. */
  trailers: MediaItem[];
  /** Ses bonus : coulisses, scènes coupées, interviews… */
  features: MediaItem[];
  /** Les deux, dans l'ordre de toutes les rangées « Extras » : bandes-annonces d'abord. */
  local: MediaItem[];
  /** Les listes demandées ont toutes répondu (ou échoué) : plus rien n'est en route. */
  settled: boolean;
}

/** Une liste est acquise : pas demandée, ou revenue (réponse ou erreur) — même lecture en v4 (TV) et v5. */
function answered(wanted: boolean, query: { isSuccess: boolean; isError: boolean }): boolean {
  return !wanted || query.isSuccess || query.isError;
}

const NONE: MediaItem[] = [];

/**
 * Les extras LOCAUX d'un titre — film, série, saison ou épisode.
 *
 * Les compteurs que la fiche sert déjà (`LocalTrailerCount`,
 * `SpecialFeatureCount`) évitent de demander une liste vide : la fiche d'un
 * film sans extras n'en fait plus aucune requête. Les clés restent celles de
 * `useLocalTrailers` et `useSpecialFeatures` : le bouton « Bande-annonce » et
 * la rangée partagent la même réponse.
 */
export function useItemExtras(owner: ExtrasOwner | undefined): ItemExtras {
  const wanted = localExtrasToFetch(owner);
  const trailersQuery = useLocalTrailers(wanted.trailers ? owner?.Id : undefined);
  const featuresQuery = useSpecialFeatures(wanted.features ? owner?.Id : undefined);
  const trailers = trailersQuery.data;
  const features = featuresQuery.data;
  const settled = !!owner && answered(wanted.trailers, trailersQuery) && answered(wanted.features, featuresQuery);
  return useMemo(() => {
    const t = wanted.trailers ? (trailers ?? NONE) : NONE;
    const f = wanted.features ? (features ?? NONE) : NONE;
    return { trailers: t, features: f, local: t.length || f.length ? [...t, ...f] : NONE, settled };
  }, [wanted.trailers, wanted.features, trailers, features, settled]);
}
