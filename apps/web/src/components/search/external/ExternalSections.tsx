/**
 * Toutes les sections hors bibliothèque d'une page de résultats — une par
 * plugin qui a trouvé quelque chose —, sans ce que la bibliothèque montre déjà.
 * Tant qu'aucun plugin n'a répondu, un squelette tient la place : la section
 * n'apparaît pas d'un coup en poussant ce qui est au-dessus.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ExternalResultsSection, ExternalResultsSkeleton } from "./ExternalResultsSection";
import { withoutLibraryTwins, type ExternalKind } from "@tentacle-tv/shared";
import type { ExternalSearchState } from "./useExternalSearch";

export const ExternalSections = memo(function ExternalSections({ external, library, kind = null, limit, className }: {
  external: ExternalSearchState;
  /** Ce que la bibliothèque a déjà rendu pour cette recherche. */
  library: ReadonlyArray<{ name: string; year?: number | null }>;
  /** Seulement ce type de titre (onglet « Films », bibliothèque de séries…). */
  kind?: ExternalKind | null;
  limit?: number;
  className?: string;
}) {
  const { t } = useTranslation("search");
  const sections = useMemo(
    () => external.results
      .map((result) => ({
        ...result,
        items: withoutLibraryTwins(result.items, library).filter((item) => kind === null || item.kind === kind),
      }))
      .filter((result) => result.items.length > 0),
    [external.results, library, kind],
  );

  if (sections.length === 0) {
    if (!external.pending) return null;
    return (
      <section className={className ?? "mt-10"} aria-busy="true" aria-label={t("externalSearching")}>
        <p className="mb-4 text-sm text-content-quaternary">{t("externalSearching")}</p>
        <ExternalResultsSkeleton count={limit !== undefined ? Math.min(limit, 6) : 6} />
      </section>
    );
  }
  return (
    <>
      {sections.map((result) => (
        <ExternalResultsSection key={result.provider.pluginId} result={result} limit={limit} className={className} />
      ))}
    </>
  );
});
