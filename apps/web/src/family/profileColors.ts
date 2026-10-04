import { profileColorStops, type FamilyProfileColor } from "@tentacle-tv/shared";

/**
 * Le dégradé CSS d'un profil de la Famille : ses deux teintes viennent de
 * shared (`FAMILY_PROFILE_COLOR_STOPS`), les mêmes sur le mobile.
 */
export function profileGradient(color: FamilyProfileColor): string {
  const [from, to] = profileColorStops(color);
  return `linear-gradient(135deg, ${from}, ${to})`;
}
