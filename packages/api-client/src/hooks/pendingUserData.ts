/**
 * Les gestes EN COURS sur l'état d'un titre (vu, favori, Ma liste) — ce que
 * l'utilisateur vient de demander et que le serveur n'a pas encore confirmé.
 *
 * Le patch optimiste des caches (`cacheUtils`) ne suffit pas à ce qu'un geste
 * réponde tout de suite PARTOUT : il ne peut rien écrire quand aucun cache ne
 * porte le titre — une carte de recommandation dont la fiche n'est pas
 * chargée, une carte réduite dont la fiche arrive, une série dont l'ensemble
 * « Ma liste » n'est pas encore là. Le geste se tient donc ICI, par
 * identifiant, et les cartes le lisent par-dessus leur `UserData`
 * (`useCardToggles`, `useCardMarkers`).
 *
 * Il ne dure que le temps du geste : relâché dès que la vérité est en cache
 * (réussite) ou que le geste est défait (échec). Rien n'est gardé au-delà —
 * ce n'est pas un cache, et il ne peut donc pas contredire le serveur plus tard.
 */

import { useSyncExternalStore } from "react";
import type { MediaItem, UserItemData } from "@tentacle-tv/shared";

export type PendingUserData = Partial<UserItemData>;

interface Held {
  token: number;
  patch: PendingUserData;
}

const held = new Map<string, Held[]>();
/** La vue fusionnée par titre — même référence tant que rien ne change (instantané stable). */
const merged = new Map<string, PendingUserData>();
const listeners = new Set<() => void>();
let nextToken = 1;

function publish(itemId: string): void {
  const stack = held.get(itemId);
  if (stack === undefined || stack.length === 0) {
    held.delete(itemId);
    merged.delete(itemId);
  } else {
    merged.set(itemId, Object.assign({}, ...stack.map((entry) => entry.patch)) as PendingUserData);
  }
  for (const listener of listeners) listener();
}

/** Tient un geste sur ce titre ; la fonction rendue le relâche (une seule fois). */
export function holdPendingUserData(itemId: string | undefined, patch: PendingUserData): () => void {
  if (!itemId) return () => undefined;
  const token = nextToken++;
  held.set(itemId, [...(held.get(itemId) ?? []), { token, patch }]);
  publish(itemId);
  return () => {
    const stack = held.get(itemId);
    if (stack === undefined || !stack.some((entry) => entry.token === token)) return;
    held.set(itemId, stack.filter((entry) => entry.token !== token));
    publish(itemId);
  };
}

export function pendingUserDataFor(itemId: string | undefined): PendingUserData | undefined {
  return itemId ? merged.get(itemId) : undefined;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Le geste en cours sur ce titre ; ne réveille que la carte concernée. */
export function usePendingUserData(itemId: string | undefined): PendingUserData | undefined {
  return useSyncExternalStore(subscribe, () => pendingUserDataFor(itemId), () => pendingUserDataFor(itemId));
}

/** L'item tel que la carte doit le montrer : son `UserData`, le geste en cours par-dessus. */
export function withPendingUserData<T extends MediaItem>(item: T, pending: PendingUserData | undefined): T {
  if (pending === undefined) return item;
  return { ...item, UserData: { ...item.UserData, ...pending } as UserItemData };
}

export function resetPendingUserDataForTests(): void {
  held.clear();
  merged.clear();
}
