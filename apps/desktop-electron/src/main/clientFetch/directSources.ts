/**
 * Une source de lecture qui porte un flux DIRECT (`direct`, requêtes déléguées) :
 * adoptée seulement si l'hôte du flux est dans les `mediaHosts` que l'extension
 * DÉCLARE (lus par le principal, `pluginManifests.ts`), en https ; mpv reçoit
 * alors l'adresse du relais local (`directRelay.ts`), dont le repli est l'`url`
 * du serveur. Sinon le flux direct est ignoré : la source du serveur joue, comme
 * avant. Les singletons du module servent aussi `ipc/clientFetch.ts`.
 */

import { DirectRelay } from "./directRelay";
import { allowedUrl } from "./pluginClientFetch";
import { PluginManifests, type ServerSession } from "./pluginManifests";

export const pluginManifests = new PluginManifests();
export const directRelay = new DirectRelay();

export interface DirectCapableSource {
  url: string;
  origin: "library" | "plugin";
  direct?: { url: string; expiresAt: number | null } | undefined;
}

/** `ext:<extension>:<identifiant>` → l'extension ; `null` pour la bibliothèque. */
export function pluginOfTrack(trackKey: string): string | null {
  return /^ext:([a-zA-Z0-9._-]{1,64}):/.exec(trackKey)?.[1] ?? null;
}

/**
 * La source à confier au moteur : `direct` retiré dans tous les cas ; `url`
 * remplacée par celle du relais local quand le flux direct est adopté (`adopted`).
 */
export async function adoptDirect<S extends DirectCapableSource>(
  source: S,
  trackKey: string,
  session: ServerSession | null,
  deps: { manifests: PluginManifests; relay: DirectRelay } = { manifests: pluginManifests, relay: directRelay },
): Promise<{ source: Omit<S, "direct">; adopted: boolean }> {
  const { direct, ...rest } = source;
  const pluginId = pluginOfTrack(trackKey);
  if (!direct || !session || source.origin !== "plugin" || pluginId === null) return { source: rest, adopted: false };
  const mediaHosts = await deps.manifests.mediaHosts(session, pluginId);
  if (!allowedUrl(direct.url, mediaHosts)) return { source: rest, adopted: false };
  if (direct.expiresAt !== null && direct.expiresAt <= Date.now() + 30_000) return { source: rest, adopted: false };
  const local = await deps.relay.adopt(direct.url, source.url, session.headers);
  return { source: { ...rest, url: local }, adopted: true };
}
