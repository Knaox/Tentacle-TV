import { useMemo } from "react";
import { scrubCountdownPolicyOf, type ScrubCountdownPolicy } from "@tentacle-tv/tv-core";
import { useScrubCountdownSettings } from "../lib/scrubCountdownSettings";

/**
 * La politique du décompte du défilement sur APPLE TV (la variante Android
 * TV : `scrubCountdownPolicy.ts`) : celle du réglage « Avance rapide » du
 * compte affiché — par défaut, revenir où l'on était au bout de 5 s.
 */
export function useScrubCountdownPolicy(): ScrubCountdownPolicy | undefined {
  const { settings } = useScrubCountdownSettings();
  return useMemo(() => scrubCountdownPolicyOf(settings), [settings]);
}
