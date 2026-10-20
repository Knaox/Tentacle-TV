import { useQuery } from "@tanstack/react-query";
import { fetchPickerProfiles, useAppConfig, useServerCapability, useTentacleConfig } from "@tentacle-tv/api-client";
import { mobileProfilesEnabled, type PickerProfilesDto } from "@tentacle-tv/shared";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { personalToken, useAccountUserId } from "./profileSessionState";

export const MOBILE_PICKER_PLATFORM = "mobile" as const;

/** Sous `["family"]` : `family:update` (`useFamilyLive`) la relit avec le reste. */
export function pickerListingKey(serverUrl: string | null, accountId: string | null) {
  return ["family", "picker", MOBILE_PICKER_PLATFORM, serverUrl ?? "none", accountId ?? "none"] as const;
}

/**
 * La famille de « Qui regarde ? » sur ce mobile, lue avec le jeton de la
 * session PERSONNELLE (le serveur refuse ces routes à une session de profil).
 * Rien ne part sans la capacité `family.mobileProfiles` — un serveur qui ne la
 * déclare pas n'a pas la plateforme `mobile` —, hors ligne, ou sans Famille.
 */
export function usePickerListing() {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const { data: config } = useAppConfig();
  const capable = useServerCapability("family.mobileProfiles");
  const offline = useOfflineMode();
  const accountId = useAccountUserId();
  const token = personalToken(storage);
  const enabled = !!serverUrl && mobileProfilesEnabled({ capable, family: config?.features.family, offline, hasAccountSession: !!token });
  const query = useQuery<PickerProfilesDto>({
    queryKey: pickerListingKey(serverUrl, accountId),
    queryFn: ({ signal }) => fetchPickerProfiles({ serverUrl: serverUrl!, personalToken: token!, signal }, MOBILE_PICKER_PLATFORM),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
  return { ...query, enabled, capable };
}
