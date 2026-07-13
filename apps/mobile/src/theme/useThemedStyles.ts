/**
 * Hook de consommation des styles thémés.
 *
 * RÈGLE D'USAGE (migration clair/sombre) :
 *  - Toute feuille contenant une couleur devient une FACTORY déclarée au
 *    NIVEAU MODULE (référence stable, jamais inline dans le composant) :
 *
 *      const makeStyles = (t: AppTheme) =>
 *        StyleSheet.create({ card: { backgroundColor: t.colors.surface.s1 } });
 *
 *      function MyView() {
 *        const st = useThemedStyles(makeStyles);
 *        ...
 *      }
 *
 *  - Les feuilles purement géométriques (flex, spacing, tailles) restent en
 *    `StyleSheet.create` statique classique.
 *
 * Cache module WeakMap⟨factory, WeakMap⟨thème, styles⟩⟩ : UN SEUL
 * `StyleSheet.create` par (factory, thème), partagé entre toutes les
 * instances — 100 cartes re-rendues au switch ne recréent la feuille
 * qu'une fois. Une factory inline casserait ce cache (référence instable).
 */

import { useContext } from "react";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

import { AppThemeContext } from "./appThemeContext";
import type { AppTheme } from "./palette.types";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export type ThemedStyleFactory<T> = (theme: AppTheme) => T;

const styleCache = new WeakMap<object, WeakMap<AppTheme, unknown>>();

export function useThemedStyles<T extends NamedStyles<T>>(
  factory: ThemedStyleFactory<T>,
): T {
  const theme = useContext(AppThemeContext);

  let byTheme = styleCache.get(factory);
  if (!byTheme) {
    byTheme = new WeakMap<AppTheme, unknown>();
    styleCache.set(factory, byTheme);
  }

  const cached = byTheme.get(theme);
  if (cached !== undefined) return cached as T;

  const created = factory(theme);
  byTheme.set(theme, created);
  return created;
}
