/**
 * Types du système d'apparence mobile.
 *
 * `ThemeMode`, `ResolvedScheme`, `ThemePalette` et `ShadowStyle` ont été
 * REMONTÉS dans `@tentacle-tv/theme` (`src/schemes/types.ts`) — le web et le
 * desktop consomment désormais les mêmes schémas clair/sombre. Ce fichier les
 * ré-exporte pour que les imports existants continuent de fonctionner.
 *
 * `AppTheme` reste ici : il porte des dérivés spécifiquement mobile
 * (`statusBarStyle` pour expo-status-bar, `blurTint` pour expo-blur).
 */

export type {
  ResolvedScheme,
  ShadowStyle,
  ThemeMode,
  ThemePalette,
} from "@tentacle-tv/theme";

import type { ResolvedScheme, ThemePalette } from "@tentacle-tv/theme";

export interface AppTheme {
  scheme: ResolvedScheme;
  isDark: boolean;
  colors: ThemePalette;
  /** Pour expo-status-bar : "light" en sombre, "dark" en clair. */
  statusBarStyle: "light" | "dark";
  /** Tint expo-blur aligné sur le scheme. */
  blurTint: ResolvedScheme;
}
