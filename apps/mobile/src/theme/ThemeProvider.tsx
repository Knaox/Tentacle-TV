import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import type { StorageAdapter } from "@tentacle-tv/api-client";

import {
  AppThemeContext,
  ThemePrefsContext,
  buildAppTheme,
  type ThemePrefsValue,
} from "./appThemeContext";
import type { AppTheme, ResolvedScheme, ThemeMode } from "./palette.types";
import {
  THEME_MODE_STORAGE_KEY,
  applyAppearance,
  getBootThemeMode,
} from "./themeMode";
import {
  LIQUID_GLASS_STORAGE_KEY,
  getBootLiquidGlassEnabled,
  isLiquidGlassAvailable,
} from "./liquidGlass";

interface ThemeProviderProps {
  /** RNStorageAdapter (cache synchrone) — persistance du mode d'apparence. */
  storage: StorageAdapter;
  children: ReactNode;
}

/**
 * Provider unique du theming mobile : l'APPARENCE (light/dark/auto).
 *
 * Le mode utilisateur (posé pré-mount par index.js via setBootThemeMode) →
 * `Appearance.setColorScheme` → `useColorScheme()` = scheme résolu →
 * `buildAppTheme(scheme)` construit un AppTheme immutable par render, consommé
 * via useTheme()/useThemedStyles.
 *
 * La MARQUE vient du code (`@tentacle-tv/shared`). Elle venait autrefois de
 * `/api/theme`, que l'administrateur pouvait surcharger — c'est par là que les
 * presets saisonniers décalaient les couleurs du mobile. Presets et surcharge
 * ont quitté le serveur (1.17, qui sert depuis un état constant) : le mobile
 * ne lit plus la route, et un serveur plus ancien resté sur un preset ne le
 * teinte plus.
 */
export function ThemeProvider({ storage, children }: ThemeProviderProps) {
  // ── Apparence : mode choisi + scheme système résolu ────────────────────────
  const [mode, setModeState] = useState<ThemeMode>(getBootThemeMode);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      storage.setItem(THEME_MODE_STORAGE_KEY, next);
    },
    [storage],
  );

  // Le scheme du thème dérive DU MODE (source de vérité), pas seulement de
  // useColorScheme() : "light"/"dark" forcent le rendu quel que soit le système,
  // "auto" suit le système. Dépendre de useColorScheme() seul (piloté par
  // Appearance.setColorScheme) était fragile — l'override posé très tôt dans
  // index.js ne se propage pas toujours au hook, et le mode forcé était ignoré.
  const systemScheme = useColorScheme();
  const scheme: ResolvedScheme =
    mode === "light" ? "light"
      : mode === "dark" ? "dark"
        : systemScheme === "light" ? "light" : "dark";

  // Répercute le mode au niveau OS pour que les éléments NATIFS (Alert, clavier,
  // menus contextuels) suivent aussi — au mount et à chaque changement de mode.
  useEffect(() => {
    applyAppearance(mode);
  }, [mode]);

  // ── Liquid Glass : support natif (constant au runtime) + préférence ────────
  const liquidSupported = isLiquidGlassAvailable();
  const [liquidEnabled, setLiquidEnabledState] = useState<boolean>(getBootLiquidGlassEnabled);

  const setLiquidEnabled = useCallback(
    (enabled: boolean) => {
      setLiquidEnabledState(enabled);
      storage.setItem(LIQUID_GLASS_STORAGE_KEY, String(enabled));
    },
    [storage],
  );

  // ── AppTheme résolu ───────────────────────────────────────────────────────
  const appTheme = useMemo<AppTheme>(() => buildAppTheme(scheme), [scheme]);

  // ── Valeurs de contexte ───────────────────────────────────────────────────
  const prefsValue = useMemo<ThemePrefsValue>(
    () => ({
      mode,
      setMode,
      liquidGlass: {
        supported: liquidSupported,
        // `enabled` n'a d'effet que si le module natif est supporté.
        enabled: liquidSupported && liquidEnabled,
        setEnabled: setLiquidEnabled,
      },
    }),
    [mode, setMode, liquidSupported, liquidEnabled, setLiquidEnabled],
  );

  return (
    <ThemePrefsContext.Provider value={prefsValue}>
      <AppThemeContext.Provider value={appTheme}>
        {children}
      </AppThemeContext.Provider>
    </ThemePrefsContext.Provider>
  );
}
