import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  SOURCE_SWITCH_TIMEOUT_MS, beginSourceSwitch, sourceSwitchPending,
  type QualityKey, type SourceSwitch,
} from "@tentacle-tv/shared";

/**
 * L'indicateur de chargement allumé DÈS le choix d'une qualité (règle
 * partagée `sourceSwitch.ts`) : il couvre l'arrêt de l'ancien encodage et la
 * renégociation, jusqu'à ce que la nouvelle source soit posée — le lecteur
 * prend alors le relais avec son propre chargement. Re-choisir la qualité
 * déjà servie ne change rien : rien ne s'allume.
 */
export function useSourceSwitch(
  src: string | null,
  currentQuality: QualityKey | undefined,
  onQualityChange: ((key: QualityKey) => void) | undefined,
): { pending: boolean; onQualityChange: ((key: QualityKey) => void) | undefined } {
  const [sw, setSw] = useState<SourceSwitch | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const srcRef = useRef(src);
  srcRef.current = src;
  const pending = sourceSwitchPending(sw, src, Date.now());

  // Le délai de sûreté se relit par un rendu : jamais d'indicateur éternel.
  useEffect(() => {
    if (!sw) return;
    const timer = setTimeout(rerender, SOURCE_SWITCH_TIMEOUT_MS + 50);
    return () => clearTimeout(timer);
  }, [sw]);
  useEffect(() => { if (sw && !pending) setSw(null); }, [sw, pending]);

  const choose = useCallback((key: QualityKey) => {
    if (key !== currentQuality) setSw(beginSourceSwitch(srcRef.current, Date.now()));
    onQualityChange?.(key);
  }, [currentQuality, onQualityChange]);

  return { pending, onQualityChange: onQualityChange ? choose : undefined };
}
