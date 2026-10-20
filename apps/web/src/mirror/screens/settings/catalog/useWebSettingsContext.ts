import { useMemo } from "react";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import type { SettingsAbility, SettingsCatalogContext } from "@tentacle-tv/shared";
import { useActiveProfile } from "../../../../auth/profileSession";
import { getUserInfo } from "../../../../components/userMenu/menuItems";
import { useFamilySettingsAvailability } from "../../../../family/useFamilyAvailability";
import { useOfflineMode } from "../../../../offline/useOfflineMode";
import { useProfileSwitchOffered } from "../../../shell/useProfileSwitchOffered";

/**
 * Le contexte du web étroit pour le catalogue partagé des réglages : ce que
 * CE client sait faire et ce que le serveur déclare. Le navigateur n'a ni
 * lecteur natif, ni Liquid Glass, ni titres gardés hors ligne : ces
 * conditions valent `false` (et le catalogue réserve déjà ces entrées au
 * mobile). « Changer de profil » suit le menu de l'avatar
 * (`useProfileMenuItems`) : une famille d'au moins deux profils à choisir.
 */
/**
 * Ce que la session peut faire. En attendant la fusion de droits-mobile
 * (`useAccountAbilities` + `mayShow`, branche claude/droits-06ed6b), le web
 * donne les cinq : le comportement d'avant, rien de retiré.
 */
const ALL_ABILITIES: ReadonlySet<SettingsAbility> = new Set(["tickets", "manageAccount", "pairDevices", "push", "invites"]);

export function useWebSettingsContext(): SettingsCatalogContext {
  const offline = useOfflineMode();
  const { isAdmin } = getUserInfo();
  const { available: family } = useFamilySettingsAvailability();
  const { capabilities } = useServerCapabilities();
  const profileSession = useActiveProfile() !== null;
  const canSwitchProfile = useProfileSwitchOffered();

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
    liveTransfers: false,
    bootIntro: false,
    abilities: ALL_ABILITIES,
    profileSession,
  }), [capabilities, offline, isAdmin, family, canSwitchProfile, profileSession]);
}
