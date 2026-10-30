/**
 * Octave — les suggestions de la barre pendant la frappe. Le crochet vit dans api-client (`useOctaveSuggestions`,
 * lu aussi par le mobile) ; ici, l'extension de ce serveur et l'historique de la recherche (`useOctaveSearchHistory` :
 * celui du compte quand le serveur le garde, sinon le `localStorage` de l'appareil).
 */

import { useMemo } from "react";
import { useOctaveSearchHistory, useOctaveSuggestions as useSharedOctaveSuggestions } from "@tentacle-tv/api-client";
import { recentQueriesOf, type OctaveDeviceStore } from "@tentacle-tv/shared/octave";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export { SUGGEST_DEBOUNCE_MS } from "@tentacle-tv/api-client";

export const searchDeviceStore: OctaveDeviceStore | null = typeof localStorage === "undefined" ? null : localStorage;

export function useOctaveSuggestions(draft: string) {
  const history = useOctaveSearchHistory(searchDeviceStore);
  const recents = useMemo(() => recentQueriesOf(history.history), [history.history]);
  const { suggestions } = useSharedOctaveSuggestions(useOctaveProvider(), draft, recents);
  return { suggestions, recents, remember: history.rememberQuery, forget: history.forgetQuery, history };
}
