import { PARENTAL_AGE_CUSTOM_KEY, PARENTAL_AGE_NONE_KEY, PARENTAL_AGE_TIERS, parentalAgeKey } from "../session/parentalAge";

/**
 * Le CONTRÔLE PARENTAL simplifié d'un profil (Apple TV, Android TV) — les clés
 * de focus de la page et son entrée. Module pur ; l'adaptateur les pose
 * (`platform/tvos/screens/parental.ts`).
 *
 * Deux sections côte à côte : les PALIERS d'âge (une liste à choix unique,
 * entrée par le palier retenu, comme les couleurs d'un invité) et les
 * BIBLIOTHÈQUES (une liste de cases). La croix Retour, en haut à gauche, quitte la page : chaque
 * geste est déjà enregistré, il n'y a rien à valider.
 */

export const PARENTAL_BACK_KEY = "parental:back";
export const PARENTAL_BACK_BAR_KEY = "parental:top";
export const PARENTAL_AGES_SECTION = "parental:ages";
export const PARENTAL_LIBRARIES_SECTION = "parental:libraries";

/** Plus de lignes que n'en a un serveur réel : la garde du clic fantôme se pose d'avance. */
export const PARENTAL_MAX_LIBRARIES = 40;

export const parentalAgeOptionKey = (choiceKey: string): string => `parental:age:${choiceKey}`;
export const parentalLibraryRowKey = (index: number): string => `parental:library:${index}`;

/**
 * Où entre le focus : le palier retenu (celui que l'on vient régler), sinon
 * la première bibliothèque, sinon la croix — jamais une impasse.
 */
export function parentalEntryKey(input: { ageKey: string | null; libraryCount: number }): string {
  if (input.ageKey) return parentalAgeOptionKey(input.ageKey);
  if (input.libraryCount > 0) return parentalLibraryRowKey(0);
  return PARENTAL_BACK_KEY;
}

/** La page paraît sous l'OK qui l'a ouverte : seul un OK commencé sur une de ses cibles y vaut. */
export function parentalGuardedKeys(): string[] {
  const ages = [...PARENTAL_AGE_TIERS.map(parentalAgeKey), PARENTAL_AGE_NONE_KEY, PARENTAL_AGE_CUSTOM_KEY].map(parentalAgeOptionKey);
  const rows = Array.from({ length: PARENTAL_MAX_LIBRARIES }, (_, index) => parentalLibraryRowKey(index));
  return [...ages, ...rows];
}
