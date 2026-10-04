import type { SearchDictation } from "./shared/screens/searchDictation";

/**
 * La saisie de la recherche — POINT D'ENTRÉE NEUTRE : ce fichier est celui de
 * l'Apple TV (clavier système et sa dictée), `searchInput.android.ts` son
 * jumeau aux MÊMES noms (clavier système + micro de l'app).
 */
export { useSearchGroups, useSearchKeyboard } from "./tvos/screens/search";

const SYSTEM: SearchDictation = { dictation: "system" };

/** tvOS refuse le micro aux apps : la dictée est celle du clavier système, qu'ouvre le champ. */
export function useSearchDictation(_onResult: (text: string) => void): SearchDictation {
  return SYSTEM;
}
