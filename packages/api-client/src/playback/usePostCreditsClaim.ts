/**
 * La REVENDICATION de la scène post-générique — « j'ai demandé à la voir ».
 *
 * Sauter jusqu'à une scène post-générique est une intention ponctuelle, et
 * aucune comparaison de position ne la restitue fidèlement : la fenêtre de la
 * carte « à suivre » se referme sur la cible même du saut, si bien que tout
 * atterrissage imprécis — seek sur image-clé de mpv, hls.js, décalage de flux,
 * position échantillonnée à 1 Hz — la rouvre et pose la carte par-dessus la
 * scène. L'intention, elle, ne se trompe pas d'un cadre.
 *
 * Elle est indexée sur l'item et ne vit qu'en mémoire : rouvrir le média la
 * lève, et elle marche hors ligne sans une ligne de plus. Revenir DERRIÈRE le
 * début du générique la lève aussi — qui rembobine avant le générique n'a plus
 * rien revendiqué.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface PostCreditsClaim {
  /** La scène est revendiquée : la carte « à suivre » se tait. */
  readonly claimed: boolean;
  /** Miroir synchrone, pour les rappels qui lisent hors rendu. */
  readonly claimedRef: { readonly current: boolean };
  /** Revendiquer, en mémorisant le début du générique qu'on vient de passer. */
  readonly claim: (outroStartMs: number) => void;
  /** Lever la revendication si la position est repassée avant ce générique. */
  readonly releaseIfBehind: (positionMs: number) => void;
}

export function usePostCreditsClaim(itemId: string | undefined): PostCreditsClaim {
  const [claimed, setClaimed] = useState(false);
  const claimedRef = useRef(false);
  /** Le début du générique revendiqué — le seuil de levée. */
  const fromMsRef = useRef<number | null>(null);

  const commit = useCallback((next: boolean, fromMs: number | null) => {
    fromMsRef.current = fromMs;
    if (claimedRef.current === next) return;
    claimedRef.current = next;
    setClaimed(next);
  }, []);

  const claim = useCallback(
    (outroStartMs: number) => { commit(true, outroStartMs); },
    [commit],
  );

  const releaseIfBehind = useCallback(
    (positionMs: number) => {
      const from = fromMsRef.current;
      if (from === null || positionMs >= from) return;
      commit(false, null);
    },
    [commit],
  );

  useEffect(() => {
    if (!itemId) return;
    commit(false, null);
  }, [itemId, commit]);

  return { claimed, claimedRef, claim, releaseIfBehind };
}
