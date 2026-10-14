import type { PickerStay } from "@tentacle-tv/shared";
import { getBackendBase } from "../../lib/backendBase";

/**
 * « Ne plus proposer sur cet appareil » : le profil que CET ordinateur ouvre
 * sans passer par « Qui regarde ? » (règle : shared `familyPickerStay.ts`).
 * Stockage LOCAL, par serveur ET par compte — un autre compte, un autre
 * serveur sur la même machine n'en héritent jamais. Aucun secret : un
 * identifiant de profil et un drapeau. Lecture et écriture protégées : un
 * stockage illisible vaut « rien de retenu » (la préférence du compte).
 *
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */
export const STAY_ON_DEVICE_KEY = "tentacle_profile_launch_stay";

interface StoredStay extends PickerStay {
  server: string;
  accountId: string;
}

export function readStayOnDevice(server: string, accountId: string | null): PickerStay | null {
  if (!accountId) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STAY_ON_DEVICE_KEY) ?? "null") as Partial<StoredStay> | null;
    if (!parsed || parsed.server !== server || parsed.accountId !== accountId) return null;
    if (typeof parsed.profileId !== "string" || !parsed.profileId || typeof parsed.hasPin !== "boolean") return null;
    return { profileId: parsed.profileId, hasPin: parsed.hasPin };
  } catch {
    return null;
  }
}

/** Le profil retenu pour le serveur de l'application ; null si rien (ou stockage illisible). */
export function readStayOnThisServer(accountId: string | null): PickerStay | null {
  try {
    return readStayOnDevice(getBackendBase(), accountId);
  } catch {
    return null;
  }
}

/** Retenir ce profil pour le serveur de l'application et ce compte. */
export function writeStayOnThisServer(accountId: string, stay: PickerStay): void {
  try {
    const stored: StoredStay = { server: getBackendBase(), accountId, profileId: stay.profileId, hasPin: stay.hasPin };
    localStorage.setItem(STAY_ON_DEVICE_KEY, JSON.stringify(stored));
  } catch {
    /* stockage plein ou bloqué : « Qui regarde ? » se reproposera, rien de plus */
  }
}

export function forgetStayOnDevice(): void {
  try {
    localStorage.removeItem(STAY_ON_DEVICE_KEY);
  } catch {
    /* rien à oublier */
  }
}
