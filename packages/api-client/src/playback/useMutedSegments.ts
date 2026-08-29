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
 *
 * # Pourquoi une table et non un ensemble
 *
 * On retient la POSITION du refus. Revenir derrière elle, c'est rejouer le
 * passage : on redemande alors son bouton, croix comprise. Sans cela, un
 * rembobinage laissait la sourdine en place et le geste restait impossible à
 * reprendre — signalé à l'usage. La règle elle-même est pure et testée
 * (`segmentsRewoundInto`) ; l'arbitre, lui, ne voit qu'un `has()`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { segmentsRewoundInto, type MutedSegments, type SegmentType } from "@tentacle-tv/shared";

/** Aucune sourdine — une seule instance, pour que les comparaisons tiennent. */
export const NO_MUTED_SEGMENTS: ReadonlyMap<SegmentType, number> = new Map<SegmentType, number>();

export interface MutedSegmentsState {
  /** Les passages refusés, et la position où ils l'ont été. */
  readonly muted: ReadonlyMap<SegmentType, number>;
  /** Miroir synchrone : le battement d'horloge lit le présent, pas le rendu d'avant. */
  readonly mutedRef: { readonly current: MutedSegments & ReadonlyMap<SegmentType, number> };
  /** Refuser un passage, en mémorisant d'où on l'a fait. */
  readonly mute: (type: SegmentType, positionMs: number) => void;
  /** Lever les sourdines que le retour en arrière a rendues caduques. */
  readonly releaseRewound: (positionMs: number) => void;
}

export function useMutedSegments(itemId: string | undefined): MutedSegmentsState {
  const [muted, setMuted] = useState<ReadonlyMap<SegmentType, number>>(NO_MUTED_SEGMENTS);
  const mutedRef = useRef(muted);

  const commit = useCallback((next: ReadonlyMap<SegmentType, number>) => {
    mutedRef.current = next;
    setMuted(next);
  }, []);

  const mute = useCallback((type: SegmentType, positionMs: number) => {
    const next = new Map(mutedRef.current);
    next.set(type, positionMs);
    commit(next);
  }, [commit]);

  const releaseRewound = useCallback((positionMs: number) => {
    // Le cas courant ne reconstruit rien : l'identité de la table sert de
    // dépendance à un `useMemo` chez l'appelant.
    if (mutedRef.current.size === 0) return;
    const stale = segmentsRewoundInto(mutedRef.current, positionMs);
    if (stale.length === 0) return;
    const next = new Map(mutedRef.current);
    for (const type of stale) next.delete(type);
    commit(next.size === 0 ? NO_MUTED_SEGMENTS : next);
  }, [commit]);

  useEffect(() => {
    if (!itemId) return;
    commit(NO_MUTED_SEGMENTS);
  }, [itemId, commit]);

  return { muted, mutedRef, mute, releaseRewound };
}
