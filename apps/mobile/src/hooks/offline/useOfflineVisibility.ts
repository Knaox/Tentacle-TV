import { offlineSurfaceOf, type DownloadCapabilities } from "@tentacle-tv/offline-core";
import { useHasLocalContent } from "@/offline/useOfflineMode";
import { useAccountKeepRight, useOfflineProfileSession } from "@/offline/rights/useOfflineOwner";
import { useOfflineCapabilities } from "./useOfflineCapabilities";

export interface OfflineVisibility {
  /** Faut-il montrer QUOI QUE CE SOIT du hors ligne (droit, ou déjà du contenu) ? */
  visible: boolean;
  canKeep: boolean;
  canLight: boolean;
  hasContent: boolean;
  capabilities: DownloadCapabilities;
}

/** Ce que les points d'entrée (fiche, épisode, profil, en-tête) consultent. Le hors ligne
 *  appartient au COMPTE de l'appareil (`offline-core` › `offlineSurfaceOf`) : rien pendant une
 *  session de profil (membre ou invité), rien pour un compte à qui le serveur refuse
 *  `keepOffline` (dernier mot retenu hors ligne) ; serveur d'avant : les capacités, comme avant. */
export function useOfflineVisibility(): OfflineVisibility {
  const { capabilities } = useOfflineCapabilities();
  const hasContent = useHasLocalContent() === true;
  const surface = offlineSurfaceOf({
    profileSession: useOfflineProfileSession(),
    keepRight: useAccountKeepRight(),
    engineCanKeep: capabilities.downloads,
    hasContent,
  });
  const canLight = surface.canKeep && capabilities.lightDownloads;
  return { visible: surface.visible, canKeep: surface.canKeep, canLight, hasContent: surface.visible && hasContent, capabilities };
}
