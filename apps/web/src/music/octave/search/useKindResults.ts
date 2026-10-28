/**
 * Octave — la liste d'un filtre de la recherche. Le crochet vit dans api-client (`useKindResults`, lu aussi par le
 * mobile) ; ici, l'extension de ce serveur et le décodage des pochettes du web.
 */

import { useKindResults as useSharedKindResults, type KindResults } from "@tentacle-tv/api-client";
import type { SearchFilter, ShownExternalLists } from "@tentacle-tv/shared/octave";
import { useArtworkPreloader } from "../components/useArtworkPreloader";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export type { KindResults } from "@tentacle-tv/api-client";

export function useKindResults(query: string, filter: SearchFilter, shown: ShownExternalLists | null): KindResults {
  return useSharedKindResults(useOctaveProvider(), query, filter, shown, useArtworkPreloader());
}
