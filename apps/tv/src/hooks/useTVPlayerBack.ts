import { useEffect, useRef, useState } from "react";
import { usePreventRemove } from "@react-navigation/native";
import { createPlayerBack, playerBackHolding } from "@tentacle-tv/tv-core";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { PLAYER_TIMERS } from "./playerTimers";

/**
 * Le routage du bouton RETOUR du lecteur, états passagers d'abord : la règle
 * est dans tv-core (`player/playerBack.ts` : grâce de 600 ms, défilement
 * annulé, carte ou affiche refusée, passage automatique mis en sourdine).
 *
 * `routeBack()` est la première étape de TOUS les chemins Retour du lecteur
 * (couche passagère de la pile du Retour sur Apple TV, BackHandler sur Android
 * TV, bouton Retour de l'habillage) : une seule source de vérité.
 *
 * Android TV : le bouton système est retenu ici par `usePreventRemove` tant
 * qu'un état passager le prendrait (`holding`). Apple TV refondue : la pile du
 * Retour le reçoit d'abord (`usePlayerBackLayers`, `holdsSystemBack` faux).
 */
export function useTVPlayerBack(args: {
  /** État de scrub RENDU (la prévention native se base sur le dernier rendu). */
  scrubbing: boolean;
  cancelScrub: () => void;
  /** Une SURFACE « épisode suivant » est-elle montée (carte ou affiche de fin) ? */
  surfaceActive: boolean;
  /** Un bouton de saut AUTOMATIQUE, encore refusable, est-il affiché ? */
  skipRefusable: boolean;
  /** Met en sourdine le passage courant — le geste du bouton « Masquer ». */
  dismissSegment: () => void;
  /** L'overlay COURANT en miroir synchrone (`usePlaybackOverlay.overlayRef`). */
  surfaceRef: { readonly current: PlayerOverlay };
  /** Ferme l'overlay auto-play ; vrai si un départ (navigation) est engagé. */
  dismissAutoPlay: () => boolean;
  /** Le bouton physique est retenu ICI, par `usePreventRemove` (défaut). Faux
   *  sur Apple TV refondue. */
  holdsSystemBack?: boolean;
}) {
  const { scrubbing, surfaceActive, skipRefusable, holdsSystemBack = true } = args;
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;
  const latest = useRef(args);
  latest.current = args;

  const [graceActive, setGraceActive] = useState(false);
  const [back] = useState(() => createPlayerBack({
    isScrubbing: () => scrubbingRef.current,
    readSurface: () => latest.current.surfaceRef.current,
    cancelScrub: () => latest.current.cancelScrub(),
    dismissSurface: () => latest.current.dismissAutoPlay(),
    dismissSegment: () => latest.current.dismissSegment(),
    onGrace: setGraceActive,
  }, PLAYER_TIMERS));
  useEffect(() => () => back.destroy(), [back]);

  const routeBack = back.routeBack;
  // Ce que `routeBack` prendrait au prochain Retour — dit d'avance.
  const holding = playerBackHolding({ scrubbing, surfaceActive, skipRefusable, graceActive });
  usePreventRemove(holdsSystemBack && holding, () => { routeBack(); });

  return { routeBack, holding };
}
