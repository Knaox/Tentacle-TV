import type { CSSProperties } from "react";

/**
 * Les couleurs du lecteur de l'app (`theme/playerColors.ts`) — un habillage
 * SOMBRE FIXE, quel que soit le thème : comme le lecteur web, les contrôles
 * restent lisibles sur la vidéo. Seuls les accents suivent la MARQUE (thème de
 * l'admin), par les variables CSS du web au lieu des getters `BRAND` de l'app.
 */
export const PLAYER = {
  bg: "#000000",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textTertiary: "rgba(255, 255, 255, 0.5)",
  textDim: "rgba(255, 255, 255, 0.35)",
  textInverse: "#000000",
  controlBg: "rgba(0, 0, 0, 0.6)",
  controlBgHeavy: "rgba(0, 0, 0, 0.9)",
  scrim: "rgba(0, 0, 0, 0.45)",
  scrimStrong: "rgba(0, 0, 0, 0.72)",
  border: "rgba(255, 255, 255, 0.2)",
  borderSubtle: "rgba(255, 255, 255, 0.1)",
  fillSubtle: "rgba(255, 255, 255, 0.05)",
  fillSoft: "rgba(255, 255, 255, 0.08)",
  warning: "#FCD34D",
  warningSoft: "rgba(245, 158, 11, 0.2)",
  accent: "var(--brand)",
  accentLight: "var(--brand-light)",
  accentSoft: "var(--brand-soft)",
  /** Le rose — bout des dégradés de marque (barre de lecture, halo). */
  accentRose: "var(--brand-accent)",
  /** Violet clair des pastilles (HDR/DV/Atmos, langue de piste). */
  accentChip: "#C4B5FD",
} as const;

/** Une zone tactile agrandie sans bouger la mise en page — le `hitSlop` natif. */
export function hitSlop(px: number): CSSProperties {
  return { position: "absolute", inset: -px };
}
