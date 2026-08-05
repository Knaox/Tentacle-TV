import { useSyncExternalStore } from "react";

/**
 * Quatre clics sur le logo ouvrent le classement de visionnage.
 *
 * L'état vit au NIVEAU MODULE, pas dans React, et ce n'est pas un raccourci :
 * le logo est un lien vers l'accueil, donc le premier clic NAVIGUE pour de bon.
 * Un état porté par un composant serait balayé par ce changement de route et le
 * compte repartirait de zéro à chaque fois. Même raisonnement que
 * `detailTransition.ts`, qui est un module et non un contexte pour survivre au
 * démontage de la route de départ.
 *
 * On laisse d'ailleurs la navigation se faire : intercepter le clic du logo
 * casserait son comportement normal pour tout le monde, au bénéfice d'une
 * surprise. Les trois clics suivants tombent sur l'accueil, où re-naviguer vers
 * l'accueil n'est rien.
 */

const CLICS_REQUIS = 4;

/** Assez large pour un quadruple clic tranquille, trop court pour se déclencher par hasard. */
const FENETRE_MS = 900;

let compte = 0;
let dernierClic = 0;
let ouvert = false;

const abonnes = new Set<() => void>();

function prevenir(): void {
  for (const a of abonnes) a();
}

function sabonner(callback: () => void): () => void {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}

/** À poser sur le logo. Ne bloque jamais la navigation. */
export function compterClicLogo(): void {
  const maintenant = Date.now();
  compte = maintenant - dernierClic > FENETRE_MS ? 1 : compte + 1;
  dernierClic = maintenant;
  if (compte < CLICS_REQUIS) return;
  compte = 0;
  ouvert = true;
  prevenir();
}

export function fermerClassement(): void {
  // Le compteur repart de zéro à la fermeture : sans cela, des clics laissés en
  // route se cumuleraient avec ceux de la prochaine fois et le panneau se
  // rouvrirait au bout de deux clics, sans qu'on comprenne pourquoi.
  compte = 0;
  if (!ouvert) return;
  ouvert = false;
  prevenir();
}

/** Lecture directe de l'état — sert de `getSnapshot` au hook, et aux tests. */
export function classementEstOuvert(): boolean {
  return ouvert;
}

export function useClassementOuvert(): boolean {
  return useSyncExternalStore(sabonner, classementEstOuvert, () => false);
}
