import { safeJoin } from "@tentacle-tv/offline-core";
import { offlineVolume } from "./volume";

/**
 * L'URI `file://` d'une ressource locale (`media/<id>/…`, `meta/<id>/…`),
 * après le contrôle de traversée du cœur. C'est ce que le lecteur vidéo,
 * `expo-image` et les lecteurs de side-cars consomment.
 */
export function localResourceUri(rel: string): string {
  return safeJoin(offlineVolume(), rel);
}
