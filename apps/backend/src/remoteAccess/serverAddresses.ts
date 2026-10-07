import { getDirectStreamingConfig } from "../services/configStore";
import { publishedJellyfinPublicUrl, publishedPublicUrl } from "./exposure";
import type { ServerAddresses } from "./remoteAccessContract";
import { readRemoteAccessSettings } from "./remoteAccessSettings";

/**
 * Les adresses du serveur annoncées dans `GET /api/config` (champ additif).
 * Les adresses LOCALES ne sont données qu'à un client du réseau local :
 * Internet n'a pas à connaître le plan du domicile. Celles de Jellyfin ne
 * valent que si la lecture directe est allumée. Les PUBLIQUES, que si
 * l'accès depuis l'extérieur l'est (`exposure.ts`).
 */
export function serverAddresses(clientIsLocal: boolean): ServerAddresses {
  const direct = getDirectStreamingConfig();
  const jellyfin = (url: string | null) => (direct.enabled ? url : null);
  return {
    local: clientIsLocal
      ? { tentacle: readRemoteAccessSettings().localUrl, jellyfin: jellyfin(direct.privateUrl) }
      : { tentacle: null, jellyfin: null },
    public: { tentacle: publishedPublicUrl(), jellyfin: publishedJellyfinPublicUrl() },
  };
}
