import { useCallback, useState } from "react";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/**
 * État + bascule de la piste sous-titres.
 *  - Sous-titres TEXTE : sélection native (ExoPlayer Android) ou overlay JS
 *    (tvOS partout, MPV) — AUCUN rechargement.
 *  - Burn-in PGS/VOBSUB : reconstruit l'URL (reload doux + éventuel transcode).
 *
 * `subtitleIndex` (state) est consommé par useTVStreamUrl (dep de l'URL) → ce
 * hook tourne AVANT le stream. `isDirectPlay` (sortie du stream) n'est lu
 * qu'au CLIC → passé via ref (lecture fraîche à l'appel).
 */
export function useTVSubtitleControl(args: {
  streams: JfStream[];
  isDirectPlayRef: React.MutableRefObject<boolean>;
  positionRef: React.MutableRefObject<number>;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (v: number | null) => void;
  setForceTranscode: (on: boolean) => void;
  captureReloadTicks: () => void;
}) {
  const {
    streams, isDirectPlayRef,
    positionRef, softReloadRef, setReloadFrameSec, setForceTranscode, captureReloadTicks,
  } = args;

  const [subtitleIndex, setSubtitleIndex] = useState(-1);

  const handleSubtitleChange = useCallback((newIndex: number) => {
    // Le TEXTE n'est jamais burn-in (rendu natif Android / overlay JS) ; seules
    // les IMAGES (PGS/VOBSUB/DVB) sont incrustées par le serveur.
    const isBurnIn = (idx: number) => idx >= 0
      && isBurnInSubtitleCodec(streams.find((s) => s.Type === "Subtitle" && s.Index === idx)?.Codec);
    const needsBurnIn = isBurnIn(newIndex);
    const prevBurnIn = isBurnIn(subtitleIndex);
    if (!needsBurnIn && !prevBurnIn) {
      // Sous-titres TEXTE : bascule instantanée, AUCUN rechargement du player.
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
