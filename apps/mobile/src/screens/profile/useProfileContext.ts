import { useMemo } from "react";
import { useAppConfig } from "@tentacle-tv/api-client";
import { useStoredUser } from "@/auth/useStoredUser";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { useConnectivity } from "@/offline/useConnectivity";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useThemeMode } from "@/theme";
import type { ProfileContext } from "./profileStructure";

/**
 * L'écran de la Famille du mobile est-il branché ? Tant qu'il ne l'est pas,
 * l'entrée « Famille » de la rubrique Compte reste cachée, quel que soit le
 * serveur. Celui qui branche l'écran (`/family`) passe ce drapeau à vrai.
 */
export const FAMILY_SCREEN_READY = false;

/** Le contexte qui décide de ce que la structure du profil montre (`profileStructure.ts`). */
export function useProfileContext(): ProfileContext {
  const offline = useOfflineMode();
  // Réactif : une relecture du profil (droits) re-rend la structure.
  const isAdmin = useStoredUser()?.Policy?.IsAdministrator === true;
  const { state: connectivity } = useConnectivity();
  const { visible: offlineVisible } = useOfflineVisibility();
  const { liquidGlass } = useThemeMode();
  const { data: config } = useAppConfig();
  const familyOn = config?.features.family?.enabled === true;
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
