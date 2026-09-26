import { useSyncExternalStore } from "react";
import { elementKey, findByKey } from "../../focus/memory";

/**
 * La recherche du téléviseur, hors de l'arbre React.
 *
 * La recherche est ouverte depuis le rail et fermée par la touche Retour, dont
 * le consommateur est installé au démarrage, très loin de tout composant. Un
 * contexte obligerait à faire descendre un état d'un bout à l'autre de la
 * disposition ; un magasin externe se lit d'où l'on veut, c'est le motif déjà
 * employé par `usePinnedNav` et `useUserId`.
 *
 * **Pas une route.** Les routes sont déclarées dans `App.tsx`, qu'on ne modifie
 * pas — et le client web ne fait pas autrement : sa recherche est un portail
 * ouvert par un raccourci, jamais une adresse.
 *
 * **Mais elle SURVIT à la fiche qu'elle ouvre.** Ouvrir un résultat navigue
 * vers la fiche : la disposition, donc la surcouche, est démontée — rien n'est
 * composé derrière la fiche. L'état, lui, reste ici. Retour depuis la fiche
 * rend l'écran d'où l'on venait, la disposition se remonte, et la recherche
 * réapparaît avec sa saisie, sa filmographie ouverte et sa dernière carte
 * visée : la parité avec l'Apple TV et Android TV, où la recherche est un écran
 * de la pile. Un second Retour la referme.
 */

/** Ce qu'une recherche approfondie parcourt : une personne, un genre, un studio. */
export type SearchBrowseTarget =
  | { kind: "person"; id: string; name: string }
  | { kind: "genre" | "studio"; name: string };

export interface SearchSnapshot {
  opened: boolean;
  /** La saisie brute — elle survit au démontage de la surcouche. */
  query: string;
  /** La filmographie, le genre ou le studio ouvert par-dessus les résultats. */
  browse: SearchBrowseTarget | null;
}

const CLOSED: SearchSnapshot = { opened: false, query: "", browse: null };

let snapshot: SearchSnapshot = CLOSED;
const listeners = new Set<() => void>();

/**
 * Ouverture neuve : c'est elle, et elle seule, qui pose le focus sur la barre. Un REMONTAGE — retour de fiche — rend
 * au contraire la dernière cible visée (`lastTargetKey`).
 */
let fresh = false;

/**
 * Ce qui avait le focus avant l'ouverture, pour le lui rendre en refermant.
 *
 * Une surcouche n'est pas un changement d'écran : le moteur ne repose donc pas
 * le focus à sa fermeture, et plus rien n'en avait — `activeElement` retombait
 * sur `<body>`. Si l'élément a disparu entre-temps (l'écran a été remonté au
 * retour d'une fiche), sa CLÉ permet de retrouver son jumeau.
 */
let trigger: HTMLElement | null = null;
let triggerKey: string | null = null;

/** Le défilement à rendre à la page qu'on découvre — une seule fois. */
export function takeCoveredScroll(): number | null {
  const value = coveredScroll;
  coveredScroll = null;
  return value;
}

/** La dernière cible visée dans la surcouche, pour la lui rendre au remontage. */
let lastTargetKey: string | null = null;

/** Ce qui a ouvert la recherche approfondie, pour y revenir en la refermant. */
let browseOpenerKey: string | null = null;

/** Recherche approfondie ouverte à l'instant — pas remontée au retour d'une fiche. */
let browseFresh = false;

/**
 * Le défilement de la page recouverte, relevé à l'ouverture : la disposition
 * retire la page du rendu tant que la recherche la couvre (`LayoutTv`), ce qui
 * ramène la fenêtre en haut. Il lui est rendu à la fermeture.
 */
let coveredScroll: number | null = null;

function publish(next: SearchSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function readSnapshot(): SearchSnapshot {
  return snapshot;
}

/**
 * Ouvre la recherche — ou, déjà ouverte, revient à sa barre : l'entrée
 * « Rechercher » du rail reste atteignable par-dessus la surcouche, et un
 * raccourci clavier aussi. Ni l'une ni l'autre ne doit rien faire en silence.
 */
export function openSearch(): void {
  if (snapshot.opened) {
    returnToSearchBar();
    return;
  }
  const active = document.activeElement;
  trigger = active instanceof HTMLElement && active !== document.body ? active : null;
  triggerKey = trigger ? elementKey(trigger) : null;
  fresh = true;
  lastTargetKey = null;
  browseOpenerKey = null;
  browseFresh = false;
  coveredScroll = window.pageYOffset;
  publish({ opened: true, query: "", browse: null });
}

/**
 * Rend vrai si la recherche était ouverte — c'est ce qu'attend la pile Retour.
 *
 * `restoreFocus` à faux quand on la quitte pour un autre écran, par le rail :
 * rendre le focus à son déclencheur le disputerait à l'écran d'arrivée.
 */
export function closeSearch(restoreFocus = true): boolean {
  if (!snapshot.opened) return false;
  publish(CLOSED);
  fresh = false;
  lastTargetKey = null;
  browseOpenerKey = null;
  browseFresh = false;

  // Après le rendu qui démonte la surcouche : lui rendre le focus avant
  // reviendrait à le poser sur un élément que React s'apprête à retirer.
  const target = trigger;
  const key = triggerKey;
  trigger = null;
  triggerKey = null;
  if (!restoreFocus) return true;
  setTimeout(() => {
    const element = target && target.isConnected ? target : key ? findByKey(key) : null;
    if (element && element.isConnected) element.focus();
  }, 0);
  return true;
}

export function setSearchQuery(query: string): void {
  if (!snapshot.opened || snapshot.query === query) return;
  publish({ ...snapshot, query });
}

export function openBrowse(target: SearchBrowseTarget, openerKey: string | null): void {
  if (!snapshot.opened) return;
  browseOpenerKey = openerKey;
  browseFresh = true;
  publish({ ...snapshot, browse: target });
}

/** Rend la clé de ce qui avait ouvert la recherche approfondie, ou `null`. */
export function closeBrowse(): { closed: boolean; openerKey: string | null } {
  if (!snapshot.browse) return { closed: false, openerKey: null };
  const openerKey = browseOpenerKey;
  browseOpenerKey = null;
  publish({ ...snapshot, browse: null });
  return { closed: true, openerKey };
}

/** Une recherche approfondie est-elle ouverte ? Lu hors de React, par la pile Retour. */
export function isBrowsing(): boolean {
  return snapshot.browse !== null;
}

/**
 * Ce que la surcouche montée sait faire de sa barre : y revenir, en désignant
 * ce qui avait ouvert la recherche approfondie comme l'entrée de la colonne des
 * résultats. Inscrit par elle — ni le rail ni le bouton Retour n'en tiennent
 * une référence.
 */
type BarReturn = (openerKey: string | null) => void;
let barReturn: BarReturn | null = null;

export function registerBarReturn(handler: BarReturn): () => void {
  barReturn = handler;
  return () => {
    if (barReturn === handler) barReturn = null;
  };
}

/**
 * Revenir à la barre de recherche : le geste du bouton Retour d'une page
 * d'acteur ou de genre, de la touche Retour sur cette page, et de l'entrée
 * « Rechercher » du rail. L'étagère se referme ; la saisie, les résultats et
 * leur défilement restent. Rend vrai si la recherche est ouverte.
 */
export function returnToSearchBar(): boolean {
  if (!snapshot.opened) return false;
  const { openerKey } = closeBrowse();
  // Après le rendu qui démonte l'étagère : tant qu'elle est là, la barre est
  // masquée (`data-covered`) et ne peut pas recevoir le focus.
  setTimeout(() => barReturn?.(openerKey), 0);
  return true;
}

/**
 * Vrai après `openBrowse`, jusqu'à ce que l'étagère ait posé le focus sur sa
 * première carte (`settleBrowse`). Lu et non consommé : le double montage du
 * mode strict, ou des données qui arrivent après le montage, ne le perdent pas.
 */
export function isBrowseFresh(): boolean {
  return browseFresh;
}

export function settleBrowse(): void {
  browseFresh = false;
}

/**
 * Vrai après `openSearch`, jusqu'à ce que la barre ait reçu le focus
 * (`settleOpen`) — lu et non consommé, pour la même raison que `isBrowseFresh`.
 */
export function isFreshOpen(): boolean {
  return fresh;
}

export function settleOpen(): void {
  fresh = false;
}

export function rememberSearchTarget(key: string | null): void {
  if (key) lastTargetKey = key;
}

export function lastSearchTarget(): string | null {
  return lastTargetKey;
}

export function useSearchState(): SearchSnapshot {
  return useSyncExternalStore(subscribe, readSnapshot);
}

function readOpened(): boolean {
  return snapshot.opened;
}

/** L'ouverture seule — un booléen : la frappe ne re-rend pas ceux qui ne lisent que lui. */
export function useSearchOpen(): boolean {
  return useSyncExternalStore(subscribe, readOpened);
}
