/**
 * Une section de résultats HORS bibliothèque, en grille d'affiches — sur la
 * page de résultats de la recherche comme sous la grille d'une bibliothèque.
 *
 * Son titre est celui que le plugin a choisi (« Pas encore sur le serveur »),
 * suivi du nom du plugin : on voit d'un coup d'œil que ces titres ne se lisent
 * pas ici, et d'où ils viennent. Une carte mène à la page du plugin qui montre
 * le titre ; « Tout voir » ouvre sa propre recherche.
 */

import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalBadge, ExternalPoster } from "./ExternalVisuals";
import type { ExternalSearchResult } from "@tentacle-tv/shared";

const GRID = { gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" } as const;

export function ExternalResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden className="grid gap-x-4 gap-y-6" style={GRID}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="aspect-[2/3] rounded-md bg-fill-subtle" />
          <div className="mt-2 h-3 w-3/4 rounded bg-fill-subtle" />
          <div className="mt-1.5 h-2.5 w-1/2 rounded bg-fill-faint" />
        </li>
      ))}
    </ul>
  );
}

export const ExternalResultsSection = memo(function ExternalResultsSection({ result, limit, className = "mt-10" }: {
  result: ExternalSearchResult;
  /** Nombre de cartes montrées ; le reste est derrière « Tout voir ». */
  limit?: number;
  className?: string;
}) {
  const { t } = useTranslation("search");
  const navigate = useNavigate();
  const items = limit === undefined ? result.items : result.items.slice(0, limit);
  const { provider } = result;

  return (
    <section className={className} aria-label={provider.label}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-content-primary">
          {provider.label}
          <span className="ml-2 text-sm font-medium text-content-quaternary">{t("externalBy", { name: provider.source })}</span>
        </h2>
        {result.moreHref !== null && (
          <button
            type="button"
            onClick={() => navigate(result.moreHref as string)}
            className="shrink-0 text-sm font-medium text-[var(--brand-light)] transition-opacity hover:opacity-80"
          >
            {t("externalSeeAll", { name: provider.source })} →
          </button>
        )}
      </div>
      <ul className="grid gap-x-4 gap-y-6" style={GRID}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => navigate(item.href)}
              className="group/x block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <div className="relative">
                <ExternalPoster item={item} className="aspect-[2/3] w-full rounded-md" />
                {item.badge !== null && <ExternalBadge badge={item.badge} className="absolute left-2 top-2" />}
              </div>
              <p className="mt-2 truncate text-sm font-medium text-content-primary group-hover/x:text-[var(--brand-light)]">{item.title}</p>
              {item.subtitle !== null && <p className="truncate text-xs text-content-quaternary">{item.subtitle}</p>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
});
