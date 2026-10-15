import type { ImageSourcePropType } from "react-native";
import { avatarImageUrl } from "@tentacle-tv/tv-core";

/**
 * D'où la galerie de la TV tire les images de la troupe : la vignette de la
 * grille (192 px) et le grand portrait du panneau (512 px), servis par le
 * serveur Tentacle (`/avatars/…`) — tout serveur qui déclare
 * `avatars.devicePhoto` les sert, interface web coupée comprise.
 */
export function avatarDisplaySources(serverUrl: string | null, id: string): { thumb: ImageSourcePropType; portrait: ImageSourcePropType } {
  const thumb = avatarImageUrl(serverUrl, id, "thumb");
  const portrait = avatarImageUrl(serverUrl, id, "full");
  return { thumb: thumb ? { uri: thumb } : {}, portrait: portrait ? { uri: portrait } : {} };
}
