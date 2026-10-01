import type { JellyfinClient } from "@tentacle-tv/api-client";
import { resolveLogoImage, type MediaItem } from "@tentacle-tv/shared";

type ImageClient = Pick<JellyfinClient, "getImageUrl">;

/**
 * Le logo d'une bannière d'accueil — le bureau comme le miroir : celui que la
 * donnée ANNONCE (le sien, sinon celui de la série d'un épisode), adressé par
 * son tag. Jamais un logo demandé à l'aveugle : `null` → le titre écrit.
 */
export function heroLogoUrl(client: ImageClient, item: MediaItem): string | null {
  const logo = resolveLogoImage(item);
  return logo ? client.getImageUrl(logo.id, "Logo", { width: 500, quality: 90, tag: logo.tag }) : null;
}
