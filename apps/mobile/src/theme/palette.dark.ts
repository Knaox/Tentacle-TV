/**
 * Palette sombre — reprise EXACTE du rendu actuel de l'app.
 *
 * Builder (et non constante) : il lit les exports partagés AU MOMENT de
 * l'appel, donc APRÈS `applyThemeOverride()` — le theming de marque admin
 * (hue violette personnalisée, surfaces, etc.) est automatiquement reflété.
 *
 * Les slots additionnels (fill/danger/glass/tabBar) reprennent à l'identique
 * les littéraux historiques du code (audit couleurs) : rendu dark pixel-perfect.
 */

import {
  BORDER,
  BRAND,
  CTA,
  OVERLAY,
  STATUS,
  STATUS_PAIRS,
  SURFACE,
  TEXT,
} from "@tentacle-tv/shared";

import type { ThemePalette } from "./palette.types";

export function buildDarkPalette(): ThemePalette {
  return {
    brand: { ...BRAND },
    surface: { ...SURFACE },
    text: { ...TEXT },
    status: { ...STATUS },
    statusPairs: {
      success: { ...STATUS_PAIRS.success },
      warning: { ...STATUS_PAIRS.warning },
      error: { ...STATUS_PAIRS.error },
      info: { ...STATUS_PAIRS.info },
    },
    border: { ...BORDER },
    cta: { ...CTA },
    overlay: { ...OVERLAY },
    fill: {
      faint: "rgba(255, 255, 255, 0.03)",
      subtle: "rgba(255, 255, 255, 0.05)",
      soft: "rgba(255, 255, 255, 0.08)",
      medium: "rgba(255, 255, 255, 0.12)",
    },
    danger: {
      surface: "rgba(239, 68, 68, 0.1)",
      border: "rgba(239, 68, 68, 0.2)",
    },
    glass: {
      tint: "rgba(20, 20, 26, 0.6)",
      tintStrong: "rgba(10, 10, 18, 0.72)",
      panel: SURFACE.s1,
    },
    tabBar: "rgba(0, 0, 0, 0.92)",
  };
}
