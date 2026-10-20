import { useSyncExternalStore } from "react";

/**
 * L'ÉPOQUE de la session du mobile : elle avance à chaque bascule de profil
 * (`switchSession.ts`). `AppProviders` reconstruit alors son client Jellyfin
 * (nouveau jeton, nouvelle identité), relit le jeton des sockets et des
 * appels Tentacle : l'équivalent du rechargement de page du bureau, sans
 * quitter l'app. Le cache des requêtes est vidé par la bascule elle-même.
 *
 * « Qui regarde ? » exigé (une session de profil a pris fin) : `pickerRequest`,
 * lu par la porte du lancement (`ProfileLaunchGate`).
 */

let epoch = 0;
let pickerRequest: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function bumpSessionEpoch(): void {
  epoch += 1;
  emit();
}

export function requestProfilePicker(reason: string): void {
  pickerRequest = reason;
  emit();
}

export function clearProfilePickerRequest(): void {
  if (pickerRequest === null) return;
  pickerRequest = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSessionEpoch(): number {
  return useSyncExternalStore(subscribe, () => epoch, () => epoch);
}

export function useProfilePickerRequest(): string | null {
  return useSyncExternalStore(subscribe, () => pickerRequest, () => pickerRequest);
}
