import { useSyncExternalStore } from "react";
import type { Router } from "expo-router";
import { familyPosterRequestOf } from "@tentacle-tv/shared";
import { releaseOpenPlayer } from "@/player/openPlayer";

/**
 * La demande d'ouvrir l'AFFICHE d'une invitation précise — la cloche, un
 * push ou la page de la Famille la posent ; l'hôte de l'affiche (monté à la
 * racine) la lit, relit la Famille au serveur, puis l'efface. Un magasin de
 * module : l'appelant et l'affiche vivent dans des branches de l'arbre qui ne
 * se connaissent pas, et un push de démarrage à froid arrive avant elle.
 *
 * L'identifiant ne fait que CHOISIR parmi les invitations que le serveur rend
 * à la session : jamais il n'est envoyé tel quel au serveur.
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
  return () => {
    listeners.delete(listener);
  };
}

export function useFamilyPosterRequest(): string | null {
  return useSyncExternalStore(subscribe, () => requestedId, () => null);
}

/**
 * Le geste sur une notification de la Famille (cloche ou push) : « X vous
 * invite… » ouvre l'affiche de CETTE invitation — vrai : rien d'autre à
 * faire. En pleine lecture, le lecteur est d'abord quitté, comme pour toute
 * notification (`openNotificationRoute`) : l'affiche ne se montre jamais sur
 * lui. Les autres notifications de la Famille mènent à sa page.
 */
export function openFamilyNotification(router: Router, notification: { type: string; refId?: string | null }): boolean {
  const invitationId = familyPosterRequestOf({ type: notification.type, refId: notification.refId ?? null });
  if (!invitationId) return false;
  if (releaseOpenPlayer() && router.canDismiss()) router.dismiss();
  requestFamilyPoster(invitationId);
  return true;
}
