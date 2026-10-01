import { useSyncExternalStore } from "react";
import type { NoticeKind, NoticeModel } from "../../redesign/screens/overlays/NoticeToast";

/**
 * Les avis brefs de l'app (Apple TV) — ce qu'un geste vient de faire, ou
 * pourquoi il ne fait rien —, montrés par `NoticeToast` en haut à droite,
 * sans jamais prendre le focus. N'importe quel câblage en pose un
 * (`showNotice`) ; l'hôte, monté une fois au-dessus du navigateur, l'affiche.
 * Un seul à la fois : le suivant remplace le précédent, et chacun s'efface
 * seul à son échéance.
 */

/** Une phrase seule ; un titre et sa suite se lisent plus longtemps. */
const SHORT_MS = 4000;
const LONG_MS = 5500;

type Listener = () => void;

let current: NoticeModel | null = null;
let sequence = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function publish(next: NoticeModel | null): void {
  current = next;
  for (const listener of listeners) listener();
}

export function showNotice(notice: { kind: NoticeKind; title: string; text?: string }): void {
  if (timer) clearTimeout(timer);
  const durationMs = notice.text ? LONG_MS : SHORT_MS;
  sequence += 1;
  publish({ ...notice, id: sequence, durationMs });
  timer = setTimeout(() => {
    timer = null;
    publish(null);
  }, durationMs);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => current;

/** L'avis montré, ou null. */
export function useTransientNotice(): NoticeModel | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
