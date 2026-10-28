/**
 * Octave (mobile) — la BASCULE Tentacle ↔ Octave, comme l'interrupteur du
 * bureau : entrer allume le mode (mémorisé) et ouvre l'accueil d'Octave ;
 * sortir l'éteint et rend l'accueil de Tentacle. Rien d'autre ne change de
 * mode, sauf la porte d'Octave quand le serveur dit la musique absente.
 */

import { useCallback } from "react";
import { useRouter, type Href } from "expo-router";
import { haptic } from "@/utils/haptics";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { setOctaveMode } from "./octaveModeStore";

export function useEnterOctave(): () => void {
  const router = useRouter();
  return useCallback(() => {
    haptic("tap");
    setOctaveMode(true);
    router.replace(octavePaths.home as Href);
  }, [router]);
}

export function useLeaveOctave(): () => void {
  const router = useRouter();
  return useCallback(() => {
    haptic("tap");
    setOctaveMode(false);
    router.replace("/(tabs)" as Href);
  }, [router]);
}
