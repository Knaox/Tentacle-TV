import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { AmbilightLayer } from "./AmbilightLayer";
import { resolveBackdropId } from "./resolveBackdrop";

interface HeroAmbilightProps {
  /** Item dont l'affiche éclaire le cadre. `undefined` = pas de halo. */
  item: MediaItem | undefined;
  /**
   * Intensité, en valeur CSS. La fiche média la baisse : son halo se répand
   * DERRIÈRE le bloc titre, qui est en texte blanc — au réglage de l'accueil,
   * où la lumière ne tombe que sur du fond de page, il mangeait le contraste.
   */
  opacity?: string;
  /**
   * Boîte du halo. Par défaut celle du cadre (`absolute inset-0`) ; les
   * bannières à FOND PERDU la débordent vers le bas, seul côté par lequel leur
   * lumière peut sortir.
   */
  className?: string;
}

/**
 * Largeur de la source du halo. Volontairement DÉRISOIRE : agrandie une
 * quinzaine de fois par la mise en page, l'image n'est déjà plus qu'un champ de
 * couleurs — l'interpolation du navigateur fait l'essentiel du travail, et le
 * flou CSS n'a plus qu'à finir le lissage. C'est ce qui permet un rayon modeste
 * là où une source pleine résolution en aurait demandé trois fois plus, pour un
 * résultat identique à l'œil : le coût d'un flou croît avec son rayon.
 *
 * Effet de bord appréciable : ~4 Ko au lieu de ~300 Ko par diapositive.
 */
const SOURCE_WIDTH = 128;

/**
 * Halo « ambilight » d'un item Jellyfin — adaptateur mince : la mécanique
 * (sous-échelle, flou, fondu, reduced-motion) vit dans AmbilightLayer,
 * partagée avec le carrousel des recommandations.
 */
export function HeroAmbilight({ item, opacity, className }: HeroAmbilightProps) {
  const client = useJellyfinClient();
  const backdropId = item ? resolveBackdropId(item) : null;
  const url = backdropId
    ? client.getImageUrl(backdropId, "Backdrop", { width: SOURCE_WIDTH, quality: 70 })
    : null;
  return <AmbilightLayer url={url} layerKey={item?.Id ?? ""} opacity={opacity} className={className} />;
}
