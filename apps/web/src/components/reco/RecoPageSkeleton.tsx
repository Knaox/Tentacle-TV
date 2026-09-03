import { Shimmer } from "@tentacle-tv/ui";
import { CARD_HEIGHT, FRAME_GUTTER } from "../hero/HeroBillboard";
import { RecoRowSkeleton } from "./RecoRowSkeleton";

/**
 * La silhouette de la page ENTIÈRE, à la géométrie réelle : le cadre du
 * carrousel héros (même hauteur, mêmes gouttières), la barre des filtres,
 * trois rangées. Affichée UNIQUEMENT quand il n'y a rien — ni cache, ni
 * données précédentes : la toute première visite d'un appareil. Ensuite, la
 * page se rend d'un coup depuis le cache.
 */
export function RecoPageSkeleton() {
  return (
    <div className="min-h-screen pb-20" aria-hidden>
      <div className="pt-6">
        <section className={`relative w-full bg-surface-0 pb-6 md:pb-10 ${FRAME_GUTTER}`}>
          <Shimmer className={`w-full ${CARD_HEIGHT} rounded-[var(--hero-frame-radius)]`} />
        </section>
      </div>
      <div className="row-gutter mb-6 flex justify-end">
        <Shimmer className="h-9 w-24 rounded-full" />
      </div>
      <RecoRowSkeleton />
      <RecoRowSkeleton />
      <RecoRowSkeleton />
    </div>
  );
}
