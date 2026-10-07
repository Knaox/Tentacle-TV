import { mountProfileOf, type MountProfile } from "@tentacle-tv/tv-core";
import { DEVICE_TIER } from "./renderProfile";

/**
 * LE profil de montage de l'appareil (tv-core `render/mountProfile`) : ce que
 * les pages montent hors de l'écran — rangées, grille, épisodes. Il suit le
 * niveau de rendu de l'appareil, celui du profil de rendu (`DEVICE_TIER`,
 * une seule source), fixe pour la vie du JS : `normal` sur l'Apple TV
 * (toujours) et la Shield, `lite` sur une Android TV faible.
 */
export const MOUNT: Readonly<MountProfile> = mountProfileOf(DEVICE_TIER);

/** Le profil de montage en vigueur (constant pour la vie du JS). */
export function mountProfile(): Readonly<MountProfile> {
  return MOUNT;
}
