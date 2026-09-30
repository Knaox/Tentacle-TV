import { useJellyfinClient, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";

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

/**
 * Le compte jumelé tel que les réglages le montrent, sur les deux
 * téléviseurs : son nom, l'adresse de son portrait (Jellyfin, par le proxy du
 * serveur — il peut ne pas exister) et le serveur Tentacle. `portraitSize` :
 * le diamètre affiché, en points (l'image est demandée au double).
 */
export function usePairedAccount(portraitSize = 132) {
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  const userId = useUserId();
  const portraitUrl = userId
    ? `${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=${portraitSize * 2}&quality=90`
    : null;
  return {
    name: readPairedName(storage.getItem("tentacle_user")),
    serverUrl: storage.getItem("tentacle_server_url") || "—",
    portraitUrl,
  };
}
