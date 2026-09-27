import type { MediaItem } from "@tentacle-tv/shared";
import { CardActionTray } from "./CardActionTray";

/**
 * Le plateau d'actions posé sur la vignette du panneau d'aperçu : dans le
 * COIN et non dans le voile. Une rangée de pastilles y ajoutait une quatrième
 * ligne, et le voile finissait par manger plus de la moitié de l'image — au
 * coin il ne coûte aucune hauteur.
 *
 * Le même `CardActionTray` que le survol des affiches : mêmes glyphes, même
 * ordre, et c'est lui qui coupe la propagation — la vignette, elle, lance la
 * lecture.
 */
export function HoverPreviewCorner({ item }: { item: MediaItem }) {
  return (
    <div className="absolute right-2 top-2 z-10">
      <CardActionTray item={item} />
    </div>
  );
}
