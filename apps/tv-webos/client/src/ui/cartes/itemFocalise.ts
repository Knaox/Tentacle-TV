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
 * **L'effacement est différé lui aussi, et de peu.** Il était immédiat, ce qui
 * paraissait juste — quitter une rangée doit rendre l'écran. Mais un
 * déplacement du focus n'est pas autre chose qu'un `blur` suivi d'un `focus` :
 * l'effacement partait donc entre CHAQUE carte, et le fond était démonté puis
 * remonté à chaque appui. C'est ce qui produisait l'écran noir entre deux
 * affiches, et ce qui faisait clignoter un fond pourtant identique quand on
 * passait d'un épisode au suivant.
 *
 * Un dixième de seconde suffit à faire la différence entre « je change de
 * carte » et « je quitte les cartes » : la visée qui suit annule l'effacement
 * en attente, et rien n'est publié entre les deux.
 *
 * `actif` permet de le couper sans redéployer, si la dalle montre que le coût
 * est trop élevé.
 */

const DELAI_MS = 250;
const DELAI_EFFACEMENT_MS = 120;

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

/**
 * Une carte a perdu le focus. Effacé, mais pas tout de suite : si une autre
 * carte prend le focus dans la foulée — ce qui est le cas de tout déplacement —
 * sa visée annule cet effacement et le fond n'est jamais rendu à vide.
 */
export function relacherItem(): void {
  annulerDiffere();
  differe = setTimeout(() => {
    differe = null;
    poser(null);
  }, DELAI_EFFACEMENT_MS);
}

/**
 * Coupe l'effet — le fond disparaît et plus rien n'est publié.
 *
 * Ici l'effacement est bien immédiat : on ne coupe pas un effet « dans un
 * dixième de seconde ».
 */
export function activerFondFocus(valeur: boolean): void {
  actif = valeur;
  if (!valeur) {
    annulerDiffere();
    poser(null);
  }
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
