import { useEffect } from "react";
import {
  acquireSocket,
  useSessionRemoteTarget,
  useTentacleConfig,
  type SessionRemoteTarget,
} from "@tentacle-tv/api-client";

/**
 * Le lecteur mobile sous la télécommande de Jellyfin — son tableau de bord, ou
 * celui de Tentacle : pause, reprise, arrêt, saut, épisode voisin, pistes. La
 * traduction commande → geste est celle du web (`useSessionRemoteTarget`).
 *
 * Le lecteur tient aussi le socket tant qu'il est ouvert : c'est par lui que
 * passent ses reports et que la télécommande l'atteint, même ouvert sans
 * l'accueil derrière (lien, notification, démarrage à froid).
 */
export function usePlayerRemote(target: SessionRemoteTarget): void {
  const { storage } = useTentacleConfig();
  const token = storage.getItem("tentacle_token");
  useEffect(() => (token ? acquireSocket(token) : undefined), [token]);
  useSessionRemoteTarget(target);
}
