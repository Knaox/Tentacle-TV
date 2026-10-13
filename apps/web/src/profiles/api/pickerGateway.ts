import {
  fetchPickerPreference,
  fetchPickerProfiles,
  pickFamilyProfile,
  setPickerPreference,
  type PickerCall,
} from "@tentacle-tv/api-client";
import type { PickedProfileDto, PickerPreferenceDto, PickerProfilesDto } from "@tentacle-tv/shared";
import { accountToken } from "../../auth/profileSession";
import { getBackendBase } from "../../lib/backendBase";

/**
 * Les appels de « Qui regarde ? » du bureau, portés par le jeton de la
 * SESSION PERSONNELLE — explicitement : pendant une session de profil, le
 * jeton courant de l'application est celui du profil, et le serveur refuse
 * ces routes à une session de profil (contrat : shared `familyPickerContract.ts`).
 */

export const PICKER_PLATFORM = "desktop" as const;

/** La clé react-query de la famille vue par « Qui regarde ? ». Sous `["family"]` :
 *  `family:update` (`useFamilyLive`) la relit avec le reste. */
export function pickerProfilesKey(accountId: string | null) {
  return ["family", "picker", accountId ?? "none"] as const;
}

/** Le jeton personnel manque (session perdue) : l'appel ne part pas. */
export class NoPersonalSession extends Error {
  constructor() {
    super("no personal session");
    this.name = "NoPersonalSession";
  }
}

function personalCall(signal?: AbortSignal): PickerCall {
  const token = accountToken();
  if (!token) throw new NoPersonalSession();
  return { serverUrl: getBackendBase(), personalToken: token, signal };
}

export function loadPickerProfiles(signal?: AbortSignal): Promise<PickerProfilesDto> {
  return fetchPickerProfiles(personalCall(signal), PICKER_PLATFORM);
}

export function pickProfile(profileId: string, pin: string | undefined, deviceName: string): Promise<PickedProfileDto> {
  return pickFamilyProfile(personalCall(), {
    platform: PICKER_PLATFORM,
    profileId,
    ...(pin !== undefined && { pin }),
    deviceName,
  });
}

export function loadPickerPreference(): Promise<PickerPreferenceDto> {
  return fetchPickerPreference(personalCall());
}

export function savePickerPreference(atLaunch: boolean): Promise<PickerPreferenceDto> {
  return setPickerPreference(personalCall(), { platform: PICKER_PLATFORM, atLaunch });
}

