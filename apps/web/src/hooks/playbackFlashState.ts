/**
 * La décision du badge central, en fonction PURE.
 *
 * Extraite de `usePlaybackFlash` pour être testable : quatre règles s'y croisent
 * — le démarrage qui n'est pas une bascule, les armements comptés du glissement,
 * leur péremption, et l'état inerte d'un rechargement de source — et chacune
 * répond à un badge apparu là où il n'avait rien à faire.
 *
 * Aucun accès au temps ni au DOM : `maintenant` est passé par l'appelant.
 */

/** Ce que le badge doit montrer. */
export type FlashKind = "pause" | "play" | "mute" | "unmute";

/** Durée de validité d'un armement non consommé, en ms. */
export const PEREMPTION_MS = 3000;

export interface EtatFlash {
  /** Dernier état observé, ou `null` avant le premier passage. */
  precedent: { paused: boolean; muted: boolean } | null;
  /** La lecture a-t-elle démarré une première fois ? */
  demarree: boolean;
  /** Horodatages des armements en attente. */
  armements: readonly number[];
}

export const etatFlashInitial: EtatFlash = {
  precedent: null,
  demarree: false,
  armements: [],
};

export interface EntreeFlash {
  paused: boolean;
  muted: boolean;
  /** Le lecteur n'est pas dans un état stable (rechargement de source). */
  inerte: boolean;
  maintenant: number;
}

/** Ajoute un armement : la prochaine bascule de pause sera avalée. */
export function armer(etat: EtatFlash, maintenant: number): EtatFlash {
  return { ...etat, armements: [...etat.armements, maintenant] };
}

/**
 * Faut-il annoncer quelque chose ? Rend le nouvel état et le badge éventuel.
 *
 * L'ordre des règles compte :
 *  1. avant le premier départ, on s'arme sans rien dire — un lecteur qui monte
 *     passe par `paused: true` puis `false`, et personne n'a rien demandé ;
 *  2. état inerte : on suit sans annoncer, y compris à la sortie de cet état,
 *     puisque la référence est mise à jour au passage ;
 *  3. une bascule de pause consomme un armement s'il en reste un valide ;
 *  4. la coupure du son ne compte que si la pause n'a pas bougé — un seul badge
 *     à la fois.
 */
export function deciderFlash(
  etat: EtatFlash,
  entree: EntreeFlash,
): { etat: EtatFlash; kind: FlashKind | null } {
  const { paused, muted, inerte, maintenant } = entree;
  const avant = etat.precedent;
  const suivant: EtatFlash = { ...etat, precedent: { paused, muted } };

  if (!etat.demarree) {
    return { etat: { ...suivant, demarree: !paused }, kind: null };
  }
  if (avant === null || inerte) return { etat: suivant, kind: null };

  if (avant.paused !== paused) {
    const valides = etat.armements.filter((t) => maintenant - t < PEREMPTION_MS);
    if (valides.length > 0) {
      return { etat: { ...suivant, armements: valides.slice(1) }, kind: null };
    }
    return { etat: { ...suivant, armements: [] }, kind: paused ? "pause" : "play" };
  }

  if (avant.muted !== muted) {
    return { etat: suivant, kind: muted ? "mute" : "unmute" };
  }
  return { etat: suivant, kind: null };
}
