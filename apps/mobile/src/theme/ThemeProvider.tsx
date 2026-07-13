import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_THEME, mergeTheme, type Theme } from "@tentacle-tv/theme";
import { applyThemeOverride } from "@tentacle-tv/shared";
import type { StorageAdapter } from "@tentacle-tv/api-client";

import { fetchThemeState } from "./themeApi";
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

/**
 * Key under which the latest token override is mirrored in AsyncStorage.
 * Read synchronously at next cold start by `index.js` BEFORE any screen module
 * is imported, so module-level `StyleSheet.create({color: BRAND.violet})` calls
 * capture the *admin-configured* tokens instead of the static defaults. Without
 * this hand-off, non-migrated StyleSheets would show the boot-time snapshot of
 * colors regardless of theme fetch result (RN StyleSheet is frozen after
 * creation). Files migrated to `useThemedStyles` re-render live and don't need
 * this — the mirror remains for the first frame and the migration tail.
 */
const THEME_TOKENS_STORAGE_KEY = "tentacle_theme_tokens";

// ─── Thème de MARQUE (admin, backend /api/theme) — API historique ───────────

export interface BrandThemeContextValue {
  theme: Theme;
  isLoading: boolean;
  /** Invalidate the cached `/api/theme` query so it re-fetches on next render. */
  refresh: () => void;
}

const BrandThemeContext = createContext<BrandThemeContextValue>({
  theme: DEFAULT_THEME,
  isLoading: false,
  refresh: () => {},
});

/** Thème de marque backend (tokens admin bruts) — rarement utile côté écrans. */
export function useBrandTheme(): BrandThemeContextValue {
  return useContext(BrandThemeContext);
}

interface ThemeProviderProps {
  /** Backend base URL — null pre-pairing, no fetch performed. */
  backendUrl: string | null;
  /** RNStorageAdapter (cache synchrone) — persistance du mode d'apparence. */
  storage: StorageAdapter;
  children: ReactNode;
}

/**
 * Provider unique du theming mobile : MARQUE (admin) × APPARENCE (light/dark).
 *
 *  1. Marque : fetch `/api/theme`, merge sur DEFAULT_THEME, mutation des
 *     exports partagés (`applyThemeOverride`) + miroir AsyncStorage pour le
 *     boot suivant (voir THEME_TOKENS_STORAGE_KEY).
 *  2. Apparence : mode utilisateur (light/dark/auto, posé pré-mount par
 *     index.js via setBootThemeMode) → `Appearance.setColorScheme` →
 *     `useColorScheme()` = scheme résolu → `buildAppTheme(scheme)` construit
 *     un AppTheme immutable par render, consommé via useTheme()/useThemedStyles.
 *
 * Les palettes étant des builders lisant les exports partagés POST-override,
 * un changement de marque re-render à chaud tous les composants migrés.
 */
export function ThemeProvider({ backendUrl, storage, children }: ThemeProviderProps) {
  const queryClient = useQueryClient();

  // ── Apparence : mode choisi + scheme système résolu ────────────────────────
  const [mode, setModeState] = useState<ThemeMode>(getBootThemeMode);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      storage.setItem(THEME_MODE_STORAGE_KEY, next);
      // Répercute au niveau OS : les éléments natifs (alerts, clavier) suivent
      // et useColorScheme() se met à jour, ce qui reconstruit l'AppTheme.
      applyAppearance(next);
    },
    [storage],
  );

  const systemScheme = useColorScheme();
  const scheme: ResolvedScheme = systemScheme === "light" ? "light" : "dark";

  // ── Marque : query backend ────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["theme", backendUrl ?? ""],
    queryFn: () => fetchThemeState(backendUrl as string),
    enabled: !!backendUrl,
    // Always considered stale → refetched on every mount and on app foreground
    // (via the focusManager in AppProviders). The theme query is admin-driven
    // and rare, so the extra request is cheap and worth the responsiveness.
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const brandTheme = useMemo<Theme>(() => {
    if (!data) return DEFAULT_THEME;
    return mergeTheme(DEFAULT_THEME, {
      id: data.id,
      name: data.name,
      tokens: data.tokens,
    });
  }, [data]);

  // ── AppTheme résolu (marque × scheme) ─────────────────────────────────────
  // `applyThemeOverride` est appliqué ICI, avant la construction de la palette,
  // pour que buildDark/LightPalette lisent les exports partagés à jour dans le
  // même render. L'appel est idempotent (reset defaults + réapplication) donc
  // sans danger en cas de double évaluation. Tant que `data` n'est pas chargé
  // (boot, offline), on NE reset PAS : le gate index.js a déjà appliqué le
  // miroir AsyncStorage et un reset l'écraserait.
  const appTheme = useMemo<AppTheme>(() => {
    if (data) applyThemeOverride(data.tokens ?? null);
    return buildAppTheme(scheme);
  }, [data, scheme]);

  // Miroir AsyncStorage des tokens de marque pour le prochain cold start.
  useEffect(() => {
    if (data?.tokens) {
      AsyncStorage.setItem(
        THEME_TOKENS_STORAGE_KEY,
        JSON.stringify(data.tokens),
      ).catch(() => {});
    } else if (data) {
      AsyncStorage.removeItem(THEME_TOKENS_STORAGE_KEY).catch(() => {});
    }
  }, [data]);

  // ── Valeurs de contexte ───────────────────────────────────────────────────
  const prefsValue = useMemo<ThemePrefsValue>(
    () => ({
      mode,
      setMode,
      // Branché sur le module natif + persistance dans la phase Liquid Glass.
      liquidGlass: { supported: false, enabled: false, setEnabled: () => {} },
    }),
    [mode, setMode],
  );

  const brandValue = useMemo<BrandThemeContextValue>(
    () => ({
      theme: brandTheme,
      isLoading,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["theme"] }),
    }),
    [brandTheme, isLoading, queryClient],
  );

  return (
    <ThemePrefsContext.Provider value={prefsValue}>
      <AppThemeContext.Provider value={appTheme}>
        <BrandThemeContext.Provider value={brandValue}>
          {children}
        </BrandThemeContext.Provider>
      </AppThemeContext.Provider>
    </ThemePrefsContext.Provider>
  );
}

export { BrandThemeContext };
