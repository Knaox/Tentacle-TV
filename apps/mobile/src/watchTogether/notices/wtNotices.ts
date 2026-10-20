import { useSyncExternalStore } from "react";

/**
 * Watch Together — les messages brefs du groupe (« X a mis en pause », « X a
 * rejoint le groupe »…). Hors du lecteur, ils passent par les messages de
 * l'app (`showToast`) ; DANS le lecteur, où l'hôte des avertissements se
 * tait, par ce magasin, que le lecteur affiche en bas à gauche (`WtNoticeLayer`).
 * Trois au plus, chacun ~3,5 s ; le même texte n'est jamais doublé.
 */

export type WtNoticeKind = "success" | "error" | "info";

export interface WtNotice {
  id: number;
  kind: WtNoticeKind;
  text: string;
}

export const WT_NOTICE_TTL_MS = 3_500;
export const WT_NOTICE_MAX = 3;

let notices: readonly WtNotice[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

export function pushWtNotice(kind: WtNoticeKind, text: string, setTimer = setTimeout): void {
  if (notices.some((n) => n.text === text)) return;
  sequence += 1;
  const id = sequence;
  notices = [...notices, { id, kind, text }].slice(-WT_NOTICE_MAX);
  emit();
  setTimer(() => dismissWtNotice(id), WT_NOTICE_TTL_MS);
}

export function dismissWtNotice(id: number): void {
  const next = notices.filter((n) => n.id !== id);
  if (next.length === notices.length) return;
  notices = next;
  emit();
}

export function currentWtNotices(): readonly WtNotice[] { return notices; }

export function clearWtNotices(): void { notices = []; emit(); }

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useWtNotices(): readonly WtNotice[] {
  return useSyncExternalStore(subscribe, currentWtNotices, currentWtNotices);
}
