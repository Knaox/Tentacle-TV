import { packagingOfInstall, type SetupPackaging } from "@tentacle-tv/shared";
import { useServerUpdate } from "./serverUpdateApi";

/**
 * La livraison du serveur pour les pages d'administration qui n'ont pas
 * d'autre source (extensions, Services, guide des bandes-annonces) : lue sur
 * la réponse de la carte « Serveur Tentacle », déjà en cache sur la vue
 * d'ensemble. `null` tant qu'elle n'a pas répondu, face à un serveur d'avant,
 * ou pour qui n'est pas administrateur (`enabled: false`) : les aides d'avant.
 */
export function useServerPackaging({ enabled = true }: { enabled?: boolean } = {}): SetupPackaging | null {
  const { data } = useServerUpdate({ enabled });
  return packagingOfInstall(data?.install);
}
