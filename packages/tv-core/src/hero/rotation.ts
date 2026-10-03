import type { RemoteIntent } from "../remote/intents";

/**
 * Le HÉROS qui tourne — l'accueil, façon app TV d'Apple : quels titres il
 * montre, quand il passe au suivant, et lequel il affiche.
 *
 * - Les titres : les visionnages à REPRENDRE d'abord, sinon la sélection du
 *   serveur — `HERO_MAX_ITEMS` au plus.
 * - Il avance SEUL, toutes les `HERO_ROTATE_MS` (deux fois moins vite en
 *   mouvement réduit), même quand le focus est sur l'un de ses boutons : les
 *   boutons gardent leurs clés, le focus ne bouge pas.
 * - L'attente repart de zéro à chaque GESTE et à chaque prise ou perte du
 *   focus dans l'écran, et à chaque titre visé : qui lit le héros n'en voit
 *   pas le titre changer sous ses yeux. Un maintien qui COMMENCE la suspend ;
 *   tout autre événement de maintien la libère. Retour n'y compte pas : sur
 *   tvOS, il n'arrive jamais à l'écouteur des gestes (la portée du Retour le
 *   prend) — relevé tel quel.
 * - Rien ne tourne sous deux titres, écran pas devant, héros à moitié défilé
 *   hors du champ, application inactive, ou grand panneau ouvert (l'appelant
 *   le dit dans `shown`) ; en devenant inactive, un maintien est oublié.
 * - On le tourne aussi à la main : au-delà du dernier bouton
 *   (`focus/beyondEdge.ts`), le titre suivant, en boucle.
 *
 * Module pur : la plateforme tient le minuteur.
 */

/** Cinq titres au plus. */
export const HERO_MAX_ITEMS = 5;

/** Un titre toutes les 8 s. */
export const HERO_ROTATE_MS = 8_000;

/** Les titres du héros : les reprises s'il y en a, sinon la sélection du serveur. */
export function heroItemsOf<T>(resume: readonly T[] | undefined, featured: readonly T[] | undefined): { items: T[]; fromResume: boolean } {
  const fromResume = !!resume && resume.length > 0;
  return { items: (fromResume ? resume! : (featured ?? [])).slice(0, HERO_MAX_ITEMS), fromResume };
}

/** L'attente entre deux titres : deux fois plus longue en mouvement réduit. */
export function heroRotateDelay(reducedMotion: boolean): number {
  return reducedMotion ? HERO_ROTATE_MS * 2 : HERO_ROTATE_MS;
}

export interface HeroRotationConditions {
  /** Le héros est à l'écran : écran devant, héros dans le champ, aucun panneau devant. */
  shown: boolean;
  /** L'application est au premier plan et active. */
  appActive: boolean;
  /** Le nombre de titres. */
  count: number;
}

/** La rotation est-elle en marche ? */
export function heroRotationActive({ shown, appActive, count }: HeroRotationConditions): boolean {
  return shown && appActive && count > 1;
}

/** Le héros est dans le champ tant que moins de la moitié en est défilée. */
export function heroInView(scrollY: number, heroTop: number, heroHeight: number): boolean {
  return scrollY < heroTop + heroHeight / 2;
}

/** Ce geste relance-t-il l'attente ? Tous, sauf Retour. */
export function heroRotationRearms(intent: RemoteIntent): boolean {
  return intent.type !== "retour";
}

/** Le maintien en cours, après ce geste : un maintien qui commence suspend, tout autre le libère. */
export function heroHoldAfter(holding: boolean, intent: RemoteIntent): boolean {
  return intent.type === "hold" ? intent.phase === "start" : holding;
}

/** L'attente s'arme-t-elle ? En marche, et rien de maintenu. */
export function heroRotationArmed(active: boolean, holding: boolean): boolean {
  return active && !holding;
}

/** Le titre suivant, en boucle. */
export function nextHeroIndex(index: number, count: number): number {
  return (index + 1) % Math.max(1, count);
}

/** Le bouton du bord — le dernier des boutons présents —, ou `null` sous deux titres. */
export function heroEdgeKey(actionKeys: ReadonlyArray<string | null | undefined>, count: number): string | null {
  if (count <= 1) return null;
  for (let i = actionKeys.length - 1; i >= 0; i--) {
    const key = actionKeys[i];
    if (key) return key;
  }
  return null;
}

/**
 * Le titre AFFICHÉ : celui de la rotation dès que son art est réglé (chargé
 * ou en échec) ; sinon le précédent reste — le titre ne s'écrit jamais en
 * lettres pour céder ensuite la place à son logo, et les boutons visent
 * toujours ce qui est affiché. Plus aucun titre : rien.
 */
export function heroShown<T>(previous: T | null, candidate: T | null, count: number, settled: (item: T) => boolean): T | null {
  if (count === 0) return null;
  return candidate && settled(candidate) ? candidate : previous;
}
