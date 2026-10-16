import { useJellyfinClient, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { useOwnPhotoVersion } from "../lib/ownPhotoVersion";

/** Le nom du compte jumelé, lu dans `tentacle_user` (ou null). */
export function readPairedName(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { Name?: unknown; name?: unknown; username?: unknown };
    for (const candidate of [parsed.Name, parsed.name, parsed.username]) {
      if (typeof candidate === "string" && candidate.length > 0) return candidate;
    }
  } catch { /* illisible : pas de nom */ }
  return null;
}

/** La largeur demandée pour le portrait : le plus grand rond (réglages, 168 pt) au double. */
const PORTRAIT_SOURCE_PX = 340;

/**
 * Le compte jumelé tel que les réglages le montrent, sur les deux
 * téléviseurs : son nom, l'adresse de son portrait (Jellyfin, par le proxy du
 * serveur — il peut ne pas exister) et le serveur Tentacle. Une photo
 * choisie sur cette TV (galerie des avatars) change l'adresse du portrait
 * (`lib/ownPhotoVersion`) : le cache d'images ne rend plus l'ancien.
 *
 * UNE seule adresse par portrait, quelle que soit la taille du rond (la leçon
 * de « Qui regarde ? », `profilesModel`) : les réglages et le rail relisent la
 * même image. Avec une taille par écran, une photo tout juste choisie
 * paraissait dans le rail et pas dans les réglages (relevé du Testeur A,
 * 16/10, invitée dans sa session) : une lecture ratée sur l'une des deux
 * tailles laissait l'initiale.
 */
export function usePairedAccount() {
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  const userId = useUserId();
  const version = useOwnPhotoVersion(userId);
  const portraitUrl = userId
    ? `${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=${PORTRAIT_SOURCE_PX}&quality=90${version > 0 ? `&v=${version}` : ""}`
    : null;
  return {
    name: readPairedName(storage.getItem("tentacle_user")),
    serverUrl: storage.getItem("tentacle_server_url") || "—",
    portraitUrl,
  };
}
