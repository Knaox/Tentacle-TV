/**
 * Toutes les sections hors bibliothèque d'une page de résultats — une par
 * plugin qui a trouvé quelque chose —, sans ce que la bibliothèque montre déjà.
 * Tant qu'aucun plugin n'a répondu, un squelette tient la place : la section
 * n'apparaît pas d'un coup en poussant ce qui est au-dessus. Et tant qu'une
 * réponse s'étoffe encore (`settling` : Vigie répond d'abord avec son index,
 * puis avec TMDB), la section garde la place de `reserve` cartes — elle ne
 * grandit plus par vagues sous les yeux, au pire elle se resserre une fois.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ExternalResultsSection, ExternalResultsSkeleton } from "./ExternalResultsSection";
import { withoutLibraryTwins, type ExternalKind } from "@tentacle-tv/shared";
import type { ExternalSearchState } from "./useExternalSearch";

export const ExternalSections = memo(function ExternalSections({ external, library, kind = null, limit, reserve, className }: {
  external: ExternalSearchState;
  /** Ce que la bibliothèque a déjà rendu pour cette recherche. */
  library: ReadonlyArray<{ name: string; year?: number | null }>;
  /** Seulement ce type de titre (onglet « Films », bibliothèque de séries…). */
  kind?: ExternalKind | null;
  limit?: number;
  /** Cartes dont on garde la place pendant l'attente — la limite de la requête. */
  reserve?: number;
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

  const holding = external.pending || external.settling;
  const held = Math.min(reserve ?? limit ?? 6, limit ?? Infinity);

  if (sections.length === 0) {
    if (!holding) return null;
    return (
      <section className={className ?? "mt-10"} aria-busy="true" aria-label={t("externalSearching")}>
        {/* La hauteur de l'en-tête d'une vraie section (titre `text-xl`). */}
        <p className="mb-4 flex h-7 items-center text-sm text-content-quaternary">{t("externalSearching")}</p>
        <ExternalResultsSkeleton count={held} />
      </section>
    );
  }
  return (
    <>
      {sections.map((result) => (
        <ExternalResultsSection
          key={result.provider.pluginId}
          result={result}
          limit={limit}
          placeholders={holding ? Math.max(0, held - result.items.length) : 0}
          className={className}
        />
      ))}
    </>
  );
});
