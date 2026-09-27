import { useTranslation } from "react-i18next";

/**
 * Le squelette de la grille, à la géométrie de la vraie : même nombre de
 * colonnes (`useItemsPerRow`), même écart, une affiche 2:3 et les deux lignes
 * de légende. L'ancien squelette suivait ses propres paliers Tailwind — deux à
 * huit colonnes — et la grille « sautait » de largeur de carte à l'arrivée des
 * titres.
 *
 * Trois rangées suffisent à remplir la vue sous la bannière ; au-delà, des
 * calques animés que personne ne voit. Le balayage du shimmer est borné
 * (`index.css`) : il ne tient pas le compositeur éveillé.
 */
export function LibraryGridSkeleton({ columns, gap, rows = 3 }: { columns: number; gap: number; rows?: number }) {
  const { t } = useTranslation("library");
  return (
    <div role="status" aria-label={t("loading")}>
      {/* Même montage que la grille réelle, donc même traitement sur le
          téléviseur (`colonnesTv.ts` + `grid-tv.css`).
          tv-compat-ok: traité par colonnesTv.ts + grille-tv.css */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gap }}>
        {Array.from({ length: columns * rows }, (_, i) => (
          <div key={i} aria-hidden className="flex flex-col gap-2">
            <div className="skeleton-shimmer aspect-[2/3] rounded-[var(--radius-lg)]" />
            <div className="skeleton-shimmer h-3 w-3/4 rounded-full" />
            <div className="skeleton-shimmer h-2.5 w-1/3 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * La page suivante arrive : un anneau aux couleurs de la marque et le mot,
 * dans une pastille — la fin de grille ne ressemble plus à un bug.
 */
export function LibraryLoadingMore({ className = "" }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <div role="status" className={`flex items-center justify-center ${className}`}>
      <span className="inline-flex items-center gap-2.5 rounded-full bg-[color:var(--surface-2)] px-4 py-2 text-xs font-medium text-content-tertiary ring-1 ring-line-subtle">
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent motion-reduce:animate-none"
        />
        {t("common:loadingMore")}
      </span>
    </div>
  );
}
