import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_THEME, mergeTheme, type Theme } from "@tentacle-tv/theme";
import { applyThemeOverride } from "@tentacle-tv/shared";
import { fetchThemeState } from "./themeApi";

/**
 * Key under which the latest token override is mirrored in AsyncStorage.
 * Read synchronously at next cold start by `index.js` BEFORE any screen module
 * is imported, so module-level `StyleSheet.create({color: BRAND.violet})` calls
 * capture the *admin-configured* tokens instead of the static defaults. Without
 * this hand-off, mobile permanently shows the boot-time snapshot of colors
 * regardless of theme fetch result (RN StyleSheet is frozen after creation).
 */
const THEME_TOKENS_STORAGE_KEY = "tentacle_theme_tokens";

export interface ThemeContextValue {
  theme: Theme;
  isLoading: boolean;
  /** Invalidate the cached `/api/theme` query so it re-fetches on next render. */
  refresh: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  isLoading: false,
  refresh: () => {},
});

interface ThemeProviderProps {
  /** Backend base URL — null pre-pairing, no fetch performed. */
  backendUrl: string | null;
  children: ReactNode;
}

/**
 * Mobile theme bootstrap.
 *
 * Strategy:
 *  1. Hydrate immediately with `DEFAULT_THEME` from `@tentacle-tv/theme` —
 *     identical values to the static web `tokens.css`, so the app renders
 *     correctly even offline / pre-pairing.
 *  2. Fetch `/api/theme` in the background; merge any partial override into
 *     the default tree. No DOM here (RN has no CSS variables) — consumers
 *     read tokens from `useTheme().theme.tokens.*` directly.
 *  3. CustomCSS is intentionally unused on mobile: structural CSS cannot
 *     apply to React Native, so we ignore `data.customCss` on this platform.
 */
export function ThemeProvider({ backendUrl, children }: ThemeProviderProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["theme", backendUrl ?? ""],
    queryFn: () => fetchThemeState(backendUrl as string),
    enabled: !!backendUrl,
    // Always considered stale → refetched on every mount and on app foreground
    // (via the focusManager in AppProviders). The theme query is admin-driven
    // and rare, so the extra request is cheap and worth the responsiveness:
    // when an admin applies a preset on web, mobile picks it up next foreground.
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const theme = useMemo<Theme>(() => {
    if (!data) return DEFAULT_THEME;
    return mergeTheme(DEFAULT_THEME, {
      id: data.id,
      name: data.name,
      tokens: data.tokens,
    });
  }, [data]);

  // 1. Mutate the live exports so re-rendered components see the new colors.
  // 2. Mirror the tokens to AsyncStorage so the *next* cold boot can apply
  //    them BEFORE any screen module imports — fixes the StyleSheet.create
  //    "frozen at boot" limitation. See THEME_TOKENS_STORAGE_KEY note above.
  useEffect(() => {
    applyThemeOverride(data?.tokens ?? null);
    if (data?.tokens) {
      AsyncStorage.setItem(
        THEME_TOKENS_STORAGE_KEY,
        JSON.stringify(data.tokens),
      ).catch(() => {});
    } else if (data) {
      AsyncStorage.removeItem(THEME_TOKENS_STORAGE_KEY).catch(() => {});
    }
  }, [data]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isLoading,
      refresh: () =>
        queryClient.invalidateQueries({ queryKey: ["theme"] }),
    }),
    [theme, isLoading, queryClient],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export { ThemeContext };
