import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_THEME, mergeTheme, type Theme } from "@tentacle-tv/theme";
import { applyThemeOverride } from "@tentacle-tv/shared";
import { fetchThemeState } from "./themeApi";

export interface ThemeContextValue {
  theme: Theme;
  isLoading: boolean;
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
 * TV theme bootstrap.
 *
 * Uses TanStack Query v4 (note the `cacheTime` key — renamed `gcTime` in v5).
 *
 * Strategy mirrors the mobile provider: hydrate with `DEFAULT_THEME`
 * synchronously, fetch `/api/theme` in the background, merge any partial
 * override into the default tree. No CustomCSS on TV (no DOM).
 */
export function ThemeProvider({ backendUrl, children }: ThemeProviderProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["theme", backendUrl ?? ""],
    queryFn: () => fetchThemeState(backendUrl as string),
    enabled: !!backendUrl,
    // Always stale → refetched on focus / mount. Admin changes propagate next
    // foreground without forcing the user to relaunch the TV app.
    staleTime: 0,
    cacheTime: 30 * 60 * 1000,
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

  // Push the override into the shared mutable theme exports so inline-style
  // consumers reading `Colors.accentPurple`, `BRAND.violet`, etc. pick up the
  // admin's theme on the next render. Module-level StyleSheet.create stays
  // frozen at boot-time snapshot — known limitation, handled component by
  // component via `useTheme().theme.tokens.*` for future migration.
  useEffect(() => {
    applyThemeOverride(data?.tokens ?? null);
  }, [data?.tokens]);

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
