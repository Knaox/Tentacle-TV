/**
 * Octave (mobile) — l'apparence d'Octave rapportée au thème de Tentacle, règle PURE
 * (`octaveThemeChoice.test.ts`) : « Comme Tentacle » ne change rien ; « Clair » et « Sombre » imposent leur
 * schéma au mode musique seulement. Le Liquid Glass d'Octave ne s'allume que là où le verre natif existe.
 */

import type { OctaveTheme } from "@tentacle-tv/shared/octave";

/** Le schéma imposé à Octave ; null : celui de Tentacle. */
export function octaveSchemeOf(theme: OctaveTheme): "light" | "dark" | null {
  return theme === "same" ? null : theme;
}

export function octaveGlassEnabled(supported: boolean, octaveGlass: boolean): boolean {
  return supported && octaveGlass;
}
