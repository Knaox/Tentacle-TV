/**
 * Mode Hors ligne APPLICATIF (desktop uniquement) : vrai quand l'app doit
 * basculer sur le contenu local — hors ligne automatique OU manuel.
 * Sur le web, toujours false (l'overlay bloquant existant garde son rôle).
 */

import { useJellyfinOutage } from "@tentacle-tv/api-client";
import { supportsDownloads } from "../desktop/bridge";
import { useConnectivity } from "./useConnectivity";

export function useOfflineMode(): boolean {
  const { state } = useConnectivity();
  return supportsDownloads() && (state === "offline-auto" || state === "offline-manual");
}

/**
 * Le hors ligne vu par le LECTEUR : pendant une panne de Jellyfin dite par le
 * serveur, le hors ligne qu'elle provoque ne compte pas — sinon le plafond de
 * qualité tombait, l'URL passait du HLS au fichier, et mpv rechargeait en
 * pleine panne. Les deux hooks sont appelés à chaque rendu.
 */
export function usePlaybackOfflineMode(): boolean {
  const offline = useOfflineMode();
  const outage = useJellyfinOutage();
  return offline && outage.phase === "none";
}
