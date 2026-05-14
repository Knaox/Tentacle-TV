/**
 * Theme mobile — exposition publique.
 *
 * Les modules `colors`, `typography`, `spacing` sont en back-compat avec les
 * 48+ écrans/composants existants (mêmes clés, valeurs alignées sur le nouveau
 * langage cinématographique).
 *
 * Le hub `tokens` (nouveaux composants UI) expose les tokens partagés bruts
 * (BRAND, SURFACE, CTA, etc.) ainsi que les helpers mobile-only (HAPTICS,
 * getFont, preset).
 */

export { colors } from "./colors";
export { typography } from "./typography";
export { spacing } from "./spacing";

export * from "./tokens";
export * as motion from "./motion";
export * as effects from "./effects";
