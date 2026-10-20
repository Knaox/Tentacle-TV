import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { webPaneRoute, type WebPaneId } from "../settings/catalog/webCatalog";

interface PaneSelection {
  /** Le volet ouvert dans la colonne de détail ; `null` : la page de la rubrique. */
  selected: WebPaneId | null;
  select: (id: WebPaneId) => void;
}

/**
 * `ProfilePaneContext` de l'app. Fourni par le profil TABLETTE seulement : la
 * ligne d'un volet le pose dans la colonne de détail. Absent (téléphone), la
 * même ligne ouvre l'écran `/settings/*`.
 */
export const ProfilePaneContext = createContext<PaneSelection | null>(null);

export function useProfilePane(id: WebPaneId): { open: () => void; selected: boolean; inline: boolean } {
  const selection = useContext(ProfilePaneContext);
  const navigate = useNavigate();
  const open = useCallback(() => {
    if (selection) selection.select(id);
    else navigate(webPaneRoute(id));
  }, [selection, id, navigate]);
  return { open, selected: selection?.selected === id, inline: selection !== null };
}
