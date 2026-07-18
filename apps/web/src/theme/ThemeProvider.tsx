import { createContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { applyTokenOverride, clearTokenOverride } from "./applyTokens";
import { releaseBootBackground, syncFromDocument } from "./colorScheme";
import { CustomCssInjector } from "./CustomCssInjector";
import { fetchThemeState } from "./themeApi";
import { useThemeMode } from "./useThemeMode";
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
 * Cascade strategy (4 couches, de la plus faible à la plus forte) :
 *  1. Static `tokens.css` (imported by `index.css`) defines every token at
 *     `:root`. This is the lossless baseline — no async dependency.
 *  2. `:root[data-theme="light"]` dans le même fichier redéclare les tokens
 *     colorimétriques du schéma clair. Spécificité (0,2,0) > (0,1,0), donc
 *     aucun `!important`. L'attribut est posé par le script inline de
 *     `index.html` AVANT le premier paint, puis piloté par `colorScheme.ts`.
 *  3. On mount, fetch `/api/theme` and write any token overrides as inline
 *     custom properties on `<html>`. Inline styles beat the stylesheet, so
 *     overrides win without `!important` — Y COMPRIS sur le bloc clair, d'où
 *     le partitionnement par affinité de schéma dans `applyTokens.ts` : sans
 *     lui, une surface sombre saisie par l'admin fuiterait en thème clair.
 *  4. When `customCss.hasContent` is true, mount `<CustomCssInjector>` at the
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

  const { scheme } = useThemeMode();

  const { data, isLoading } = useQuery({
    queryKey: ["theme", backendUrl],
    queryFn: () => fetchThemeState(backendUrl),
    // Toujours considéré périmé → refetch au montage et au retour sur la
    // fenêtre. Auparavant `staleTime: 5min` + `refetchOnWindowFocus: false`,
    // et comme ce provider est monté à la racine et ne se démonte jamais, RIEN
    // ne déclenchait de refetch : le thème était lu UNE SEULE FOIS par session.
    // Un changement de marque admin n'atteignait les autres utilisateurs qu'au
    // rechargement de la page — et sur desktop, qu'au redémarrage de l'app.
    // Aligné sur le mobile, qui refetch déjà au premier plan. Requête rare.
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  // Resynchronise l'attribut posé par le script d'amorçage de `index.html`, et
  // rend la main au CSS pour le fond (voir `releaseBootBackground`).
  useEffect(() => {
    syncFromDocument();
    releaseBootBackground();
  }, []);

  // Dépend AUSSI de `scheme` : l'override admin est partitionné par affinité de
  // schéma, il doit donc être réappliqué à chaque bascule clair/sombre.
  useEffect(() => {
    const override = data?.tokens;
    clearTokenOverride(lastAppliedRef.current);
    lastAppliedRef.current = override ? applyTokenOverride(override, scheme) : [];
    return () => {
      clearTokenOverride(lastAppliedRef.current);
      lastAppliedRef.current = [];
    };
  }, [data?.tokens, scheme]);

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
