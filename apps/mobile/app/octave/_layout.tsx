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

const TAB_ROOT = { animation: "fade" as const, gestureEnabled: false };

export default function OctaveLayout() {
  const colors = useOctaveColors();
  const screenOptions = useMemo(() => ({ headerShown: false, contentStyle: { backgroundColor: colors.ink } }), [colors.ink]);
  return (
    <OctaveGate>
      <OctaveCacheGate>
        <OctaveShell>
          <Stack screenOptions={screenOptions} screenLayout={withScreenBoundary}>
            <Stack.Screen name="index" options={TAB_ROOT} />
            <Stack.Screen name="search" options={TAB_ROOT} />
            <Stack.Screen name="library" options={TAB_ROOT} />
          </Stack>
        </OctaveShell>
      </OctaveCacheGate>
    </OctaveGate>
  );
}
