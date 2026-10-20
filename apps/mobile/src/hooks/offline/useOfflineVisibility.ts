import type { DownloadCapabilities } from "@tentacle-tv/offline-core";
import { mayShow, useAccountAbilities } from "@tentacle-tv/api-client";
import { useHasLocalContent } from "@/offline/useOfflineMode";
import { useOfflineCapabilities } from "./useOfflineCapabilities";

export interface OfflineVisibility {
  /** Faut-il montrer QUOI QUE CE SOIT du hors ligne (droit, ou déjà du contenu) ? */
  visible: boolean;
  canKeep: boolean;
  canLight: boolean;
  hasContent: boolean;
  capabilities: DownloadCapabilities;
}

/** Ce que les points d'entrée (fiche, épisode, profil, en-tête) consultent. Garder hors ligne
 *  exige le droit du compte (`EnableContentDownloading`) ET la session qui le permet (jamais une
 *  session de profil) : `account.abilities`, sinon les capacités de téléchargement comme avant. */
export function useOfflineVisibility(): OfflineVisibility {
  const { capabilities } = useOfflineCapabilities();
  const hasContent = useHasLocalContent() === true;
  const abilities = useAccountAbilities();
  const canKeep = capabilities.downloads && mayShow(abilities, "keepOffline");
  const canLight = canKeep && capabilities.lightDownloads;
  return { visible: canKeep || hasContent, canKeep, canLight, hasContent, capabilities };
}
