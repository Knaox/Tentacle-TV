import { useCallback, useEffect, useState } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import type { ExtrasOwner } from "./useItemExtras";
import { useItemTrailer } from "./useItemTrailer";
import type { RemoteTrailersOwner } from "./useRemoteTrailers";
import { useTrailerHint } from "./useTrailerHint";

/** Le temps de lire la confirmation et de se raviser, avant qu'elle s'efface. */
export const TRAILER_HINT_CONFIRM_MS = 6000;

/**
 * `none` : rien à montrer ; `hint` : « Vous ne voyez pas les
 * bandes-annonces ? » ; `confirm` : « Rappel masqué… » avec « Annuler », juste
 * après le geste.
 */
export type TrailerHintPhase = "none" | "hint" | "confirm";

export interface FicheTrailerHint {
  phase: TrailerHintPhase;
  /** Masquer pour de bon, puis confirmer quelques secondes à la même place. */
  hide: () => void;
  /** Revenir sur le masquage : le rappel reparaît. */
  undo: () => void;
}

export type FicheTrailerHintOwner = ExtrasOwner & RemoteTrailersOwner & Pick<MediaItem, "Type">;

/**
 * Le rappel d'UNE fiche, prêt à rendre, sur le web, le miroir et le mobile :
 * la bande-annonce du titre (`useItemTrailer` — la même lecture que le
 * bouton, donc les mêmes requêtes), la règle partagée, et la confirmation
 * qui suit le masquage (le temps d'un « Annuler »). Les téléviseurs, sans
 * geste, s'en tiennent à `phase === "hint"`.
 */
export function useFicheTrailerHint(item: FicheTrailerHintOwner | undefined, lang: string | undefined): FicheTrailerHint {
  const trailer = useItemTrailer(item, lang);
  const { show, hide: hideForGood, undo: undoHide } = useTrailerHint({
    itemType: item?.Type,
    trailerVisible: trailer.visible,
    trailerSettled: trailer.settled,
  });
  // La fiche dont on confirme le masquage : changer de fiche l'efface.
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(null), TRAILER_HINT_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const itemId = item?.Id ?? null;
  const hide = useCallback(() => {
    hideForGood();
    setConfirming(itemId);
  }, [hideForGood, itemId]);
  const undo = useCallback(() => {
    undoHide();
    setConfirming(null);
  }, [undoHide]);

  const phase: TrailerHintPhase = confirming !== null && confirming === itemId ? "confirm" : show ? "hint" : "none";
  return { phase, hide, undo };
}
