import { useMemo } from "react";
import { useAppConfig } from "@tentacle-tv/api-client";
import { isFamilyAvailable } from "@tentacle-tv/shared";
import { useStoredUser } from "@/auth/useStoredUser";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { useConnectivity } from "@/offline/useConnectivity";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useThemeMode } from "@/theme";
import type { ProfileContext } from "./profileStructure";

/**
 * L'écran de la Famille du mobile est-il branché ? Tant qu'il ne l'est pas,
 * l'entrée « Famille » de la rubrique Compte reste cachée, quel que soit le
 * serveur. Branché : `app/family.tsx` (`FamilyScreen`).
 */
export const FAMILY_SCREEN_READY = true;

/** Le contexte qui décide de ce que la structure du profil montre (`profileStructure.ts`). */
export function useProfileContext(): ProfileContext {
  const offline = useOfflineMode();
  // Réactif : une relecture du profil (droits) re-rend la structure.
  const isAdmin = useStoredUser()?.Policy?.IsAdministrator === true;
  const { state: connectivity } = useConnectivity();
  const { visible: offlineVisible } = useOfflineVisibility();
  const { liquidGlass } = useThemeMode();
  const { data: config } = useAppConfig();
  // La règle partagée du web : la capacité annoncée suffit. Des familles
  // coupées par l'administrateur laissent la page — on peut encore quitter,
  // retirer, supprimer un invité ou dissoudre.
  const familyOn = isFamilyAvailable(config?.features.family, offline);
  return useMemo(() => ({
    offline,
    isAdmin,
    offlineVisible,
    // « Passer hors ligne » : seulement quand le serveur répond.
    canGoOffline: connectivity === "online" && offlineVisible,
    family: FAMILY_SCREEN_READY && familyOn,
    liquidGlass: liquidGlass.supported,
  }), [offline, isAdmin, connectivity, offlineVisible, familyOn, liquidGlass.supported]);
}
