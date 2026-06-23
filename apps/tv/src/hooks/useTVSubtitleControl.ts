import { useCallback, useState } from "react";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/**
 * État + bascule de la piste sous-titres côté Android TV.
 *  - Sous-titres TEXTE : sélection NATIVE/overlay JS, AUCUN rechargement.
 *  - Burn-in PGS/VOBSUB : reconstruit l'URL (reload doux + éventuel transcode).
 *
 * `subtitleIndex` (state) est consommé par useTVStreamUrl (dep de l'URL) → ce
 * hook tourne AVANT le stream. `isDirectPlay`/`isLocalRemux` (sorties du stream)
 * ne sont lus qu'au CLIC → passés via refs (lecture fraîche à l'appel).
 */
export function useTVSubtitleControl(args: {
  streams: JfStream[];
  isDirectPlayRef: React.MutableRefObject<boolean>;
  isLocalRemuxRef: React.MutableRefObject<boolean>;
  positionRef: React.MutableRefObject<number>;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (v: number | null) => void;
  setForceTranscode: (on: boolean) => void;
  captureReloadTicks: () => void;
}) {
  const {
    streams, isDirectPlayRef, isLocalRemuxRef,
    positionRef, softReloadRef, setReloadFrameSec, setForceTranscode, captureReloadTicks,
  } = args;

  const [subtitleIndex, setSubtitleIndex] = useState(-1);

  const handleSubtitleChange = useCallback((newIndex: number) => {
    // Sur le remux, le TEXTE n'est PAS burn-in (overlay JS) ; seules les IMAGES (PGS/VOBSUB) le sont.
    const isBurnIn = (idx: number) => idx >= 0
      && isBurnInSubtitleCodec(streams.find((s) => s.Type === "Subtitle" && s.Index === idx)?.Codec, isLocalRemuxRef.current);
    const needsBurnIn = isBurnIn(newIndex);
    const prevBurnIn = isBurnIn(subtitleIndex);
    if (!needsBurnIn && !prevBurnIn) {
      // Sous-titres TEXTE : sélection NATIVE (sideload AVPlayer en direct play,
      // piste du manifeste HLS en transcode) ou overlay JS sur Android MPV —
      // AUCUN rechargement du player, bascule instantanée.
      setSubtitleIndex(newIndex);
      return;
    }
    // Activation/désactivation d'un burn-in PGS/VOBSUB : l'URL est reconstruite
    // → mémoriser la position courante (le natif redémarre le flux à cette
    // position via le fragment #tnt-start).
    softReloadRef.current = true; setReloadFrameSec(positionRef.current);
    captureReloadTicks();
    setSubtitleIndex(newIndex);
    if (needsBurnIn && isDirectPlayRef.current) setForceTranscode(true);
  }, [streams, subtitleIndex, captureReloadTicks]); // eslint-disable-line react-hooks/exhaustive-deps

  return { subtitleIndex, setSubtitleIndex, handleSubtitleChange };
}
