/**
 * Palette sombre — reprise EXACTE du rendu actuel de l'app.
 *
 * Builder (et non constante) : il lit les exports partagés AU MOMENT de
 * l'appel, donc APRÈS `applyThemeOverride()` — le theming de marque admin
 * (hue violette personnalisée, surfaces, etc.) est automatiquement reflété.
 *
 * ┌─ INVARIANT — NE PAS CONTOURNER ────────────────────────────────────────┐
 * │ L'import DOIT viser `@tentacle-tv/shared/theme`, dont les objets sont  │
 * │ volontairement MUTABLES et réécrits en place par `applyThemeOverride`. │
 * │ Ne JAMAIS remplacer par `DEFAULT_COLOR_TOKENS` (./tokens/colors) ni    │
 * │ par une copie figée : le snapshot casserait silencieusement la         │
 * │ propagation du thème admin sur mobile ET sur TV, sans erreur de type   │
 * │ ni échec de test — la régression n'apparaîtrait que chez un            │
 * │ utilisateur ayant personnalisé sa marque.                              │
 * └────────────────────────────────────────────────────────────────────────┘
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
} from "@tentacle-tv/shared/theme";

import type { ThemePalette } from "./types";

export function buildDarkPalette(): ThemePalette {
  return {
    brand: { ...BRAND },
    surface: { ...SURFACE, s0Tint: "#070710" },
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
      strong: "rgba(255, 255, 255, 0.28)",
      shimmer: "rgba(255, 255, 255, 0.05)",
    },
    danger: {
      surface: "rgba(239, 68, 68, 0.1)",
      border: "rgba(239, 68, 68, 0.2)",
    },
    glass: {
      tint: "rgba(20, 20, 26, 0.6)",
      tintStrong: "rgba(10, 10, 18, 0.72)",
      panel: SURFACE.s1,
      backdrop: "rgba(0, 0, 0, 0.55)",
    },
    tabBar: "rgba(0, 0, 0, 0.92)",
    // Texte sur média : identique au clair (blanc + voile noir) — c'est déjà le
    // combo robuste historique du sombre, désormais partagé comme token.
    onMedia: {
      primary: "#FFFFFF",
      secondary: "rgba(255, 255, 255, 0.80)",
      shadow: "rgba(0, 0, 0, 0.7)",
    },
    // Ombres profondes (GlassSurface ne les applique pas en sombre → rendu dark
    // inchangé ; disponibles pour d'autres surfaces si besoin).
    shadow: {
      card: { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 8 },
      sheet: { shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 28, elevation: 12 },
    },
  };
}
