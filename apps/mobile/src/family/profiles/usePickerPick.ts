import { useCallback } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import { pickFamilyProfile, useTentacleConfig } from "@tentacle-tv/api-client";
import type { PickedProfileDto } from "@tentacle-tv/shared";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { personalToken } from "./profileSessionCore";
import { MOBILE_PICKER_PLATFORM } from "./usePickerListing";

/** Le nom de cet appareil, tel que le tableau de bord de Jellyfin le montrera. */
export function mobileDeviceName(): string {
  return Device.deviceName || Device.modelName || (Platform.OS === "android" ? "Android" : "iPhone");
}

/** Demander un profil au serveur, avec le jeton de la session PERSONNELLE (le serveur vérifie le PIN). */
export function usePickerPick(): (profileId: string, pin: string | undefined) => Promise<PickedProfileDto> {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  return useCallback(async (profileId, pin) => {
    const token = personalToken(storage);
    if (!serverUrl || !token) throw new Error("no personal session");
    return pickFamilyProfile(
      { serverUrl, personalToken: token },
      { platform: MOBILE_PICKER_PLATFORM, profileId, ...(pin !== undefined && { pin }), deviceName: mobileDeviceName() },
    );
  }, [storage, serverUrl]);
}
