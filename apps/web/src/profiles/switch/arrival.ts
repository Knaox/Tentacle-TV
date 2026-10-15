import { useSyncExternalStore } from "react";
import type { CurtainProfile } from "./ProfileCurtain";
import { publishStartupWindow } from "../../startup/startupStore";

/**
 * L'ARRIVÉE dans un profil : le rideau au nom du profil qui se lève sur
 * l'application.
 *
 * - Après le rechargement d'une bascule, il doit être déjà là au premier
 *   rendu : passé par le stockage de SESSION de la fenêtre (il survit au
 *   rechargement, pas à la fermeture de l'application), lu UNE fois puis
 *   effacé — un rechargement manuel ne le rejoue pas (`markArrival`).
 * - Sans rechargement (SON profil choisi depuis « Qui regarde ? », la session
 *   personnelle continue), il est annoncé en mémoire (`announceArrival`) : le
 *   sélecteur s'efface derrière lui, l'application paraît quand il se lève.
 *
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */
export const PROFILE_ARRIVAL_KEY = "tentacle_profile_arrival";

export function markArrival(profile: CurtainProfile): void {
  try {
    sessionStorage.setItem(PROFILE_ARRIVAL_KEY, JSON.stringify(profile));
  } catch {
    /* stockage de session indisponible : l'application arrive sans rideau */
  }
}

export function consumeArrival(): CurtainProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_ARRIVAL_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(PROFILE_ARRIVAL_KEY);
    const parsed = JSON.parse(raw) as Partial<CurtainProfile> | null;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string" || typeof parsed.color !== "string") return null;
    return { id: parsed.id, name: parsed.name, color: parsed.color, imageTag: typeof parsed.imageTag === "string" ? parsed.imageTag : null };
  } catch {
    return null;
  }
}

/** Une arrivée annoncée sans rechargement, avec son numéro (deux annonces de suite : deux rideaux). */
export interface LiveArrival {
  profile: CurtainProfile;
  serial: number;
}

let live: LiveArrival | null = null;
let serial = 0;
const listeners = new Set<() => void>();

/** Le rideau baissé tient la première fenêtre du démarrage (`startup/startupOrder.ts`). */
export const CURTAIN_STARTUP_SOURCE = "profileArrival";

export function announceArrival(profile: CurtainProfile): void {
  // Tout de suite : l'application se monte sous le rideau dans le même geste,
  // ses fenêtres ne doivent pas le devancer. `ProfileArrival` le relâche à la levée.
  publishStartupWindow(CURTAIN_STARTUP_SOURCE, "profile", "open");
  serial += 1;
  live = { profile, serial };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLiveArrival(): LiveArrival | null {
  return useSyncExternalStore(subscribe, () => live, () => null);
}
