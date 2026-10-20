import { useMemo } from "react";
import { useAppConfig, useServerCapabilities } from "@tentacle-tv/api-client";
import { isFamilyAvailable } from "@tentacle-tv/shared";
import { useStoredUser } from "@/auth/useStoredUser";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { useConnectivity } from "@/offline/useConnectivity";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useThemeMode } from "@/theme";
import { engineOptionsFor } from "@/components/settings/controls/EngineOptionsRows";
import { useCanSwitchProfileFlag, useIsProfileSession } from "./familyEntryHooks";
import { useLiveTransfersSetting } from "./offlineEntryHooks";
import { useBootSettings } from "./bootEntryHooks";
import { useSessionAbilities } from "./abilityEntryHooks";
import { playerSettingsContext } from "./playerSettingsContext";
import type { SettingsCatalogContext } from "@tentacle-tv/shared";

/**
 * L'écran de la Famille du mobile est-il branché ? Tant qu'il ne l'est pas,
 * l'entrée « Famille » de la rubrique Compte reste cachée, quel que soit le
 * serveur. Branché : `app/family.tsx` (`FamilyScreen`).
 */
export const FAMILY_SCREEN_READY = true;

/** Le contexte qui décide de ce que la structure du profil montre (`profileStructure.ts`). */
export function useProfileContext(): SettingsCatalogContext {
  const offline = useOfflineMode();
  // Réactif : une relecture du profil (droits) re-rend la structure.
  const legacyIsAdmin = useStoredUser()?.Policy?.IsAdministrator === true;
  const { abilities, isAdmin } = useSessionAbilities(legacyIsAdmin);
  const { state: connectivity } = useConnectivity();
  const { visible: offlineVisible } = useOfflineVisibility();
  const { liquidGlass } = useThemeMode();
  const { data: config } = useAppConfig();
  // La règle partagée du web : la capacité annoncée suffit. Des familles
  // coupées par l'administrateur laissent la page — on peut encore quitter,
  // retirer, supprimer un invité ou dissoudre.
  const familyOn = isFamilyAvailable(config?.features.family, offline);
  const canSwitchProfile = useCanSwitchProfileFlag();
  const profileSession = useIsProfileSession();
  const liveTransfers = useLiveTransfersSetting().available;
  const bootIntro = useBootSettings().available;
  const { capabilities } = useServerCapabilities();
  // La build et la plateforme ne changent pas pendant la vie de l'app.
  const player = useMemo(() => {
    const ctx = playerSettingsContext();
    return { advancedEngine: ctx.advancedEngine, engineOptions: engineOptionsFor(ctx).length > 0 };
  }, []);
  return useMemo(() => ({
    platform: "mobile",
    capabilities,
    abilities,
    offline,
    isAdmin,
    offlineVisible,
    // « Passer hors ligne » : seulement quand le serveur répond.
    canGoOffline: connectivity === "online" && offlineVisible,
    family: FAMILY_SCREEN_READY && familyOn,
    canSwitchProfile,
    liquidGlass: liquidGlass.supported,
    advancedEngine: player.advancedEngine,
    engineOptions: player.engineOptions,
    bootIntro,
    liveTransfers,
    profileSession,
  }), [offline, isAdmin, abilities, connectivity, offlineVisible, familyOn, canSwitchProfile, liquidGlass.supported, capabilities, player, bootIntro, liveTransfers, profileSession]);
}
