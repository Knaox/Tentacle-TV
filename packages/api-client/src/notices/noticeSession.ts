import { useSyncExternalStore } from "react";
import type { NoticeId } from "@tentacle-tv/shared";

/**
 * Ce qui s'est effacé seul ou a été fermé pendant la SESSION de l'app — en
 * mémoire du module, pas d'un composant : une page qui se remonte (la fiche,
 * puis le retour) ne fait pas revenir un avertissement déjà lu. Le lancement
 * suivant le redira si sa cause tient ; « pour de bon » passe par les rappels
 * du compte, jamais par ici.
 */

let closed: ReadonlySet<NoticeId> = new Set();
const listeners = new Set<() => void>();

export function closeNoticeForSession(id: NoticeId): void {
  if (closed.has(id)) return;
  closed = new Set([...closed, id]);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useClosedNotices(): ReadonlySet<NoticeId> {
  return useSyncExternalStore(subscribe, () => closed, () => closed);
}

/** Pour les tests : une session neuve. */
export function resetNoticeSession(): void {
  closed = new Set();
  listeners.forEach((listener) => listener());
}
