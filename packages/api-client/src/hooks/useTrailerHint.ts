import { useCallback } from "react";
import { TRAILER_HINT_ITEM_TYPES, shouldShowTrailerHint } from "@tentacle-tv/shared";
import { useIsHintDismissed, useSetHintDismissed } from "./useDismissedHints";
import { useTrailerReadiness } from "./useTrailerReadiness";

export interface UseTrailerHintInput {
  /** `Type` Jellyfin du titre de la fiche. */
  itemType: string | undefined;
  /** Le bouton « Bande-annonce » existe (`useItemTrailer().visible`). */
  trailerVisible: boolean;
  /** Les listes locale et TMDB ont répondu (`useItemTrailer().settled`). */
  trailerSettled: boolean;
}

export interface TrailerHint {
  /** Poser le rappel « Vous ne voyez pas les bandes-annonces ? » sur la fiche. */
  show: boolean;
  /** Le masquer pour de bon — une préférence du compte, sur tous ses appareils. */
  hide: () => void;
  /** Revenir sur le masquage (l'« Annuler » qui suit le geste). */
  undo: () => void;
}

/**
 * Le rappel discret des fiches, pour toutes les plateformes : la règle
 * partagée (`shouldShowTrailerHint`) nourrie du diagnostic du serveur et de
 * la préférence du compte. Rien n'est demandé au serveur pour une fiche qui
 * a sa bande-annonce, ni tant que ses listes ne sont pas arrivées : le
 * diagnostic n'est lu que pour un titre qui n'en a vraiment aucune — puis
 * gardé dix minutes, d'une fiche à l'autre.
 */
export function useTrailerHint(input: UseTrailerHintInput): TrailerHint {
  const eligible =
    !!input.itemType &&
    TRAILER_HINT_ITEM_TYPES.includes(input.itemType) &&
    input.trailerSettled &&
    !input.trailerVisible;
  const readiness = useTrailerReadiness({ enabled: eligible });
  const misconfigured = readiness.data?.state === "misconfigured";
  const dismissed = useIsHintDismissed("trailerHelp", { enabled: eligible && misconfigured });
  const { mutate } = useSetHintDismissed();

  const hide = useCallback(() => mutate({ hint: "trailerHelp", dismissed: true }), [mutate]);
  const undo = useCallback(() => mutate({ hint: "trailerHelp", dismissed: false }), [mutate]);

  return {
    show: shouldShowTrailerHint({ ...input, readiness: readiness.data, dismissed }),
    hide,
    undo,
  };
}
