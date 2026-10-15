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
import { ExternalResultCard } from "./ExternalResultCard";
import type { ExternalSearchResult } from "@tentacle-tv/shared";

const GRID = { gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" } as const;

/**
 * Une cellule en attente : la géométrie EXACTE d'une `ExternalResultCard`
 * (affiche, titre `text-sm` de 20 px après `mt-2`, sous-titre de 16 px) — la
 * vraie carte prend sa place sans rien pousser.
 */
function SkeletonCell() {
  return (
    <li aria-hidden>
      <div className="aspect-[2/3] rounded-md bg-fill-subtle" />
      <div className="mt-2 h-5 w-3/4 py-1"><div className="h-full rounded bg-fill-subtle" /></div>
      <div className="h-4 w-1/2 py-0.5"><div className="h-full rounded bg-fill-faint" /></div>
    </li>
  );
}

export function ExternalResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden className="grid gap-x-4 gap-y-6" style={GRID}>
      {Array.from({ length: count }, (_, i) => <SkeletonCell key={i} />)}
    </ul>
  );
}

export const ExternalResultsSection = memo(function ExternalResultsSection({ result, limit, placeholders = 0, className = "mt-10" }: {
  result: ExternalSearchResult;
  /** Nombre de cartes montrées ; le reste est derrière « Tout voir ». */
  limit?: number;
  /** Cellules en attente après les cartes : la réponse s'étoffe encore. */
  placeholders?: number;
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
      {/* Une pièce de plusieurs lignes : seule la ligne de la carte
          s'écarte devant sa mini-carte d'aperçu. */}
      <ul data-preview-room="grid" className="grid gap-x-4 gap-y-6" style={GRID}>
        {items.map((item) => (
          <li key={item.id}>
            <ExternalResultCard item={item} />
          </li>
        ))}
        {/* Clé = la PLACE dans la grille : une carte arrivée prend celle d'une
            cellule en attente, les suivantes ne glissent pas d'une case. */}
        {Array.from({ length: placeholders }, (_, i) => <SkeletonCell key={`wait-${items.length + i}`} />)}
      </ul>
    </section>
  );
});
