/**
 * Octave — dans la ligne de tête d'un album IMPORTÉ : la pastille « Importé », et la page d'où il vient
 * (« Voir sur Bandcamp » : l'acheter, la soutenir) quand c'est un lien — jamais pour des fichiers seuls.
 */

import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ImportedBadge } from "./ImportedBadge";

/** Seule une page https s'ouvre (l'adresse vient de l'extension). */
const safeSource = (url: string | null): string | null => (url && /^https:\/\//i.test(url) ? url : null);

export function ImportedAlbumMeta({ sourceUrl }: { sourceUrl: string | null }) {
  const { t } = useTranslation("musicReleases");
  const source = safeSource(sourceUrl);
  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-2">
      <ImportedBadge variant="inline" />
      {source && (
        <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-content-secondary hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("viewOnBandcamp")}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </span>
  );
}
