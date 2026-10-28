/**
 * Octave (mobile) — la PORTÉE de l'apparence d'Octave, autour de toute la pile du mode (`app/octave/_layout`) :
 * « Apparence d'Octave » (Comme Tentacle, Clair, Sombre) et « Liquid Glass dans Octave », réglages de
 * l'appareil (`octaveSettings.ts`), y prennent effet aussitôt, sans toucher au thème de Tentacle. Les jetons
 * d'Octave (`useOctaveColors`) et les composants partagés lisent le thème par contexte : ils suivent. La barre
 * d'état suit le schéma imposé ; démontée (retour à Tentacle), elle rend celle de Tentacle.
 */

import { useMemo, type ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { AppThemeContext, ThemePrefsContext, buildAppTheme, useTheme, useThemeMode } from "@/theme";
import { octaveLiquidGlass, octaveTheme } from "../settings/octaveSettings";
import { octaveGlassEnabled, octaveSchemeOf } from "./octaveThemeChoice";

export function OctaveThemeScope({ children }: { children: ReactNode }) {
  const tentacle = useTheme();
  const prefs = useThemeMode();
  const scheme = octaveSchemeOf(octaveTheme.use());
  const glass = octaveLiquidGlass.use();
  const theme = useMemo(() => (scheme === null || scheme === tentacle.scheme ? tentacle : buildAppTheme(scheme)), [scheme, tentacle]);
  const enabled = octaveGlassEnabled(prefs.liquidGlass.supported, glass);
  const octavePrefs = useMemo(
    () => (enabled === prefs.liquidGlass.enabled ? prefs : { ...prefs, liquidGlass: { ...prefs.liquidGlass, enabled } }),
    [enabled, prefs],
  );
  return (
    <ThemePrefsContext.Provider value={octavePrefs}>
      <AppThemeContext.Provider value={theme}>
        {theme !== tentacle ? <StatusBar style={theme.statusBarStyle} /> : null}
        {children}
      </AppThemeContext.Provider>
    </ThemePrefsContext.Provider>
  );
}
