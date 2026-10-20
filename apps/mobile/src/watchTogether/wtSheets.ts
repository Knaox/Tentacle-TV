import { useSyncExternalStore } from "react";
import { whenNoModal } from "@/components/ui/modalGate";

/**
 * Watch Together mobile — quelle feuille est ouverte, un magasin de module
 * (même motif que `roomModalStore` du web) : la fiche, la pilule de
 * l'accueil, le panneau du lecteur et les liens profonds ouvrent LES MÊMES
 * feuilles, montées une fois par l'hôte (`WatchTogetherHost`). Une à la fois,
 * ENCHAÎNÉES : en ouvrir une referme l'autre, puis attend qu'elle soit retirée
 * (`whenNoModal`) avant de monter la suivante. Les deux d'un coup, c'était le
 * gel de « Inviter » (alpha du 21/10) : iOS ne présente pas une modale
 * pendant qu'une autre est encore à l'écran — la nouvelle ne paraissait
 * jamais et plus aucun toucher ne répondait.
 */

export type WtSheet = "room" | "invite" | "inbox" | null;

let current: WtSheet = null;
const listeners = new Set<() => void>();

function set(next: WtSheet): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

/** Le numéro de la dernière demande : une ouverture dépassée ne s'exécute pas. */
let request = 0;

/**
 * Referme la feuille ouverte, puis lance `run` une fois TOUTE modale retirée
 * — une autre feuille, la modale de l'affinité, une navigation présentée
 * (lecteur). Une fermeture ou une ouverture demandée entre-temps l'annule.
 */
export function afterWtSheet(run: () => void): void {
  const mine = ++request;
  set(null);
  whenNoModal(() => { if (mine === request) run(); });
}

export function openWtSheet(sheet: Exclude<WtSheet, null>): void {
  if (sheet === current) return;
  afterWtSheet(() => set(sheet));
}

export function closeWtSheet(): void {
  request += 1;
  set(null);
}
export function currentWtSheet(): WtSheet { return current; }

/** Suivre le magasin hors React (bancs, tests). */
export function subscribeWtSheet(listener: () => void): () => void { return subscribe(listener); }

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
