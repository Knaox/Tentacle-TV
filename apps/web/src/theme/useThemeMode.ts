/**
 * Accès au mode d'apparence depuis React.
 *
 * `useSyncExternalStore` plutôt qu'un contexte : le schéma peut changer sans
 * action React (l'utilisateur bascule le thème de son OS pendant que l'app
 * tourne), et tous les abonnés doivent voir la même valeur au même render.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { ResolvedScheme, ThemeMode } from "@tentacle-tv/theme";

import { getMode, getScheme, setMode, subscribe } from "./colorScheme";

export interface ThemeModeValue {
  /** Choix de l'utilisateur, persisté. */
  mode: ThemeMode;
  /** Schéma effectif après résolution de `auto`. */
  scheme: ResolvedScheme;
  isDark: boolean;
  setMode: (next: ThemeMode) => void;
}

export function useThemeMode(): ThemeModeValue {
  const mode = useSyncExternalStore(subscribe, getMode, getMode);
  const scheme = useSyncExternalStore(subscribe, getScheme, getScheme);

  const update = useCallback((next: ThemeMode) => {
    setMode(next);
  }, []);

  return { mode, scheme, isDark: scheme === "dark", setMode: update };
}
