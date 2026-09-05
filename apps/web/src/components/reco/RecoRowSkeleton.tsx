import { Shimmer } from "@tentacle-tv/ui";
import { POSTER_VW, POSTER_WIDTH } from "../cards/cardSizes";
import { cardWidthStyle } from "../cards/cardWidthStyle";

const CARD_WIDTH = cardWidthStyle(null, POSTER_WIDTH.md, POSTER_VW);

/**
 * Silhouette d'une rangée : la GÉOMÉTRIE d'une vraie rangée (en-tête, piste
 * `pb-6 pt-8`, cartes au `clamp` des affiches, bloc titre de 40 px, marge
 * basse) pour qu'un morphing vers le contenu ne déplace rien. Shimmer =
 * opacité seule (règle GPU), rien d'interactif.
 */
export function RecoRowSkeleton() {
  return (
    <div className="mb-10" aria-hidden>
      <div className="row-gutter mb-1 flex items-center gap-2.5">
        <Shimmer className="h-7 w-56 rounded" />
      </div>
      <div className="row-gutter flex gap-3 overflow-hidden pb-6 pt-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="shrink-0" style={{ width: CARD_WIDTH }}>
            <Shimmer className="aspect-[2/3] w-full rounded-xl" />
            <div className="mt-2 min-h-[40px]">
              <Shimmer className="h-4 w-3/4 rounded" />
              <Shimmer className="mt-1.5 h-3 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
