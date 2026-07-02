import { useCallback, useEffect, useRef, useState } from "react";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

/**
 * État de rechargement du flux côté Android TV (changement de piste/qualité/
 * transcode codec, sans changement de contenu) :
 *  - `reloadNonce` : reload explicite du flux en transcode (audio non couplé à
 *    la position) — bumpé par le changement de piste audio et l'application de
 *    la préférence de langue. Cf. useTVStreamUrl.ios (dep de refetch).
 *  - `softReloadRef` : marque un reload « doux » (même contenu) → le player
 *    reste monté, on n'affiche qu'un spinner discret.
 *  - `reloadFrameSec` : position figée (s) affichée comme « dernière image »
 *    pendant un reload doux (AVPlayer passe au noir le temps du re-buffer).
 *  - `startTicks` : position de redémarrage posée par un reload de piste/qualité.
 *  - forceTranscode SCOPÉ à l'item courant (dérivé → reset automatique au
 *    changement de contenu, aucune course avec l'effet de reset).
 *  - `captureReloadTicks` : fige la position courante (-3s) comme point de
 *    redémarrage du flux.
 *
 * Porte le reset complet au changement d'`itemId` (états d'audio/sous-titre/
 * qualité/erreur appartenant à d'autres hooks → passés en setters/refs) et le
 * nettoyage de l'image figée. L'effet de reload DOUX/DUR sur `[streamUrl]` reste
 * dans le PlayerScreen : il se situe au point de couture post-`useTVStreamUrl`,
 * alors que cet état est PRODUIT avant `useTVStreamUrl` (qui en consomme
 * forceTranscode/startTicks/reloadNonce). Cf. rapport d'extraction.
 */
export function useTVReloadState(args: {
  itemId: string;
  defaultAudio: number;
  isLoading: boolean;
  positionRef: React.MutableRefObject<number>;
  // Reset au changement d'itemId — états/refs possédés par d'autres hooks.
  // setAudioIndex/setSubtitleIndex passés en REF : ces hooks tournent APRÈS celui-ci
  // (ils consomment les primitives de reload) ; les dispatchers useState sont stables.
  setAudioIndexRef: React.MutableRefObject<(i: number) => void>;
  setSubtitleIndexRef: React.MutableRefObject<(i: number) => void>;
  setVideoError: (e: string | null) => void;
  resetPrefsAppliedRef: React.MutableRefObject<(() => void) | null>;
  qualityReset: () => void;
  /** Pause morte (stall remux, cf. useTVRemuxStallRecovery) : l'image figée doit
   *  PERSISTER (aucun reload en vol, isLoading reste faux) jusqu'à la reprise. */
  deadSessionRef?: React.MutableRefObject<boolean>;
}) {
  const {
    itemId, defaultAudio, isLoading,
    positionRef, setAudioIndexRef, setSubtitleIndexRef, setVideoError, resetPrefsAppliedRef, qualityReset,
    deadSessionRef,
  } = args;

  // Reload explicite du flux en transcode (changement audio non couplé à la
  // position) — bumpé par le changement de piste audio et l'application de la
  // préférence de langue. Cf. useTVStreamUrl.ios (dep de refetch).
  const [reloadNonce, setReloadNonce] = useState(0);
  // Marque un reload « doux » (changement de piste/qualité, même contenu) : le
  // player reste monté, on n'affiche qu'un spinner discret (cf. effet streamUrl).
  const softReloadRef = useRef(false);
  // Position figée (s) affichée comme « dernière image » pendant un reload doux
  // (AVPlayer passe au noir le temps du re-buffer) — via la vignette trickplay.
  const [reloadFrameSec, setReloadFrameSec] = useState<number | null>(null);
  const [startTicks, setStartTicks] = useState(0);
  // forceTranscode SCOPÉ à l'item courant : dérivé → se réinitialise AUTOMATIQUEMENT au
  // changement de contenu (aucune course avec l'effet de reset ; pas de contamination N→N+1).
  const [ftState, setFtState] = useState<{ item: string; on: boolean }>({ item: "", on: false });
  const forceTranscode = ftState.item === itemId && ftState.on;
  const setForceTranscode = useCallback((on: boolean) => setFtState({ item: itemId, on }), [itemId]);

  useEffect(() => {
    if (defaultAudio !== undefined) {
      setAudioIndexRef.current(defaultAudio);
      setSubtitleIndexRef.current(-1);
      setStartTicks(0);
      positionRef.current = 0;
      resetPrefsAppliedRef.current?.();
      qualityReset();
      // CRITIQUE : remettre à zéro le transcode forcé + l'erreur d'un contenu PRÉCÉDENT —
      // sinon un échec sur l'item N contamine l'item N+1 (lancé sur le mauvais lecteur, sans HDR/DV).
      setForceTranscode(false);
      setVideoError(null);
      if (deadSessionRef) deadSessionRef.current = false;
    }
  }, [itemId, defaultAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position de redémarrage d'un reload de flux (piste/qualité/transcode) :
  // reculée de 3s — un seek dans un transcode HLS atterrit à la granularité
  // des segments (jusqu'à quelques secondes EN AVANT de la cible), et
  // réentendre la dernière phrase redonne le contexte après un changement.
  const captureReloadTicks = useCallback(() => {
    if (positionRef.current > 0) {
      setStartTicks(Math.floor(Math.max(0, positionRef.current - 3) * TICKS_PER_SECOND));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Image figée du reload doux : la retirer dès que le nouveau flux rend
  // (première position réelle → isLoading repasse à false). Exception : pause
  // morte (aucun reload en vol, isLoading faux) — l'image doit rester affichée
  // jusqu'à la reprise.
  useEffect(() => {
    if (!isLoading && reloadFrameSec !== null && !deadSessionRef?.current) setReloadFrameSec(null);
  }, [isLoading, reloadFrameSec]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    reloadNonce, setReloadNonce,
    softReloadRef,
    reloadFrameSec, setReloadFrameSec,
    startTicks, setStartTicks,
    forceTranscode, setForceTranscode,
    captureReloadTicks,
  };
}
