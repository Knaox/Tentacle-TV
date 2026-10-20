import { useSyncExternalStore } from "react";

/**
 * Watch Together mobile — quelle feuille est ouverte, un magasin de module
 * (même motif que `roomModalStore` du web) : la fiche, la pilule de
 * l'accueil, le panneau du lecteur et les liens profonds ouvrent LES MÊMES
 * feuilles, montées une fois par l'hôte (`WatchTogetherHost`). Une à la fois :
 * en ouvrir une referme l'autre (une modale ne s'empile pas sur une autre).
 */

export type WtSheet = "room" | "invite" | "inbox" | null;

let current: WtSheet = null;
const listeners = new Set<() => void>();

function set(next: WtSheet): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function openWtSheet(sheet: Exclude<WtSheet, null>): void { set(sheet); }
export function closeWtSheet(): void { set(null); }
export function currentWtSheet(): WtSheet { return current; }

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useWtSheet(): WtSheet {
  return useSyncExternalStore(subscribe, currentWtSheet, currentWtSheet);
}

/**
 * Un lien profond (`tentacle://watch-together`, `…/affinity`) arrive souvent
 * à froid, avant que la séance soit connue : la route le NOTE et rend la main
 * à l'accueil ; l'hôte l'honore dès qu'il peut (`takeWtLink`), une fois.
 */
export type WtLink = "room" | "affinity";
let pendingLink: WtLink | null = null;

export function requestWtLink(link: WtLink): void {
  pendingLink = link;
  for (const listener of listeners) listener();
}

/** La demande en attente, retirée au passage. */
export function takeWtLink(): WtLink | null {
  const link = pendingLink;
  pendingLink = null;
  return link;
}

export function peekWtLink(): WtLink | null { return pendingLink; }

/** La demande de lien en attente, suivie (l'hôte la prend quand il peut). */
export function useWtLink(): WtLink | null {
  return useSyncExternalStore(subscribe, peekWtLink, peekWtLink);
}
