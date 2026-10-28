/**
 * Octave — ce que la page Recherche MONTRE d'une recherche validée (tout d'un coup, puis sans réordonner). Le
 * crochet vit dans api-client (`useRevealedResults`, lu aussi par le mobile) ; ici, l'extension de ce serveur, les
 * mots de l'interface et le décodage des pochettes du web.
 */

import { useTranslation } from "react-i18next";
import { useRevealedResults as useSharedRevealedResults } from "@tentacle-tv/api-client";
import { useArtworkPreloader } from "../components/useArtworkPreloader";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export type { ShownExternal } from "@tentacle-tv/api-client";

export function useRevealedResults(query: string) {
  const { t, i18n } = useTranslation("music");
  const preloadArtwork = useArtworkPreloader();
  return useSharedRevealedResults(useOctaveProvider(), query, { language: i18n.language, externalDefault: t("search.externalDefault"), preloadArtwork });
}
