import { useSyncExternalStore } from "react";

/**
 * L'ouverture de la recherche, hors de l'arbre React.
 *
 * La recherche est ouverte depuis le rail et fermée par la touche Retour, dont
 * le consommateur est installé au démarrage, très loin de tout composant. Un
 * contexte obligerait à faire descendre un état d'un bout à l'autre de la
 * disposition pour deux booléens ; un magasin externe se lit d'où l'on veut,
 * c'est le motif déjà employé par `usePinnedNav` et `useUserId`.
 *
 * **Pas une route.** Les routes sont déclarées dans `App.tsx`, qu'on ne modifie
 * pas — et le client web ne fait pas autrement : sa recherche est un portail
 * ouvert par un raccourci, jamais une adresse. Le rail pointait vers
 * `/recherche`, qui n'existe nulle part et tombait sur la page « introuvable » :
 * la première entrée du rail était morte.
 */

let opened = false;
const listeners = new Set<() => void>();

/**
 * Ce qui avait le focus avant l'ouverture, pour le lui rendre en refermant.
 *
 * Une surcouche n'est pas un changement d'écran : le moteur ne repose donc pas
 * le focus à sa fermeture, et plus rien n'en avait — mesuré, `activeElement`
 * retombait sur `<body>`. Le premier appui sur une flèche renvoyait alors le
 * focus au hasard du DOM au lieu de le rendre à l'entrée du rail d'où l'on
 * venait.
 *
 * Retenu ici plutôt que dans `focus/memory.ts` : celle-ci indexe par ROUTE, et
 * l'ouverture d'une surcouche n'en change pas. Deux mécanismes pour deux
 * questions différentes.
 */
let trigger: HTMLElement | null = null;

function notifier(): void {
  listeners.forEach((listener) => listener());
}

function sAbonner(rappel: () => void): () => void {
  listeners.add(rappel);
  return () => {
    listeners.delete(rappel);
  };
}

function readSnapshot(): boolean {
  return opened;
}

export function openSearch(): void {
  if (opened) return;
  const active = document.activeElement;
  trigger = active instanceof HTMLElement ? active : null;
  opened = true;
  notifier();
}

/** Rend vrai si la recherche était ouverte — c'est ce qu'attend la pile Retour. */
export function closeSearch(): boolean {
  if (!opened) return false;
  opened = false;
  notifier();

  // Après le rendu qui démonte la surcouche : lui rendre le focus avant
  // reviendrait à le poser sur un élément que React s'apprête à recouvrir.
  const target = trigger;
  trigger = null;
  if (target && target.isConnected) {
    setTimeout(() => {
      if (target.isConnected) target.focus();
    }, 0);
  }

  return true;
}

export function useSearchOpen(): boolean {
  return useSyncExternalStore(sAbonner, readSnapshot);
}
