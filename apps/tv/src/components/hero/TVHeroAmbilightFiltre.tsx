import { memo } from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  FeColorMatrix,
  FeGaussianBlur,
  Filter,
  Image as SvgImage,
} from "react-native-svg";

interface Props {
  uri: string;
  cardW: number;
  cardH: number;
  /** σ de l'extinction, en points d'écran. */
  sigma: number;
  /** La saturation de la référence (`saturate(1.7)`). */
  saturation: number;
  /** Largeur de la source Jellyfin : elle fixe la sous-échelle de rendu. */
  sourceW: number;
  onReady: () => void;
}

/** Trois σ : au-delà, la gaussienne ne dépose plus rien de visible. */
const PORTEE = 3;

/**
 * Le halo, pipeline LITTÉRAL de la référence : un flou gaussien qui déborde
 * vraiment de son rectangle, et la saturation qui va avec.
 *
 * L'image est posée EXACTEMENT sur le rectangle de la carte, comme sur le web.
 * Ce qui déborde n'est donc pas une copie agrandie : c'est la lumière que le
 * flou étale hors du cadre — alpha compris, puisqu'une gaussienne floute aussi
 * la transparence. L'extinction est gratuite et exacte, sans aucune couche.
 *
 * Le rendu se fait à 1/K puis la vue remet à l'échelle — même truc que le
 * `12.5%` + `scale(8)` du web, et ici doublement nécessaire : `stdDeviation`
 * est un nombre de pixels du bitmap de filtre. À l'échelle de l'écran il
 * vaudrait 48 ; à 1/6 il vaut 8, ce qui reste dans les clous partout.
 *
 * Réservé à tvOS pour l'instant : le chemin Android de react-native-svg passe
 * les flous par RenderScript avec un rayon PLAFONNÉ à 25 et sans tenir compte
 * de l'échelle du canevas — calibrer ça sans dalle sous les yeux serait deviner.
 * Le repli (`TVHeroAmbilightCouches`) n'a, lui, besoin d'aucun filtre.
 */
export const TVHeroAmbilightFiltre = memo(function TVHeroAmbilightFiltre({
  uri,
  cardW,
  cardH,
  sigma,
  saturation,
  sourceW,
  onReady,
}: Props) {
  // Une unité SVG ≈ un pixel de la source : le filtre travaille alors dans
  // l'espace où la matière existe vraiment, et pas un pixel plus fin.
  const k = Math.max(1, Math.round(cardW / sourceW));
  const bleed = PORTEE * sigma;
  const w = (cardW + 2 * bleed) / k;
  const h = (cardH + 2 * bleed) / k;
  const marge = bleed / k;

  return (
    <View
      style={{
        position: "absolute",
        top: -bleed,
        left: -bleed,
        width: w,
        height: h,
        transform: [{ scale: k }],
        transformOrigin: "0% 0%",
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <Filter id="halo" x={0} y={0} width={w} height={h} filterUnits="userSpaceOnUse">
            <FeGaussianBlur stdDeviation={sigma / k} />
            <FeColorMatrix type="saturate" values={String(saturation)} />
          </Filter>
        </Defs>
        <SvgImage
          href={{ uri }}
          x={marge}
          y={marge}
          width={cardW / k}
          height={cardH / k}
          preserveAspectRatio="xMidYMid slice"
          filter="url(#halo)"
          onLoad={onReady}
        />
      </Svg>
    </View>
  );
});
