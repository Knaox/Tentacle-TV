import { HOME_LOADING_KEY } from "./homeEntry";

/**
 * L'ENTRÉE d'un écran, et le RETOUR sur lui — où va le focus quand on arrive,
 * et quand la pile redescend sur l'écran.
 *
 * L'arrivée est un temps, pas un instant : l'entrée de l'écran change pendant
 * qu'il se charge (rien → le panneau d'état → le héros), et tvOS donnerait de
 * lui-même le focus à ce qui est en haut à gauche — la navigation, qui
 * s'ouvrirait le temps d'un éclair. Pendant l'ARRIVÉE, l'entrée du moment
 * porte donc la préférence de focus (posée avant le rendu de ses cibles) et
 * se réclame à chaque changement. L'arrivée se CLÔT :
 * - au premier focus de CONTENU — l'entrée a été atteinte, ou l'utilisateur
 *   est déjà ailleurs dans la page ;
 * - au premier focus dans la NAVIGATION plus de `ARRIVAL_RAIL_IS_USER_MS`
 *   après le premier rendu de l'écran : c'est l'utilisateur qui l'a gagnée —
 *   une affiche arrivée plus tard ne lui volera pas le focus.
 *
 * Au RETOUR (la pile redescend), le focus revient au dernier élément de
 * contenu qui l'avait, s'il est encore monté ; sinon à l'entrée — jamais au
 * premier passage, que l'arrivée tient déjà.
 *
 * La plateforme applique : la préférence (tvOS : `hasTVPreferredFocus`), la
 * réclamation, le moment du retour. Le délai se compte depuis le PREMIER rendu
 * de l'écran, pas depuis le dernier changement d'entrée (relevé tel quel).
 *
 * Module pur : l'horloge est passée par l'appelant.
 */

/** Un focus dans la navigation plus tard que ça après l'arrivée vient de l'utilisateur. */
export const ARRIVAL_RAIL_IS_USER_MS = 600;

export interface ScreenArrival {
  /** L'arrivée dure : l'entrée porte la préférence et se réclame. */
  readonly open: boolean;
  /** La clé qui porte la préférence en ce moment. */
  readonly preferred: string | null;
  /** Le premier rendu de l'écran (ms). */
  readonly startedAt: number;
}

/** Ce que la plateforme doit faire de la préférence : la retirer d'une clé, la poser sur une autre. */
export interface PreferenceChange {
  readonly unprefer: string | null;
  readonly prefer: string | null;
}

/** L'arrivée d'un écran qui se rend pour la première fois. */
export function startArrival(now: number): ScreenArrival {
  return { open: true, preferred: null, startedAt: now };
}

/**
 * Au rendu : pendant l'arrivée, la préférence suit l'entrée du moment (posée
 * AVANT que ses cibles se rendent). Hors de l'arrivée, rien.
 */
export function preferEntry(arrival: ScreenArrival, entryKey: string | null): { arrival: ScreenArrival; change: PreferenceChange | null } {
  if (!arrival.open || arrival.preferred === entryKey) return { arrival, change: null };
  return {
    arrival: { ...arrival, preferred: entryKey },
    change: { unprefer: arrival.preferred, prefer: entryKey },
  };
}

/** L'entrée vient de changer (ou l'écran se monte) : la clé à réclamer, pendant l'arrivée seulement. */
export function entryClaim(arrival: ScreenArrival, entryKey: string | null): string | null {
  return arrival.open && entryKey ? entryKey : null;
}

/**
 * Un focus posé dans l'écran clôt-il l'arrivée ? Oui pour du contenu ; pour la
 * navigation (`inRail`), seulement passé `ARRIVAL_RAIL_IS_USER_MS`.
 */
export function closesArrival(arrival: ScreenArrival, inRail: boolean, now: number): boolean {
  return arrival.open && (!inRail || now - arrival.startedAt > ARRIVAL_RAIL_IS_USER_MS);
}

/**
 * Un focus dans la NAVIGATION pendant l'arrivée, avant `ARRIVAL_RAIL_IS_USER_MS` :
 * c'est la plateforme qui l'y a posé, pas l'utilisateur — tvOS, au bout d'une
 * transition (« Qui regarde ? » → l'accueil, en fondu), donne le focus à ce
 * qui est en haut à gauche, et la préférence de l'entrée n'y peut rien. La
 * navigation ne s'ouvre pas pour lui, et l'entrée se réclame aussitôt : sans
 * quoi elle se dépliait puis se repliait au lancement (retour d'essai, Apple
 * TV, 2026-10-05).
 */
export function railHeldByArrival(arrival: ScreenArrival, now: number): boolean {
  return arrival.open && now - arrival.startedAt <= ARRIVAL_RAIL_IS_USER_MS;
}

/**
 * Une cible qui TIENT le focus pendant un chargement — l'ancre invisible de
 * l'accueil (`HOME_LOADING_KEY`) — n'est pas du contenu : elle ne clôt pas
 * l'arrivée (l'entrée qui suit, le héros, se réclame encore) et ne se retient
 * pas comme dernier contenu (`lastContentAfter`).
 */
export function holdsArrival(focusKey: string): boolean {
  return focusKey === HOME_LOADING_KEY;
}

/** La clôture : la préférence à retirer ; la réclamation en cours s'annule. */
export function closeArrival(arrival: ScreenArrival): { arrival: ScreenArrival; unprefer: string | null } {
  if (!arrival.open) return { arrival, unprefer: null };
  return { arrival: { ...arrival, open: false, preferred: null }, unprefer: arrival.preferred };
}

/** La dernière clé de CONTENU : seul un focus hors de la navigation la change. */
export function lastContentAfter(lastContent: string | null, focusedKey: string, inRail: boolean): string | null {
  return inRail ? lastContent : focusedKey;
}

/** La clé de contenu à viser : la dernière focalisée si elle est montée, sinon l'entrée. */
export function contentKeyOf(lastContent: string | null, entryKey: string | null, isMounted: (key: string) => boolean): string | null {
  return lastContent && isMounted(lastContent) ? lastContent : entryKey;
}

/** La pile redescend sur l'écran : la clé à réclamer — rien au premier passage. */
export function returnClaim(firstPassage: boolean, contentKey: string | null): string | null {
  return firstPassage ? null : contentKey;
}
