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
  const { data: trailers } = useLocalTrailers(wanted.trailers ? owner?.Id : undefined);
  const { data: features } = useSpecialFeatures(wanted.features ? owner?.Id : undefined);
  return useMemo(() => {
    const t = wanted.trailers ? (trailers ?? NONE) : NONE;
    const f = wanted.features ? (features ?? NONE) : NONE;
    return { trailers: t, features: f, local: t.length || f.length ? [...t, ...f] : NONE };
  }, [wanted.trailers, wanted.features, trailers, features]);
}
