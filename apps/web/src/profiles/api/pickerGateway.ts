import {
  fetchPickerProfiles,
  pickFamilyProfile,
  type PickerCall,
} from "@tentacle-tv/api-client";
import { withDeviceChoice, type PickedProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import { accountToken, accountUserId } from "../../auth/profileSession";
import { getBackendBase } from "../../lib/backendBase";
import { readDeviceChoiceOnThisServer } from "../launch/stayOnDevice";
import { ACCOUNT_HELD_BY_SERVER, PICKER_PLATFORM } from "../pickerPlatform";

/**
 * Les appels de « Qui regarde ? », portés par la SESSION PERSONNELLE —
 * explicitement : pendant une session de profil, le jeton courant de
 * l'application est celui du profil, et le serveur refuse ces routes à une
 * session de profil (contrat : shared `familyPickerContract.ts`). Le bureau
 * présente le jeton qu'il garde ; le navigateur, ses cookies — le serveur y lit
 * la réserve du compte (`pickerPlatform.ts`).
 */

export { PICKER_PLATFORM };

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
  if (ACCOUNT_HELD_BY_SERVER) return { serverUrl: getBackendBase(), personalToken: null, signal };
  const token = accountToken();
  if (!token) throw new NoPersonalSession();
  return { serverUrl: getBackendBase(), personalToken: token, signal };
}

/** La famille de « Qui regarde ? » ; `atLaunch` y devient la règle de CET ordinateur
 *  (shared `familyPickerDevice.ts` : le cadre du serveur, puis le choix de l'appareil). */
export async function loadPickerProfiles(signal?: AbortSignal): Promise<PickerProfilesDto> {
  const listing = await fetchPickerProfiles(personalCall(signal), PICKER_PLATFORM);
  return withDeviceChoice(listing, readDeviceChoiceOnThisServer(accountUserId()));
}

export function pickProfile(profileId: string, pin: string | undefined, deviceName: string): Promise<PickedProfileDto> {
  return pickFamilyProfile(personalCall(), {
    platform: PICKER_PLATFORM,
    profileId,
    ...(pin !== undefined && { pin }),
    deviceName,
  });
}
