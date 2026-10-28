/**
 * Octave (mobile) — le mode musique : sa porte (capacités du serveur), son
 * cache gardé, sa coquille, et la pile de ses pages. Les racines des onglets
 * s'enchaînent en fondu ; une page (album, artiste, playlist…) s'empile.
 * Adresses : `@tentacle-tv/shared/octave/mode` (`octavePaths`), les mêmes que le bureau.
 */

import { useMemo } from "react";
import { Stack } from "expo-router";
import { withScreenBoundary } from "@/components/problems/ScreenErrorBoundary";
import { OctaveCacheGate } from "@/octave/cache/OctaveCacheGate";
import { OctaveGate } from "@/octave/shell/OctaveGate";
import { OctaveShell } from "@/octave/shell/OctaveShell";
import { useOctaveColors } from "@/octave/theme/octaveColors";
import { OctaveThemeScope } from "@/octave/theme/OctaveThemeScope";

const TAB_ROOT = { animation: "fade" as const, gestureEnabled: false };

export default function OctaveLayout() {
  // L'apparence d'Octave (clair, sombre, verre) avant tout : le fond de la pile la suit aussi.
  return (
    <OctaveThemeScope>
      <OctaveStack />
    </OctaveThemeScope>
  );
}

function OctaveStack() {
  const colors = useOctaveColors();
  const screenOptions = useMemo(() => ({ headerShown: false, contentStyle: { backgroundColor: colors.ink } }), [colors.ink]);
  return (
    // Le cache d'abord : sa restauration synchrone (lancement en Octave) se fait avant qu'aucun
    // observateur ne soit monté — jamais un état mis à jour pendant le rendu d'un autre composant —,
    // et la porte lit aussitôt le statut gardé.
    <OctaveCacheGate>
      <OctaveGate>
        <OctaveShell>
          <Stack screenOptions={screenOptions} screenLayout={withScreenBoundary}>
            <Stack.Screen name="index" options={TAB_ROOT} />
            <Stack.Screen name="search" options={TAB_ROOT} />
            <Stack.Screen name="library" options={TAB_ROOT} />
          </Stack>
        </OctaveShell>
      </OctaveGate>
    </OctaveCacheGate>
  );
}
