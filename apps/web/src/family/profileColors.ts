import type { FamilyProfileColor } from "@tentacle-tv/shared";

/**
 * Les couleurs d'un profil de la Famille : le contrat n'en donne que les
 * NOMS (`FAMILY_PROFILE_COLORS`), chaque client les peint. Deux teintes
 * profondes par couleur, en dégradé, sous une initiale blanche — chaque paire
 * tient 4,5:1 contre le blanc à son point le plus clair.
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

export function profileGradient(color: FamilyProfileColor): string {
  const [from, to] = PROFILE_COLOR_STOPS[color] ?? PROFILE_COLOR_STOPS.violet;
  return `linear-gradient(135deg, ${from}, ${to})`;
}
