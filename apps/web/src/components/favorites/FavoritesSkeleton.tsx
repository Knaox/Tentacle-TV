/**
 * Le chargement de Mes favoris, à la forme exacte de la page remplie : la
 * réserve de la bannière (mêmes hauteurs que `CollectionHero`), les quatre
 * tuiles, puis la grille. Rien ne saute quand les titres arrivent.
 */
export function FavoritesSkeleton() {
  return (
    <div aria-busy="true">
      <div className="relative -mt-[56px] h-[32vh] min-h-[220px] w-full md:-mt-[68px] md:h-[36vh]">
        <div className="absolute inset-x-0 bottom-[18%] flex flex-col gap-3 px-4 sm:px-8 md:px-14">
          <div className="skeleton-shimmer h-3 w-32 rounded-full" />
          <div className="skeleton-shimmer h-10 w-64 rounded-xl md:h-14 md:w-96" />
        </div>
      </div>
      <div className="relative -mt-10 px-4 pt-6 md:-mt-14 md:px-8">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton-shimmer mb-6 mt-6 h-10 w-full max-w-xl rounded-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-[2/3] rounded-[var(--radius-lg)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
