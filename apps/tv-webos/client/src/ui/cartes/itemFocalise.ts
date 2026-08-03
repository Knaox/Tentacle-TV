import { useSyncExternalStore } from "react";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * L'item que la carte focalisée désigne — pour le fond d'écran.
 *
 * **Temporisé, et c'est tout l'enjeu.** Le fond est une image floutée : chaque
 * changement coûte un téléchargement et une passe de composition. Publier à
 * chaque déplacement du focus ferait payer un balayage de vingt cartes vingt
 * fois, pour dix-neuf images que personne n'aura vues. Un quart de seconde
 * suffit à distinguer « je traverse » de « je regarde ».
 *
 * L'effacement, lui, est immédiat : quitter une rangée doit rendre l'écran, pas
 * laisser une affiche qui ne correspond plus à rien pendant un quart de
 * seconde.
 *
 * `actif` permet de le couper sans redéployer, si la dalle montre que le coût
 * est trop élevé.
 */

const DELAI_MS = 250;

let courant: MediaItem | null = null;
let actif = true;
let differe: ReturnType<typeof setTimeout> | null = null;
const auditeurs = new Set<() => void>();

function notifier(): void {
  auditeurs.forEach((auditeur) => auditeur());
}

function poser(item: MediaItem | null): void {
  if (courant === item) return;
  courant = item;
  notifier();
}

function annulerDiffere(): void {
  if (differe === null) return;
  clearTimeout(differe);
  differe = null;
}

/** Une carte a pris le focus. Publié après temporisation. */
export function viserItem(item: MediaItem): void {
  annulerDiffere();
  if (!actif) return;
  differe = setTimeout(() => {
    differe = null;
    poser(item);
  }, DELAI_MS);
}

/** Une carte a perdu le focus. Effacé sans attendre. */
export function relacherItem(): void {
  annulerDiffere();
  poser(null);
}

/** Coupe l'effet — le fond disparaît et plus rien n'est publié. */
export function activerFondFocus(valeur: boolean): void {
  actif = valeur;
  if (!valeur) relacherItem();
}

function sAbonner(rappel: () => void): () => void {
  auditeurs.add(rappel);
  return () => {
    auditeurs.delete(rappel);
  };
}

function lireInstantane(): MediaItem | null {
  return courant;
}

export function useItemFocalise(): MediaItem | null {
  return useSyncExternalStore(sAbonner, lireInstantane);
}
