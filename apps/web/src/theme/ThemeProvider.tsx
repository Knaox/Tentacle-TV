import { createContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { applyTokenOverride, clearTokenOverride } from "./applyTokens";
import { CustomCssInjector } from "./CustomCssInjector";
import { fetchThemeState } from "./themeApi";
import type { BackendThemeState } from "./types";

interface ThemeContextValue {
  theme: BackendThemeState | null;
  isLoading: boolean;
  /**
   * Invalidate the cached `/api/theme` and `/api/theme/css` queries so the
   * provider re-fetches them on the next render. Use after admin mutations.
   */
  refresh: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  isLoading: false,
  refresh: () => {},
});

interface ThemeProviderProps {
  /** Backend base URL (empty for same-origin web, server URL for desktop). */
  backendUrl: string;
  children: ReactNode;
}

/**
 * Boot-time theme bootstrap.
 *
 * Cascade strategy:
 *  1. Static `tokens.css` (imported by `index.css`) defines every token at
 *     `:root`. This is the lossless baseline — no async dependency.
 *  2. On mount, fetch `/api/theme` and write any token overrides as inline
 *     custom properties on `<html>`. Inline styles beat the stylesheet, so
 *     overrides win without `!important`.
 *  3. When `customCss.hasContent` is true, mount `<CustomCssInjector>` at the
 *     end of the tree — the resulting `<style>` element lives at the bottom of
 *     `<body>`, so its rules win document-order cascade.
 *
 * When the override is removed (admin DELETE → next refresh returns `{}`), the
 * effect clears the previously set inline properties and the static stylesheet
 * values take over again.
 */
export function ThemeProvider({ backendUrl, children }: ThemeProviderProps) {
  const queryClient = useQueryClient();
  const lastAppliedRef = useRef<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["theme", backendUrl],
    queryFn: () => fetchThemeState(backendUrl),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const override = data?.tokens;
    clearTokenOverride(lastAppliedRef.current);
    lastAppliedRef.current = override ? applyTokenOverride(override) : [];
    return () => {
      clearTokenOverride(lastAppliedRef.current);
      lastAppliedRef.current = [];
    };
  }, [data?.tokens]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: data ?? null,
      isLoading,
      refresh: () => {
        queryClient.invalidateQueries({ queryKey: ["theme"] });
        queryClient.invalidateQueries({ queryKey: ["theme-css"] });
      },
    }),
    [data, isLoading, queryClient],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {data?.customCss.hasContent && data.customCss.hash ? (
        <CustomCssInjector backendUrl={backendUrl} hash={data.customCss.hash} />
      ) : null}
    </ThemeContext.Provider>
  );
}

export { ThemeContext };
export type { ThemeContextValue };
