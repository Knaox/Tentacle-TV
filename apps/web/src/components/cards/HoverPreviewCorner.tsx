import type { MediaItem } from "@tentacle-tv/shared";
import { CardQuickActions } from "./CardQuickActions";

/**
 * Actions rapides en superposition sur la vignette du panneau d'aperçu : dans
 * le COIN et non dans le voile. Une rangée de pastilles de 36 px y ajoutait une
 * quatrième ligne, et le voile finissait par manger plus de la moitié de
 * l'image — l'aperçu ne montrait plus le média qu'il est censé faire voir. Au
 * coin elles ne coûtent aucune hauteur, et c'est déjà leur place sur les cartes
 * qui n'ont pas de panneau.
 *
 * Le `stopPropagation` du conteneur vaut pour toutes : la vignette, elle, lance
 * la lecture.
 */
export function HoverPreviewCorner({ item }: { item: MediaItem }) {
  return (
    <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
      <CardQuickActions item={item} variant="bar" />
    </div>
  );
}
