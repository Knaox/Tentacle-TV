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
 * Défaut "dark" : sans choix explicite, l'app est SOMBRE.
 *
 * Elle l'était de fait — toute son identité visuelle est construite pour le
 * noir : verre, dégradés, affiches sur fond sombre, contrôles du lecteur posés
 * sur la vidéo. Le défaut était pourtant "auto", donc un système en apparence
 * claire ouvrait Tentacle dans un thème qui n'est pas celui pour lequel elle a
 * été dessinée, sans que personne ne l'ait demandé.
 *
 * "auto" reste CHOISISSABLE : qui veut suivre son système le dit, et son choix
 * est persisté. C'est le défaut qui change, pas les possibilités.
 *
 * ⚠️ Cette valeur est répliquée à deux endroits qui s'exécutent AVANT ce
 * module : le script d'amorçage de `apps/web/index.html` (avant le premier
 * paint) et le repli de `apps/web/src/theme/colorScheme.ts` quand le stockage
 * est illisible. Les trois doivent dire la même chose, sinon l'app change de
 * thème sous les yeux de l'utilisateur pendant son chargement.
 */
export function sanitizeThemeMode(value: string | null | undefined): ThemeMode {
  return (VALID_MODES as readonly string[]).includes(value ?? "")
    ? (value as ThemeMode)
    : "dark";
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
