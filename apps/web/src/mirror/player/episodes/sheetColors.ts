/**
 * Les couleurs de la liste d'épisodes DANS le lecteur. La feuille est noire
 * (`PLAYER.bg`) quel que soit le thème : on fige donc les valeurs SOMBRES des
 * jetons de l'app (`fill.faint`, `text.quaternary`…) au lieu de suivre le
 * thème — en clair, un texte sombre sur cette feuille noire serait illisible.
 */
export const SHEET = {
  textPrimary: "#FFFFFF",
  textTertiary: "rgba(255, 255, 255, 0.55)",
  textQuaternary: "rgba(255, 255, 255, 0.34)",
  textDisabled: "rgba(255, 255, 255, 0.22)",
  fillFaint: "rgba(255, 255, 255, 0.03)",
  fillSubtle: "rgba(255, 255, 255, 0.05)",
  fillStrong: "rgba(255, 255, 255, 0.28)",
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  surface2: "#141414",
  accentSoft: "rgba(var(--brand-accent-rgb), 0.15)",
  accentGlow: "rgba(var(--brand-accent-rgb), 0.45)",
  accentText: "var(--brand-accent-light)",
} as const;
