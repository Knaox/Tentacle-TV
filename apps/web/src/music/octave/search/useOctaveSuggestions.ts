/**
 * Octave — les suggestions de la barre pendant la frappe. Le crochet vit dans api-client (`useOctaveSuggestions`,
 * lu aussi par le mobile) ; ici, l'extension de ce serveur et le stockage de l'appareil (`localStorage`).
 */

import { useOctaveSuggestions as useSharedOctaveSuggestions } from "@tentacle-tv/api-client";
import type { OctaveDeviceStore } from "@tentacle-tv/shared/octave";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export { SUGGEST_DEBOUNCE_MS } from "@tentacle-tv/api-client";

const store: OctaveDeviceStore | null = typeof localStorage === "undefined" ? null : localStorage;

export function useOctaveSuggestions(draft: string) {
  return useSharedOctaveSuggestions(useOctaveProvider(), draft, store);
}
