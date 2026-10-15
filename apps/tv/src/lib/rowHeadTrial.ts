import { useSyncExternalStore } from "react";
import { DEFAULT_ROW_HEAD_OPTIONS, type RowHeadEnd, type RowHeadOptions, type RowHeadRelease } from "@tentacle-tv/tv-core";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * L'ESSAI « la carte en aperçu passe en tête » (lot du 16/10) : ce que fait
 * une rangée en bout de course, et quand le focus la quitte — réglage de CE
 * téléviseur, le temps de choisir (Réglages › Lecture, sous les aperçus).
 * Le choix fait, le réglage s'en ira et la règle gardera la valeur retenue.
 * Clés traversées par une chaîne — ne jamais renommer (cf. CLAUDE.md).
 */
export const ROW_HEAD_END_KEY = "tentacle_tv_row_head_end";
export const ROW_HEAD_RELEASE_KEY = "tentacle_tv_row_head_release";

const ENDS: readonly RowHeadEnd[] = ["stop", "overscroll"];
const RELEASES: readonly RowHeadRelease[] = ["stay", "return"];

function readChoice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try {
    const raw = tvStorage.getItem(key);
    return choices.find((choice) => choice === raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function read(): RowHeadOptions {
  return {
    end: readChoice(ROW_HEAD_END_KEY, ENDS, DEFAULT_ROW_HEAD_OPTIONS.end),
    release: readChoice(ROW_HEAD_RELEASE_KEY, RELEASES, DEFAULT_ROW_HEAD_OPTIONS.release),
  };
}

const listeners = new Set<() => void>();
let snapshot: RowHeadOptions = read();

const notify = () => listeners.forEach((listener) => listener());

export const rowHeadTrialStore = {
  subscribe(callback: () => void): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
  readSnapshot: (): RowHeadOptions => snapshot,
  set(patch: Partial<RowHeadOptions>): void {
    const next = { ...snapshot, ...patch };
    if (next.end === snapshot.end && next.release === snapshot.release) return;
    snapshot = next;
    try {
      tvStorage.setItem(ROW_HEAD_END_KEY, next.end);
      tvStorage.setItem(ROW_HEAD_RELEASE_KEY, next.release);
    } catch {
      // Stockage indisponible : l'essai vaut pour cette session.
    }
    notify();
  },
  /** Android TV : relu une fois le stockage hydraté (`lib/stores.ts`). */
  rehydrate(): void {
    const value = read();
    if (value.end === snapshot.end && value.release === snapshot.release) return;
    snapshot = value;
    notify();
  },
};

export function useRowHeadTrial(): RowHeadOptions {
  return useSyncExternalStore(rowHeadTrialStore.subscribe, rowHeadTrialStore.readSnapshot, rowHeadTrialStore.readSnapshot);
}
