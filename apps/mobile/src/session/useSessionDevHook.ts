import { useEffect } from "react";
import { getChannelStatus, useJellyfinClient, type ChannelStatus } from "@tentacle-tv/api-client";

interface SessionDevHook {
  /** Le canal porte-t-il la télémétrie, la télécommande atteint-elle l'appareil ? */
  status: () => ChannelStatus;
  deviceId: () => string;
  /** Un appel Jellyfin avec l'identité de l'app (ex. `/Sessions?deviceId=…`). */
  jellyfin: (path: string, init?: RequestInit) => Promise<unknown>;
}

type DevGlobal = typeof globalThis & { __tentacleSession?: SessionDevHook };

/**
 * Le crochet de DÉVELOPPEMENT du canal de session : `globalThis.__tentacleSession`,
 * piloté depuis l'inspecteur Hermes (`scripts/dev-hook.mjs`). Un utilisateur
 * Jellyfin peut commander SES PROPRES sessions : on éprouve ainsi la chaîne
 * entière — Jellyfin → backend → canal → lecteur — avec le compte de test,
 * sans clé d'administration. Sous `__DEV__` seulement.
 */
export function useSessionDevHook(): void {
  const client = useJellyfinClient();
  useEffect(() => {
    if (!__DEV__) return;
    const scope = globalThis as DevGlobal;
    const hook: SessionDevHook = {
      status: getChannelStatus,
      deviceId: () => client.getDeviceId(),
      jellyfin: (path, init) => client.fetch(path, init),
    };
    scope.__tentacleSession = hook;
    return () => {
      if (scope.__tentacleSession === hook) delete scope.__tentacleSession;
    };
  }, [client]);
}
