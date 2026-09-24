import { useEffect } from "react";
import { acquireSocket, configureSessionChannel, useJellyfinClient } from "@tentacle-tv/api-client";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { useStoredToken } from "../hooks/useStoredToken";

/**
 * Le canal de session, côté téléviseur — comme le web, le bureau et le mobile.
 *
 * La TV s'annonce sur le socket Tentacle avec le NOM de son application
 * (« Tentacle TV - TV », « Apple TV », version) : jumelée, elle emprunte le
 * jeton d'un autre appareil du compte, et le backend présente pour elle
 * l'identifiant qu'il a dérivé — celui qu'elle a adopté (`DirectStreamingSync`).
 * Sa session Jellyfin devient pilotable : tableau de bord de Jellyfin, « Sessions
 * en direct » de Tentacle, messages de l'administrateur. Face à un serveur
 * d'avant le canal, rien ne répond et les reports restent en HTTP.
 *
 * Le socket est tenu tant qu'une session existe, pas seulement sur l'accueil :
 * un lecteur doit rester joignable où qu'on l'ait ouvert.
 */
export function TVSessionChannel({ storage }: { storage: StorageAdapter }) {
  const client = useJellyfinClient();
  const token = useStoredToken(storage);

  useEffect(() => {
    configureSessionChannel({
      deviceId: () => client.getDeviceId(),
      app: () => ({ client: client.getClientName(), device: client.getDeviceName(), version: client.getAppVersion() }),
    });
  }, [client]);

  useEffect(() => (token ? acquireSocket(token) : undefined), [token]);

  return null;
}
