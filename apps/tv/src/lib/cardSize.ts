import { useSyncExternalStore } from "react";
import { CARD_SIZE_STORAGE_KEY, DEFAULT_CARD_SIZE, parseCardSize, type CardSize } from "@tentacle-tv/tv-core";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Le réglage « Taille des cartes » de ce téléviseur : un réglage d'APPAREIL
 * (clé `tentacle_tv_card_size`, traversée par une chaîne : ne jamais la
 * renommer), « normal » par défaut — rien n'est écrit tant qu'on n'y touche
 * pas, et une valeur inconnue vaut la taille normale (`parseCardSize`).
 *
 * Les vues de la refonte ne lisent pas le stockage : `App.tsx` monte
 * `CardSizeProvider` sur ce magasin, l'onglet Apparence des réglages l'écrit,
 * et toutes les cartes changent de taille aussitôt.
 */

function read(): CardSize {
  try {
    return parseCardSize(tvStorage.getItem(CARD_SIZE_STORAGE_KEY));
  } catch {
    return DEFAULT_CARD_SIZE;
  }
}

const listeners = new Set<() => void>();
let snapshot: CardSize = read();

const notify = () => listeners.forEach((listener) => listener());

export const cardSizeStore = {
  subscribe(callback: () => void): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
  readSnapshot: (): CardSize => snapshot,
  set(size: CardSize): void {
    if (size === snapshot) return;
    snapshot = size;
    try {
      tvStorage.setItem(CARD_SIZE_STORAGE_KEY, size);
    } catch {
      // Stockage indisponible : le réglage vaut pour cette session.
    }
    notify();
  },
  /** Android TV : relu une fois le stockage hydraté (`lib/stores.ts`). */
  rehydrate(): void {
    const value = read();
    if (value === snapshot) return;
    snapshot = value;
    notify();
  },
};

export function useCardSizeSetting(): CardSize {
  return useSyncExternalStore(cardSizeStore.subscribe, cardSizeStore.readSnapshot, cardSizeStore.readSnapshot);
}
