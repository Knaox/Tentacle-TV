import type { RecoRowItem, useJellyfinClient } from "@tentacle-tv/api-client";
import type { AmbientTarget } from "../../contexts/AmbientFocusContext";
import { AmbientConfig } from "../../theme/colors";

type ImageClient = ReturnType<typeof useJellyfinClient>;

/**
 * Ce qu'une recommandation focalisée donne au fond ambiant : le backdrop
 * Jellyfin du titre (sur le téléviseur, seuls les titres en bibliothèque
 * s'affichent), à la largeur étroite du fond ; sans identifiant, rien — le
 * fond s'efface plutôt que de garder l'image du titre d'avant.
 */
export function recoAmbientTarget(item: RecoRowItem, client: ImageClient): AmbientTarget | null {
  if (!item.jellyfinItemId) return null;
  return {
    kind: "uri",
    id: item.key,
    uri: client.getImageUrl(item.jellyfinItemId, "Backdrop", { width: AmbientConfig.sourceWidth, quality: 60 }),
  };
}
