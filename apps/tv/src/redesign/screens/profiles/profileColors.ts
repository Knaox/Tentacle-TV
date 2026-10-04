import type { FamilyProfileColor } from "@tentacle-tv/shared";
import type { ArtworkPalette } from "../../color/artworkPalette";

/**
 * Les couleurs d'un profil de la Famille : le contrat n'en donne que les
 * NOMS (`FAMILY_PROFILE_COLORS`), chaque client les peint. Les mêmes teintes
 * que le web (`apps/web/src/family/profileColors.ts`) : un profil a sa
 * couleur partout. Deux teintes profondes en dégradé, sous une initiale
 * blanche — chaque paire tient 4,5:1 contre le blanc à son point le plus clair.
 */
export const PROFILE_COLOR_STOPS: Record<FamilyProfileColor, readonly [string, string]> = {
  violet: ["#6d28d9", "#7c3aed"],
  pink: ["#be185d", "#db2777"],
  blue: ["#1d4ed8", "#2563eb"],
  teal: ["#0f766e", "#0d9488"],
  green: ["#15803d", "#16a34a"],
  amber: ["#a16207", "#b45309"],
  orange: ["#c2410c", "#ea580c"],
  red: ["#b91c1c", "#dc2626"],
};

export function profileStops(color: FamilyProfileColor | null | undefined): readonly [string, string] {
  return (color && PROFILE_COLOR_STOPS[color]) || PROFILE_COLOR_STOPS.violet;
}

/** La lumière de « Qui regarde ? » : neutre, froide — aucune œuvre n'éclaire encore l'écran. */
export const PROFILES_PALETTE: ArtworkPalette = {
  glows: ["#3a3f5c", "#1d5566", "#34384f"],
  deep: "#0b0a0c",
};

/** La lumière du profil focalisé : sa couleur en touches, bornée par le fond (`boundedLight`). */
export function profilePalette(color: FamilyProfileColor): ArtworkPalette {
  const [from, to] = profileStops(color);
  return { glows: [to, "#1d5566", from], deep: "#0b0a0c" };
}
