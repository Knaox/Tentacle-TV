/**
 * La SOURDINE des passages — ce que veut dire la croix d'un bouton de saut.
 *
 * Elle ne masque pas « ce passage-ci » : elle met en sourdine le TYPE, pour
 * toute la lecture en cours. Le décompte s'arrête, le bouton sort de l'image —
 * et il reste atteignable tant que les contrôles du lecteur sont affichés.
 * C'est la différence entre « ne me le propose plus » et « je ne veux plus
 * pouvoir le faire », et c'est la formulation retenue par l'utilisateur.
 *
 * Trois propriétés qui en découlent, sans code supplémentaire :
 *  - rouvrir le média la lève (elle est indexée sur l'item) ;
 *  - en Watch Together elle voyage au groupe, par le même canal que le refus ;
 *  - hors ligne elle marche, puisqu'elle ne vit que dans cette mémoire.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SegmentType } from "@tentacle-tv/shared";

/** Aucune sourdine — une seule instance, pour que les comparaisons tiennent. */
export const NO_MUTED_SEGMENTS: ReadonlySet<SegmentType> = new Set<SegmentType>();

export interface MutedSegments {
  readonly muted: ReadonlySet<SegmentType>;
  /** Miroir synchrone : le battement d'horloge lit le présent, pas le rendu d'avant. */
  readonly mutedRef: { readonly current: ReadonlySet<SegmentType> };
  readonly mute: (type: SegmentType) => void;
}

export function useMutedSegments(itemId: string | undefined): MutedSegments {
  const [muted, setMuted] = useState<ReadonlySet<SegmentType>>(NO_MUTED_SEGMENTS);
  const mutedRef = useRef(muted);

  const mute = useCallback((type: SegmentType) => {
    if (mutedRef.current.has(type)) return;
    const next = new Set(mutedRef.current);
    next.add(type);
    mutedRef.current = next;
    setMuted(next);
  }, []);

  useEffect(() => {
    if (!itemId) return;
    mutedRef.current = NO_MUTED_SEGMENTS;
    setMuted(NO_MUTED_SEGMENTS);
  }, [itemId]);

  return { muted, mutedRef, mute };
}
