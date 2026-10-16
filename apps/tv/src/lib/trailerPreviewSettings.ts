import { useSyncExternalStore } from "react";
import {
  DEFAULT_TRAILER_PREVIEW_DELAY, createBooleanStore, parseTrailerPreviewDelay, type TrailerPreviewDelay,
} from "@tentacle-tv/shared";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Les réglages de l'aperçu des bandes-annonces au focus d'une carte (Apple TV,
 * Android TV) — réglages d'APPAREIL, comme sur le bureau : le salon où l'on
 * regarde, pas le compte. Allumés par défaut, avec le son, comme Netflix.
 * Clés traversées par une chaîne — ne jamais renommer (cf. CLAUDE.md).
 */
export const TRAILER_PREVIEWS_KEY = "tentacle_tv_trailer_previews";
export const TRAILER_PREVIEW_SOUND_KEY = "tentacle_tv_trailer_preview_sound";
/** Le délai entre l'arrivée du focus et la première image de l'aperçu (shared `previewDelay.ts`). */
export const TRAILER_PREVIEW_DELAY_KEY = "tentacle_tv_trailer_preview_delay";

/** Coupé : aucune carte ne grandit, rien n'est demandé au serveur. */
export const trailerPreviewsStore = createBooleanStore(tvStorage, TRAILER_PREVIEWS_KEY, true);
/** Coupé : l'aperçu se joue sans le son. */
export const trailerPreviewSoundStore = createBooleanStore(tvStorage, TRAILER_PREVIEW_SOUND_KEY, true);

export function useTrailerPreviewsEnabled(): boolean {
  return useSyncExternalStore(trailerPreviewsStore.subscribe, trailerPreviewsStore.readSnapshot, trailerPreviewsStore.readSnapshot);
}

export function useTrailerPreviewSound(): boolean {
  return useSyncExternalStore(trailerPreviewSoundStore.subscribe, trailerPreviewSoundStore.readSnapshot, trailerPreviewSoundStore.readSnapshot);
}

function readDelay(): TrailerPreviewDelay {
  try {
    return parseTrailerPreviewDelay(tvStorage.getItem(TRAILER_PREVIEW_DELAY_KEY));
  } catch {
    return DEFAULT_TRAILER_PREVIEW_DELAY;
  }
}

const delayListeners = new Set<() => void>();
let delaySnapshot: TrailerPreviewDelay = readDelay();
const notifyDelay = () => delayListeners.forEach((listener) => listener());

/**
 * Le délai des aperçus de CE téléviseur : 800 ms par défaut, rien n'est écrit
 * tant qu'on n'y touche pas ; une valeur inconnue vaut ce défaut.
 */
export const trailerPreviewDelayStore = {
  subscribe(callback: () => void): () => void {
    delayListeners.add(callback);
    return () => {
      delayListeners.delete(callback);
    };
  },
  readSnapshot: (): TrailerPreviewDelay => delaySnapshot,
  set(raw: number): void {
    const delay = parseTrailerPreviewDelay(raw);
    if (delay === delaySnapshot) return;
    delaySnapshot = delay;
    try {
      tvStorage.setItem(TRAILER_PREVIEW_DELAY_KEY, String(delay));
    } catch {
      // Stockage indisponible : le réglage vaut pour cette session.
    }
    notifyDelay();
  },
  /** Android TV : relu une fois le stockage hydraté (`lib/stores.ts`). */
  rehydrate(): void {
    const value = readDelay();
    if (value === delaySnapshot) return;
    delaySnapshot = value;
    notifyDelay();
  },
};

export function useTrailerPreviewDelay(): TrailerPreviewDelay {
  return useSyncExternalStore(trailerPreviewDelayStore.subscribe, trailerPreviewDelayStore.readSnapshot, trailerPreviewDelayStore.readSnapshot);
}

/** Android TV : les trois réglages des aperçus, relus une fois le stockage hydraté (`lib/stores.ts`). */
export function rehydrateTrailerPreviewSettings(): void {
  trailerPreviewsStore.rehydrate();
  trailerPreviewSoundStore.rehydrate();
  trailerPreviewDelayStore.rehydrate();
}
