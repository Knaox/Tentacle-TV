/**
 * Schémas d'apparence clair/sombre — source de vérité unique pour web,
 * desktop et mobile.
 *
 * Les deux builders lisent les exports MUTABLES de `@tentacle-tv/shared/theme`
 * au moment de l'appel, donc après `applyThemeOverride()` : le thème de marque
 * admin est reflété sans code supplémentaire. Voir l'INVARIANT dans `./dark.ts`.
 */

export type {
  ResolvedScheme,
  ShadowStyle,
  ThemeMode,
  ThemePalette,
} from "./types";

export { buildDarkPalette } from "./dark";
export { buildLightPalette } from "./light";

import { buildDarkPalette } from "./dark";
import { buildLightPalette } from "./light";
import type { ResolvedScheme, ThemeMode, ThemePalette } from "./types";

const VALID_MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

/** Construit la palette du schéma résolu. */
export function buildPalette(scheme: ResolvedScheme): ThemePalette {
  return scheme === "light" ? buildLightPalette() : buildDarkPalette();
}

/**
 * Défaut "auto" : sans choix explicite, l'app suit le réglage d'apparence du
 * système. Clair/Sombre restent forçables ; un choix explicite est persisté
 * et prime. Partagé avec le boot pré-mount de `apps/mobile`.
 */
export function sanitizeThemeMode(value: string | null | undefined): ThemeMode {
  return (VALID_MODES as readonly string[]).includes(value ?? "")
    ? (value as ThemeMode)
    : "auto";
}

/** Résout le mode utilisateur en schéma effectif, `auto` suivant le système. */
export function resolveScheme(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): ResolvedScheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}
