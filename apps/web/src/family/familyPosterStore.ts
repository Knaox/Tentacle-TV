import { useSyncExternalStore } from "react";

/**
 * La demande d'ouvrir l'affiche d'une invitation précise — la cloche la pose
 * (clic sur « X vous invite… »), l'hôte de l'affiche la lit puis l'efface.
 * Un simple magasin de module : la cloche et l'affiche vivent dans deux
 * branches de l'arbre qui ne se connaissent pas.
 */

let requestedId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function requestFamilyPoster(invitationId: string): void {
  requestedId = invitationId;
  emit();
}

export function clearFamilyPosterRequest(): void {
  if (requestedId === null) return;
  requestedId = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFamilyPosterRequest(): string | null {
  return useSyncExternalStore(subscribe, () => requestedId, () => null);
}

/**
 * Le clic sur une notification de la cloche : « X vous invite… » ouvre
 * l'AFFICHE de cette invitation (vrai : la cloche n'a rien d'autre à faire).
 * Les autres notifications de la Famille mènent à sa page, par la route
 * commune (`resolveNotificationRoute`).
 */
export function openFamilyNotification(notification: { type: string; refId: string | null }): boolean {
  if (notification.type !== "family_invite" || !notification.refId) return false;
  requestFamilyPoster(notification.refId);
  return true;
}
