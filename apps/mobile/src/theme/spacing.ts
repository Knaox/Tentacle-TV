/**
 * Espacement mobile — back-compat. Préserve les 11 clés historiques (xs, sm,
 * md, lg, xl, xxl, xxxl, screenPadding, cardRadius, buttonRadius, badgeRadius)
 * consommées par ~32 fichiers, en les ré-exposant depuis les tokens partagés.
 */

import { LAYOUT, RADIUS, SPACING } from "@tentacle-tv/shared";

export const spacing = {
  xs: SPACING.xs,
  sm: SPACING.sm,
  md: SPACING.md,
  lg: SPACING.lg,
  xl: SPACING.xl,
  xxl: SPACING["2xl"],
  xxxl: SPACING["3xl"],
  screenPadding: LAYOUT.screenPadding,
  cardRadius: RADIUS.lg,
  buttonRadius: RADIUS.md,
  badgeRadius: RADIUS.sm,
} as const;
