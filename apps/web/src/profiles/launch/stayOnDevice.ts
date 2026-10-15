import type { PickerDeviceChoice, PickerStay } from "@tentacle-tv/shared";
import { getBackendBase } from "../../lib/backendBase";

/**
 * « Ne plus proposer sur cet appareil » : le profil que CET ordinateur ouvre
 * sans passer par « Qui regarde ? » (règle : shared `familyPickerStay.ts`).
 * Stockage LOCAL, par serveur ET par compte — un autre compte, un autre
 * serveur sur la même machine n'en héritent jamais. Aucun secret : un
 * identifiant de profil et un drapeau. Lecture et écriture protégées : un
 * stockage illisible vaut « jamais choisi » (le défaut de l'administration).
 *
 * Avec lui, le CHOIX de cet ordinateur (shared `familyPickerDevice.ts`) :
 * `stay` (ce profil retenu), `ask` (il propose « Qui regarde ? » — la marque
 * `tentacle_profile_launch_ask`), ou `unset` (jamais choisi). L'un efface
 * l'autre.
 *
 * ⚠️ Clés traversées par une chaîne : jamais renommées.
 */
export const STAY_ON_DEVICE_KEY = "tentacle_profile_launch_stay";
export const ASK_ON_DEVICE_KEY = "tentacle_profile_launch_ask";

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

/** Retenir ce profil pour le serveur de l'application et ce compte (« ne plus proposer »). */
export function writeStayOnThisServer(accountId: string, stay: PickerStay): void {
  try {
    const stored: StoredStay = { server: getBackendBase(), accountId, profileId: stay.profileId, hasPin: stay.hasPin };
    localStorage.setItem(STAY_ON_DEVICE_KEY, JSON.stringify(stored));
    localStorage.removeItem(ASK_ON_DEVICE_KEY);
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

/** Cet ordinateur propose « Qui regarde ? » à l'ouverture (le profil retenu est oublié). */
export function askOnThisServer(accountId: string): void {
  try {
    localStorage.removeItem(STAY_ON_DEVICE_KEY);
    localStorage.setItem(ASK_ON_DEVICE_KEY, JSON.stringify({ server: getBackendBase(), accountId }));
  } catch {
    /* stockage bloqué : le défaut de l'administration vaudra */
  }
}

function readAsk(server: string, accountId: string): boolean {
  try {
    const parsed = JSON.parse(localStorage.getItem(ASK_ON_DEVICE_KEY) ?? "null") as { server?: unknown; accountId?: unknown } | null;
    return !!parsed && parsed.server === server && parsed.accountId === accountId;
  } catch {
    return false;
  }
}

/** Le choix de cet ordinateur pour ce serveur et ce compte. */
export function readDeviceChoice(server: string, accountId: string | null): PickerDeviceChoice {
  if (!accountId) return "unset";
  if (readStayOnDevice(server, accountId)) return "stay";
  return readAsk(server, accountId) ? "ask" : "unset";
}

export function readDeviceChoiceOnThisServer(accountId: string | null): PickerDeviceChoice {
  try {
    return readDeviceChoice(getBackendBase(), accountId);
  } catch {
    return "unset";
  }
}

/** Plus rien de choisi sur cet ordinateur (une déconnexion : comme une TV déjumelée). */
export function forgetDeviceLaunchChoice(): void {
  forgetStayOnDevice();
  try {
    localStorage.removeItem(ASK_ON_DEVICE_KEY);
  } catch {
    /* rien à oublier */
  }
}
