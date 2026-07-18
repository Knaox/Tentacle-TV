import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/**
 * État + bascule de la piste sous-titres.
 *  - Sous-titres TEXTE : sélection native (ExoPlayer Android) ou overlay JS
 *    (tvOS partout, MPV) — AUCUN rechargement.
 *  - Pistes IMAGE (PGS/VOBSUB/DVB) :
 *      · Android + direct play : si la piste EMBARQUÉE est exposée par ExoPlayer
 *        (subtitleTrackMapRef, rempli via handleTracks), sélection native —
 *        Media3 décode PGS/DVB/VobSub — AUCUN reload, AUCUN transcodage.
 *      · sinon (piste non exposée, transcodage en cours, tvOS) : repli burn-in
 *        serveur (reload doux + éventuel transcode).
 *  - Un transcodage engagé PAR un burn-in (subtitleForcedRef) est ANNULÉ dès
 *    qu'on repasse sur une piste texte / aucune → retour en lecture directe.
 *    Le forceTranscode posé par une erreur codec (useTVErrorHandler) n'est
 *    jamais touché (subtitleForcedRef reste false dans ce cas).
 *
 * `subtitleIndex` (state) est consommé par useTVStreamUrl (dep de l'URL) → ce
 * hook tourne AVANT le stream. `isDirectPlay` (sortie du stream) et le map
 * natif ne sont lus qu'au CLIC → passés via refs (lecture fraîche à l'appel).
 */
export function useTVSubtitleControl(args: {
  streams: JfStream[];
  isDirectPlayRef: React.MutableRefObject<boolean>;
  subtitleTrackMapRef: React.MutableRefObject<Record<number, number>>;
  positionRef: React.MutableRefObject<number>;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (v: number | null) => void;
  setForceTranscode: (on: boolean) => void;
  captureReloadTicks: () => void;
}) {
  const {
    streams, isDirectPlayRef, subtitleTrackMapRef,
    positionRef, softReloadRef, setReloadFrameSec, setForceTranscode, captureReloadTicks,
  } = args;

  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  // Transcodage engagé PAR un sous-titre burn-in (≠ transcode d'erreur codec).
  const subtitleForcedRef = useRef(false);
  // Nouveau contenu (streams changent avec l'item) → plus aucun burn-in en vol.
  useEffect(() => { subtitleForcedRef.current = false; }, [streams]);

  const handleSubtitleChange = useCallback((newIndex: number) => {
    // Seules les IMAGES (PGS/VOBSUB/DVB) peuvent exiger une incrustation serveur.
    const isBurnIn = (idx: number) => idx >= 0
      && isBurnInSubtitleCodec(streams.find((s) => s.Type === "Subtitle" && s.Index === idx)?.Codec);
    const needsBurnIn = isBurnIn(newIndex);

    // Android + lecture directe : toute piste exposée NATIVEMENT (texte
    // side-loadé "jf:" OU image embarquée décodée par Media3) bascule sans
    // reload ni transcodage — la sélection part de useTVSubtitleSync.
    // (Map encore vide juste après le chargement → repli burn-in ci-dessous.)
    if (Platform.OS === "android" && isDirectPlayRef.current
      && (!needsBurnIn || subtitleTrackMapRef.current[newIndex] != null)) {
      setSubtitleIndex(newIndex);
      return;
    }

    const prevBurnIn = isBurnIn(subtitleIndex);
    if (!needsBurnIn && !prevBurnIn && !subtitleForcedRef.current) {
      // Sous-titres TEXTE : bascule instantanée, AUCUN rechargement du player.
      setSubtitleIndex(newIndex);
      return;
    }
    // Burn-in impliqué (activation, changement ou sortie) : l'URL est
    // reconstruite → mémoriser la position courante (le natif redémarre le
    // flux à cette position via le fragment #tnt-start).
    softReloadRef.current = true; setReloadFrameSec(positionRef.current);
    captureReloadTicks();
    setSubtitleIndex(newIndex);
    if (needsBurnIn) {
      if (isDirectPlayRef.current) { subtitleForcedRef.current = true; setForceTranscode(true); }
    } else if (subtitleForcedRef.current) {
      // Le transcodage n'existait QUE pour incruster → retour lecture directe.
      subtitleForcedRef.current = false;
      setForceTranscode(false);
    }
  }, [streams, subtitleIndex, captureReloadTicks]); // eslint-disable-line react-hooks/exhaustive-deps

  return { subtitleIndex, setSubtitleIndex, handleSubtitleChange };
}
