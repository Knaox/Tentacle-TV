import { REMUX_PRESET, type DownloadCapabilities } from "@tentacle-tv/offline-core";
import { useHasLocalContent } from "@/offline/useOfflineMode";
import { useOfflineCapabilities } from "./useOfflineCapabilities";

export interface OfflineVisibility {
  /** Faut-il montrer QUOI QUE CE SOIT du hors ligne (droit, ou déjà du contenu) ? */
  visible: boolean;
  canKeep: boolean;
  canLight: boolean;
  /** Le serveur propose la « qualité d'origine (MP4) ». */
  canRemux: boolean;
  hasContent: boolean;
  capabilities: DownloadCapabilities;
}

/** Ce que les points d'entrée (fiche, épisode, profil, en-tête) consultent. */
export function useOfflineVisibility(): OfflineVisibility {
  const { capabilities } = useOfflineCapabilities();
  const hasContent = useHasLocalContent() === true;
  const canKeep = capabilities.downloads;
  const canLight = canKeep && capabilities.lightDownloads;
  // Le remux a son propre droit : il recopie l'image, il ne la convertit pas.
  const canRemux = canKeep && capabilities.remuxDownloads && capabilities.lightPresets.includes(REMUX_PRESET);
  return { visible: canKeep || hasContent, canKeep, canLight, canRemux, hasContent, capabilities };
}
