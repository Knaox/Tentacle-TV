import { useMemo } from "react";
import { hasTrailer, resolveTrailerTarget, type RichTrailer, type TrailerTarget } from "@tentacle-tv/shared";
import { useItemExtras, type ExtrasOwner } from "./useItemExtras";
import { useRemoteTrailers, type RemoteTrailersOwner } from "./useRemoteTrailers";

export interface ItemTrailer {
  /** Ce que lance le bouton : la bande-annonce locale d'abord, sinon la distante. */
  target: TrailerTarget | null;
  /** Le bouton existe — y compris quand la fiche annonce une locale pas encore listée. */
  visible: boolean;
  /** Toutes les distantes, triées : la modale du web les enchaîne. */
  remote: RichTrailer[];
}

/**
 * Le bouton « Bande-annonce » d'une fiche, sur toutes les plateformes : la
 * bande-annonce LOCALE d'abord (lue dans le lecteur de l'app), sinon la
 * première distante, et pas de bouton quand il n'y a ni l'une ni l'autre.
 */
export function useItemTrailer(item: (ExtrasOwner & RemoteTrailersOwner) | undefined, lang: string | undefined): ItemTrailer {
  const { trailers } = useItemExtras(item);
  const remote = useRemoteTrailers(item, lang);
  return useMemo(() => {
    const target = resolveTrailerTarget(trailers, remote);
    return { target, visible: hasTrailer(target, item), remote };
  }, [trailers, remote, item]);
}
