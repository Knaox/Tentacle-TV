import { useCallback } from "react";
import type { QualityKey } from "@tentacle-tv/shared";

/**
 * Bascule de qualité (preset transcodé / original) côté Android TV : reload
 * doux du flux à la position courante, puis applique la nouvelle clé de preset.
 */
export function useTVQualityChange(args: {
  setQualityKey: (key: QualityKey) => void;
  positionRef: React.MutableRefObject<number>;
  captureReloadTicks: () => void;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (v: number | null) => void;
}) {
  const { setQualityKey, positionRef, captureReloadTicks, softReloadRef, setReloadFrameSec } = args;

  const handleQualityChange = useCallback((key: QualityKey) => {
    softReloadRef.current = true; setReloadFrameSec(positionRef.current);
    captureReloadTicks();
    setQualityKey(key);
  }, [setQualityKey, captureReloadTicks]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleQualityChange };
}
