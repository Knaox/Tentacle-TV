import { createContext, useCallback, useContext } from "react";
import { useRouter } from "expo-router";
import type { SettingsPaneId } from "@tentacle-tv/shared";
import { PROFILE_PANE_ROUTES } from "./profilePanes";

/**
 * Fourni par la colonne de détail du profil TABLETTE : la ligne d'un volet
 * l'ouvre dans la colonne, sous sa rubrique. Absent (téléphone, écrans hors
 * profil), la même ligne pousse l'écran `/settings/*`.
 */
export const ProfilePaneContext = createContext<((id: SettingsPaneId) => void) | null>(null);

export function useOpenProfilePane(id: SettingsPaneId): () => void {
  const openInline = useContext(ProfilePaneContext);
  const router = useRouter();
  return useCallback(() => {
    if (openInline) openInline(id);
    else router.push(PROFILE_PANE_ROUTES[id]);
  }, [openInline, id, router]);
}
