import { createContext, useCallback, useContext } from "react";
import { useRouter } from "expo-router";
import { PROFILE_PANE_ROUTES, type ProfilePaneId } from "./profilePanes";

interface PaneSelection {
  selected: ProfilePaneId;
  select: (id: ProfilePaneId) => void;
}

/**
 * Fourni par le profil TABLETTE seulement : la ligne d'un volet le pose
 * dans la colonne de détail. Absent (téléphone, écrans hors profil), la
 * même ligne pousse l'écran `/settings/*`.
 */
export const ProfilePaneContext = createContext<PaneSelection | null>(null);

export function useProfilePane(id: ProfilePaneId): { open: () => void; selected: boolean; inline: boolean } {
  const selection = useContext(ProfilePaneContext);
  const router = useRouter();
  const open = useCallback(() => {
    if (selection) selection.select(id);
    else router.push(PROFILE_PANE_ROUTES[id]);
  }, [selection, id, router]);
  return { open, selected: selection?.selected === id, inline: selection !== null };
}
