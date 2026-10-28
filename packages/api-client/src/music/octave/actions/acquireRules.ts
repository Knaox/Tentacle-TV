/**
 * Octave — la règle PURE des ajouts à la bibliothèque, d'après les droits que l'extension déclare
 * (`MusicRights`) : le bouton existe-t-il, reste-t-il de la place aujourd'hui, faut-il dire le reste.
 */

import type { MusicRights } from "@tentacle-tv/shared/music";

/** Le bouton d'ajout (cœur, « + » playlist d'un titre hors bibliothèque) n'existe qu'avec le droit. */
export function mayOfferAcquire(rights: MusicRights): boolean {
  return rights.acquire;
}

/** Le reste du jour est épuisé : le geste est refusé sans attendre le serveur (qui refuserait aussi). */
export function quotaExhausted(rights: MusicRights): boolean {
  return rights.acquire && rights.remainingToday !== null && rights.remainingToday <= 0;
}

/**
 * On APPROCHE de la limite : le reste se dit après un ajout quand il n'en reste presque plus — un cinquième de la
 * limite, au moins 2, au plus 5 (« Plus que 3 ajouts aujourd'hui »). Rien sans limite, rien à zéro (le refus le dira).
 */
export function remainingToTell(rights: MusicRights): number | null {
  const left = rights.remainingToday;
  if (!rights.acquire || left === null || left <= 0 || rights.dailyLimit <= 0) return null;
  const threshold = Math.min(5, Math.max(2, Math.ceil(rights.dailyLimit / 5)));
  return left <= threshold ? left : null;
}
