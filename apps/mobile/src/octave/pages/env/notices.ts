/**
 * Octave mobile — les AVIS des gestes (« Ajouté à Soirée — Changer », refus de
 * l'extension) : un magasin minuscule, lu par l'hôte des pages
 * (`NoticeHost`). Un avis nouveau remplace le précédent ; il s'efface seul.
 */

import { useSyncExternalStore } from "react";
import type { ActionNoticeKind, ActionNoticeOptions } from "@tentacle-tv/api-client";

export interface PagesNotice extends ActionNoticeOptions {
  id: number;
  kind: ActionNoticeKind;
  message: string;
}

export const NOTICE_MS = 3_500;

let current: PagesNotice | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showNotice(kind: ActionNoticeKind, message: string, options?: ActionNoticeOptions): void {
  if (timer) clearTimeout(timer);
  current = { id: ++seq, kind, message, ...options };
  emit();
  timer = setTimeout(dismissNotice, options?.action ? NOTICE_MS * 1.6 : NOTICE_MS);
}

export function dismissNotice(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!current) return;
  current = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => current;

/** L'avis montré (hors React : tests, journal). */
export const readNotice = read;

export function useNotice(): PagesNotice | null {
  return useSyncExternalStore(subscribe, read, read);
}
