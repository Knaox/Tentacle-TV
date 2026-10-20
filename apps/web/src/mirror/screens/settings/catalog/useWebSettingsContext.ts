import { useMemo } from "react";
import { settingsAbilitiesOf, useAccountAbilities, useServerCapabilities } from "@tentacle-tv/api-client";
import { launchAskedByServer, type SettingsCatalogContext } from "@tentacle-tv/shared";
import { useActiveProfile } from "../../../../auth/profileSession";
import { getUserInfo } from "../../../../components/userMenu/menuItems";
import { useFamilySettingsAvailability } from "../../../../family/useFamilyAvailability";
import { useOfflineMode } from "../../../../offline/useOfflineMode";
import { usePickerListingQuery } from "../../../../profiles/api/usePickerListing";
import { useProfileSwitchOffered } from "../../../shell/useProfileSwitchOffered";

/**
 * Le contexte du web étroit pour le catalogue partagé des réglages : ce que
 * CE client sait faire et ce que le serveur déclare. Le navigateur n'a ni
 * lecteur natif, ni Liquid Glass, ni titres gardés hors ligne : ces
 * conditions valent `false` (et le catalogue réserve déjà ces entrées au
 * mobile). « Changer de profil » suit le menu de l'avatar
 * (`useProfileMenuItems`) : une famille d'au moins deux profils à choisir.
 * Les droits de la session (`account.abilities`) : la règle partagée
 * `settingsAbilitiesOf` — serveur d'avant, comportement d'avant ; pas encore
 * lus, rien. « Qui regarde ? » au démarrage : seulement si l'administration
 * le propose d'office dans le navigateur (`launchAskedByServer` : `launchAsk`,
 * sinon la politique d'avant) ; la famille pas encore lue, oui.
 */
export function useWebSettingsContext(): SettingsCatalogContext {
  const offline = useOfflineMode();
  const { isAdmin: legacyIsAdmin } = getUserInfo();
  const abilityState = useAccountAbilities();
  // L'état est un objet neuf à chaque rendu : la mémoire suit son genre et la réponse (stable) du serveur.
  const known = abilityState.kind === "known" ? abilityState.abilities : null;
  const { abilities, isAdmin } = useMemo(
    () => settingsAbilitiesOf(known ? { kind: "known", abilities: known } : { kind: abilityState.kind } as typeof abilityState, legacyIsAdmin),
    [abilityState.kind, known, legacyIsAdmin],
  );
  const { available: family } = useFamilySettingsAvailability();
  const { capabilities } = useServerCapabilities();
  const profileSession = useActiveProfile() !== null;
  const canSwitchProfile = useProfileSwitchOffered();
  const picker = usePickerListingQuery().listing.data;
  const launchAsked = picker ? launchAskedByServer(picker) : true;

  return useMemo(() => ({
    platform: "web",
    capabilities,
    offline,
    isAdmin,
    offlineVisible: false,
    canGoOffline: false,
    family,
    canSwitchProfile,
    launchAsked,
    liquidGlass: false,
    advancedEngine: false,
    engineOptions: false,
    liveTransfers: false,
    bootIntro: false,
    abilities,
    profileSession,
  }), [capabilities, offline, isAdmin, abilities, family, canSwitchProfile, launchAsked, profileSession]);
}
