/**
 * Palette claire — conçue en miroir de la sombre (validation visuelle
 * itérable dans ce seul fichier).
 *
 * Principes :
 *  - Les accents dérivent des hues de MARQUE actives (post override admin) :
 *    l'accent lisible sur fond clair est `BRAND.dark`, les alphas sont
 *    recalculés via `withAlpha` — une marque personnalisée suit donc en light.
 *  - Surfaces/textes/bordures sont des constantes locales claires.
 *  - Les scrims d'overlay restent sombres (standard iOS : un voile sombre
 *    au-dessus de contenus photo/vidéo, quel que soit le thème).
 *  - Status assombris pour tenir le contraste AA sur fond clair.
 */

import { BRAND } from "@tentacle-tv/shared";

import { darken, withAlpha } from "./colorUtils";
import type { ThemePalette } from "./palette.types";

export function buildLightPalette(): ThemePalette {
  // Hue de marque lisible sur clair : la nuance foncée devient l'accent.
  const accent = BRAND.dark;
  const accentSoft = BRAND.violet;
  const accentStrong = darken(BRAND.dark, 0.18, "#6524C2");

  return {
    brand: {
      violet: accent,
      light: accentSoft,
      dark: accentStrong,
      glow: withAlpha(accent, 0.25, "rgba(124, 58, 237, 0.25)"),
      soft: withAlpha(accent, 0.1, "rgba(124, 58, 237, 0.10)"),
      ghost: withAlpha(accent, 0.14, "rgba(124, 58, 237, 0.14)"),
    },
    surface: {
      // Fond racine légèrement teinté : le verre et les cartes blanches s'y détachent.
      s0: "#F4F4F7",
      s1: "#FFFFFF",
      s2: "#ECECF1",
      s3: "#E2E2E8",
      overlay: "rgba(0, 0, 0, 0.4)",
      s0Tint: "#EFEFF4",
    },
    text: {
      primary: "#0B0B10",
      secondary: "rgba(11, 11, 16, 0.72)",
      tertiary: "rgba(11, 11, 16, 0.55)",
      quaternary: "rgba(11, 11, 16, 0.36)",
      disabled: "rgba(11, 11, 16, 0.24)",
    },
    status: {
      success: "#059669",
      warning: "#B45309",
      error: "#DC2626",
      info: "#2563EB",
      rating: "#D97706",
    },
    statusPairs: {
      success: { bg: "rgba(5, 150, 105, 0.12)", fg: "#047857" },
      warning: { bg: "rgba(180, 83, 9, 0.12)", fg: "#B45309" },
      error: { bg: "rgba(220, 38, 38, 0.12)", fg: "#B91C1C" },
      info: { bg: "rgba(37, 99, 235, 0.12)", fg: "#1D4ED8" },
    },
    border: {
      subtle: "rgba(0, 0, 0, 0.08)",
      strong: "rgba(0, 0, 0, 0.16)",
      focus: accent,
    },
    cta: {
      // CTA principal en clair : bouton BLANC + fin contour sombre + ombre douce
      // (via shadow.card côté composant) + texte/icône NOIR. Sobre, minimal et
      // classe — ni aplat violet, ni slab noir. Les petits badges (tag CONTINUER,
      // pastille « vu ») réutilisent primaryBg/Fg : pastille blanche + coche/texte
      // noir (sans contour).
      primaryBg: "#FFFFFF",
      primaryBgHover: "#F1F1F5",
      primaryFg: "#111114",
      primaryBorder: "rgba(0, 0, 0, 0.14)",
      secondaryBg: "rgba(120, 120, 128, 0.16)",
      secondaryBgHover: "rgba(120, 120, 128, 0.28)",
      secondaryFg: "#0B0B10",
      ghostBg: "rgba(0, 0, 0, 0.05)",
      ghostBgHover: "rgba(0, 0, 0, 0.1)",
      ghostFg: "#0B0B10",
      brandBg: accent,
      brandBgHover: accentStrong,
      brandFg: "#FFFFFF",
    },
    overlay: {
      scrim: "rgba(0, 0, 0, 0.4)",
      scrimSoft: "rgba(0, 0, 0, 0.25)",
      scrimHeavy: "rgba(0, 0, 0, 0.55)",
    },
    fill: {
      faint: "rgba(0, 0, 0, 0.03)",
      subtle: "rgba(0, 0, 0, 0.04)",
      soft: "rgba(0, 0, 0, 0.06)",
      medium: "rgba(0, 0, 0, 0.1)",
      strong: "rgba(0, 0, 0, 0.22)",
      // Le reflet du shimmer reste un éclat clair, plus marqué sur fond clair.
      shimmer: "rgba(255, 255, 255, 0.45)",
    },
    danger: {
      surface: "rgba(220, 38, 38, 0.08)",
      border: "rgba(220, 38, 38, 0.18)",
    },
    glass: {
      // Verre nacré plus opaque qu'avant : sur fond #F4F4F7, un voile trop
      // translucide rendait les cartes plates. Couplé à shadow.card (élévation).
      tint: "rgba(255, 255, 255, 0.72)",
      tintStrong: "rgba(255, 255, 255, 0.82)",
      panel: "#FFFFFF",
      // Les fonds de modale restent un voile sombre, plus léger qu'en dark.
      backdrop: "rgba(0, 0, 0, 0.3)",
    },
    tabBar: "rgba(255, 255, 255, 0.92)",
    onMedia: {
      primary: "#FFFFFF",
      secondary: "rgba(255, 255, 255, 0.80)",
      shadow: "rgba(0, 0, 0, 0.7)",
    },
    shadow: {
      card: { shadowColor: "#0B0B10", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 3 },
      sheet: { shadowColor: "#0B0B10", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 28, elevation: 8 },
    },
  };
}
