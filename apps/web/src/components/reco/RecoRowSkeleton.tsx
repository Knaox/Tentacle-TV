import { Shimmer } from "@tentacle-tv/ui";

/**
 * Silhouette d'une rangée pendant la génération du pool : mêmes gouttières et
 * hauteurs qu'une vraie rangée pour un morphing sans saut de mise en page.
 * Shimmer = opacité seule (conforme aux règles GPU), rien d'interactif.
 */
export function RecoRowSkeleton() {
  return (
    <div className="mb-10" aria-hidden>
      <div className="row-gutter">
        <Shimmer className="h-6 w-56 rounded" />
      </div>
      <div className="row-gutter flex gap-3 overflow-hidden pb-6 pt-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="w-[180px] shrink-0">
            <Shimmer className="aspect-[2/3] w-full rounded-xl" />
            <Shimmer className="mt-2 h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
