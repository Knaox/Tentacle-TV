import { useEffect } from "react";
import { acquireSocket, configureSessionChannel, useJellyfinClient } from "@tentacle-tv/api-client";
import { useSessionDevHook } from "./useSessionDevHook";

/**
 * Le canal de session, côté mobile — comme le web et le bureau depuis 1.22.0.
 *
 * L'app s'annonce sur le socket Tentacle (`session:hello`, à chaque
 * authentification) avec l'identifiant d'appareil que Jellyfin lui connaît :
 * le tableau de bord relie ainsi la session Jellyfin à ce téléphone (« Suivi
 * Tentacle »). Dès lors, le serveur Tentacle porte la télémétrie de lecture
 * (les reports partent sur le socket déjà ouvert, `usePlaybackReporting`), il
 * arrête lui-même la lecture si l'app disparaît, et relaie la télécommande et
 * les messages de l'administrateur. Face à un serveur d'avant 1.19.0, rien ne
 * répond : les reports restent en HTTP, comme avant.
 *
 * Le socket est tenu tant qu'une session existe — pas seulement sur
 * l'accueil : un lecteur ouvert par un lien, une notification ou le démarrage
 * à froid doit lui aussi être joignable.
 */
export function SessionChannelSync({ token }: { token: string | null }) {
  const client = useJellyfinClient();

  useEffect(() => {
    // L'identifiant ADOPTÉ (celui de la session Jellyfin), relu à chaque hello.
    configureSessionChannel({ deviceId: () => client.getDeviceId() });
  }, [client]);

  useEffect(() => (token ? acquireSocket(token) : undefined), [token]);

  // Développement : le canal éprouvé depuis l'inspecteur (voir le crochet).
  useSessionDevHook();

  return null;
}
