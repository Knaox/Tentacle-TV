import type { SearchDictation } from "./common/screens/searchDictation";

/** Apple TV — voir `searchInput.ts`. */
export { useSearchGroups, useSearchKeyboard } from "./tvos/screens/search";

const SYSTEM: SearchDictation = { dictation: "system" };

/** tvOS refuse le micro aux apps : la dictée est celle du clavier système, qu'ouvre le champ. */
export function useSearchDictation(_onResult: (text: string) => void): SearchDictation {
  return SYSTEM;
}
