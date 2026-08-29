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
 * `active` permet de le couper sans redéployer, si la dalle montre que le coût
 * est trop élevé.
 */

const DELAY_MS = 250;
const CLEAR_DELAY_MS = 120;

let current: MediaItem | null = null;
let active = true;
let deferred: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notifier(): void {
  listeners.forEach((listener) => listener());
}

function poser(item: MediaItem | null): void {
  if (current === item) return;
  current = item;
  notifier();
}

function cancelDeferred(): void {
  if (deferred === null) return;
  clearTimeout(deferred);
  deferred = null;
}

/** Une carte a pris le focus. Publié après temporisation. */
export function aimItem(item: MediaItem): void {
  cancelDeferred();
  if (!active) return;
  deferred = setTimeout(() => {
    deferred = null;
    poser(item);
  }, DELAY_MS);
}

/**
 * Une carte a perdu le focus. Effacé, mais pas tout de suite : si une autre
 * carte prend le focus dans la foulée — ce qui est le cas de tout déplacement —
 * sa visée annule cet effacement et le fond n'est jamais rendu à vide.
 */
export function releaseItem(): void {
  cancelDeferred();
  deferred = setTimeout(() => {
    deferred = null;
    poser(null);
  }, CLEAR_DELAY_MS);
}

/**
 * Coupe l'effet — le fond disparaît et plus rien n'est publié.
 *
 * Ici l'effacement est bien immédiat : on ne coupe pas un effet « dans un
 * dixième de seconde ».
 */
export function enableFocusBackdrop(value: boolean): void {
  active = value;
  if (!value) {
    cancelDeferred();
    poser(null);
  }
}

function sAbonner(rappel: () => void): () => void {
  listeners.add(rappel);
  return () => {
    listeners.delete(rappel);
  };
}

function readSnapshot(): MediaItem | null {
  return current;
}

export function useFocusedItem(): MediaItem | null {
  return useSyncExternalStore(sAbonner, readSnapshot);
}
