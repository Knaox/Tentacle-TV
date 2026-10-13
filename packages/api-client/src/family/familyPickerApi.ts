import {
  familyPath,
  type FamilyPickerPlatform,
  type PickProfileBody,
  type PickedProfileDto,
  type PickerPreferenceDto,
  type PickerProfilesDto,
  type SetPickerPreferenceBody,
} from "@tentacle-tv/shared";
import { TentacleApiError } from "../hooks/usePreferences";

/**
 * « Qui regarde ? » sur le BUREAU — des appels qui portent TOUJOURS le jeton
 * de la SESSION PERSONNELLE, explicitement : pendant une session de profil,
 * le jeton courant de l'application est celui du profil, et le serveur refuse
 * ces routes à une session de profil (`family.personal_session_required`).
 * Serveur sans la capacité `family.desktopProfiles` : ne pas appeler.
 *
 * Un refus porte son code : `familyErrorFromApi` (`familyApi.ts`) le lit —
 * `family.pin_required`, `family.pin_invalid` (`attemptsLeft`),
 * `family.pin_locked` (`lockedUntil`), `family.profile_unavailable`,
 * `family.disabled`, `family.guests_disabled`. Contrat : `@tentacle-tv/shared`
 * › `family/familyPickerContract.ts` ; mécanisme : docs/FAMILLE.md.
 */

export interface PickerCall {
  /** L'adresse du serveur Tentacle, sans `/` final. */
  serverUrl: string;
  /** Le jeton de la session PERSONNELLE (jamais celui d'une session de profil). */
  personalToken: string;
  signal?: AbortSignal;
}

async function pickerCall<T>(call: PickerCall, path: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${call.personalToken}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${call.serverUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      signal: call.signal,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new TentacleApiError(error instanceof Error ? error.message : "network", 0);
  }
  if (!res.ok) throw new TentacleApiError(await res.text().catch(() => `${res.status}`), res.status);
  return res.json() as Promise<T>;
}

/** La famille du compte, le profil en cours sur cet appareil, et la préférence « au lancement ». */
export function fetchPickerProfiles(call: PickerCall, platform: FamilyPickerPlatform): Promise<PickerProfilesDto> {
  return pickerCall(call, `${familyPath("pickerProfiles")}?platform=${encodeURIComponent(platform)}`, "GET");
}

/** Choisir un profil : `personal` (le compte — la session personnelle reprend)
 *  ou une session de profil (`token`), qui ferme la précédente de cet appareil. */
export function pickFamilyProfile(call: PickerCall, body: PickProfileBody): Promise<PickedProfileDto> {
  return pickerCall(call, familyPath("pickProfile"), "POST", body);
}

export function fetchPickerPreference(call: PickerCall): Promise<PickerPreferenceDto> {
  return pickerCall(call, familyPath("pickerPreference"), "GET");
}

export function setPickerPreference(call: PickerCall, body: SetPickerPreferenceBody): Promise<PickerPreferenceDto> {
  return pickerCall(call, familyPath("setPickerPreference"), "PUT", body);
}
