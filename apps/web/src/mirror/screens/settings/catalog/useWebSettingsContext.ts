import { useMemo } from "react";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import type { SettingsCatalogContext } from "@tentacle-tv/shared";
import { useActiveProfile } from "../../../../auth/profileSession";
import { getUserInfo } from "../../../../components/userMenu/menuItems";
import { useFamilySettingsAvailability } from "../../../../family/useFamilyAvailability";
import { useOfflineMode } from "../../../../offline/useOfflineMode";
import { usePickerListing } from "../../../../profiles/api/usePickerListing";

/**
 * Le contexte du web étroit pour le catalogue partagé des réglages : ce que
 * CE client sait faire et ce que le serveur déclare. Le navigateur n'a ni
 * lecteur natif, ni Liquid Glass, ni titres gardés hors ligne : ces
 * conditions valent `false` (et le catalogue réserve déjà ces entrées au
 * mobile). « Changer de profil » suit le menu de l'avatar
 * (`useProfileMenuItems`) : une famille d'au moins deux profils à choisir.
 */
export function useWebSettingsContext(): SettingsCatalogContext {
  const offline = useOfflineMode();
  const { isAdmin } = getUserInfo();
  const { available: family } = useFamilySettingsAvailability();
  const { capabilities } = useServerCapabilities();
  const profileSession = useActiveProfile() !== null;
  const { listing, enabled } = usePickerListing();
  const canSwitchProfile = enabled && listing.data?.pickerRequired === true && listing.data.profiles.length >= 2;

  return useMemo(() => ({
    platform: "web",
    capabilities,
    offline,
    isAdmin,
    offlineVisible: false,
    canGoOffline: false,
    family,
    canSwitchProfile,
    liquidGlass: false,
    advancedEngine: false,
    engineOptions: false,
    profileSession,
  }), [capabilities, offline, isAdmin, family, canSwitchProfile, profileSession]);
}
