/**
 * Palette couleurs mobile — back-compat. Préserve les 18 clés historiques
 * consommées par ~48 écrans/composants, mais les VALEURS sont désormais
 * dérivées des tokens partagés `@tentacle-tv/shared/theme`.
 *
 * Conséquence visible immédiate :
 *  - `background`: `#0a0a0f` → `#000000` (pure black, Netflix-style)
 *  - `surface`: `#12121a` → `#0a0a0a` (s1)
 *  - `surfaceElevated`: `#1a1a2e` → `#141414` (s2)
 *  - `textSecondary`: 0.6 → 0.78 (lisibilité améliorée)
 *  - `glass`: tinté violet → noir translucide neutre (cohérence web)
 */

import { BORDER, BRAND, OVERLAY, STATUS, SURFACE, TEXT } from "@tentacle-tv/shared";

export const colors = {
  // Surfaces
  background: SURFACE.s0,
  surface: SURFACE.s1,
  surfaceElevated: SURFACE.s2,

  // Brand violet
  accent: BRAND.violet,
  accentHover: BRAND.dark,
  accentMuted: BRAND.soft,
  accentLight: BRAND.light,

  // Texte (hiérarchie alignée web)
  textPrimary: TEXT.primary,
  textSecondary: TEXT.secondary,
  textMuted: TEXT.tertiary,
  textDim: TEXT.quaternary,

  // Status
  danger: STATUS.error,
  dangerSurface: "rgba(239, 68, 68, 0.1)",
  dangerBorder: "rgba(239, 68, 68, 0.2)",
  success: STATUS.success,
  gold: STATUS.rating,

  // Bordures
  border: BORDER.subtle,
  borderAccent: BRAND.soft,

  // Glass (noir translucide neutre — pas de tint violet)
  glass: "rgba(20, 20, 26, 0.85)",
  glassLight: "rgba(20, 20, 26, 0.5)",

  // Overlay + tab bar
  overlay: OVERLAY.scrim,
  tabBar: "rgba(0, 0, 0, 0.92)",
} as const;
