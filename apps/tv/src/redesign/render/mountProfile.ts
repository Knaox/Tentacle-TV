import { MOUNT_PROFILES, mountProfileOf, type MountProfile, type RenderTier } from "@tentacle-tv/tv-core";

/**
 * LE profil de montage de l'appareil (tv-core `render/mountProfile`) : ce que
 * les pages montent hors de l'écran — rangées, grille, épisodes. Il suit le
 * niveau de rendu, fixe pour la vie du JS : `normal` sur l'Apple TV (toujours)
 * et la Shield, `lite` sur une Android TV faible.
 *
 * Une vue ne lit pas le niveau elle-même (la refonte ne sort pas de
 * `redesign/`) : l'app le pose UNE fois, au chargement, avant le premier
 * rendu (`redesignWiring/render/mountTier`). Sans lui — le banc des vues —,
 * le montage d'avant, `normal`.
 */

let current: Readonly<MountProfile> = MOUNT_PROFILES.normal;

/** Pose le niveau de rendu de l'appareil — une fois, avant le premier rendu. */
export function setMountTier(tier: RenderTier): void {
  current = mountProfileOf(tier);
}

/** Le profil de montage en vigueur (constant pour la vie du JS). */
export function mountProfile(): Readonly<MountProfile> {
  return current;
}
