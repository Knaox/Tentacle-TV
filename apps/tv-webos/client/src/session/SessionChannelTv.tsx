import { useEffect } from "react";
import { acquireSocket, useJellyfinClient, useStreamingConfig, useUserId } from "@tentacle-tv/api-client";
import { deviceToken, deviceToken2 } from "../bootstrap/fragmentToken";

/**
 * Le canal de session du téléviseur : son identité Jellyfin, et le socket qui
 * le porte.
 *
 * **L'identité.** Jumelé, le téléviseur emprunte le jeton Jellyfin d'un autre
 * appareil du compte ; le serveur présente donc pour lui un identifiant qu'il
 * DÉRIVE de son jeton de jumelage, et le lui donne dans `/api/config/streaming`
 * (`directStreaming.deviceId`, présent même flux direct coupé). Adopté, il
 * part dans l'en-tête de toutes nos requêtes : elles et le canal touchent la
 * MÊME session Jellyfin — celle que les tableaux de bord de Jellyfin et de
 * Tentacle pilotent. Sans lui, le téléviseur restait une session sans
 * télécommande. La requête est celle de la synchro du web (`AppBindings`),
 * même clé : aucune requête de plus.
 *
 * **Le socket.** Le canal vit sur le socket Tentacle, qui n'est tenu ailleurs
 * que par la garde de session (appareil jumelé) et l'accueil. On le tient tant
 * qu'une session existe : un lecteur doit rester joignable où qu'on l'ait
 * ouvert. Le nom de l'application, lui, est annoncé dès le démarrage
 * (`configureSessionChannel`, `main.tv.tsx`).
 *
 * Référence native : `TVSessionChannel` et `DirectStreamingSync` d'`apps/tv`.
 */
export function SessionChannelTv() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const token = userId ? deviceToken() || "__cookie__" : null;
  const { data } = useStreamingConfig(token);

  const derivedDeviceId = data?.deviceId;
  useEffect(() => {
    if (derivedDeviceId && derivedDeviceId !== client.getDeviceId()) client.adoptJellyfinDeviceId(derivedDeviceId);
  }, [client, derivedDeviceId]);

  // Un jeton d'appareil s'authentifie par message ; sans lui — navigateur de
  // développement, compte connecté par cookie —, le cookie fait foi.
  useEffect(() => (userId ? acquireSocket(deviceToken2() ?? undefined) : undefined), [userId]);

  return null;
}
