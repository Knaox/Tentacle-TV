import { memo } from "react";
import { PixelRatio, Platform, View } from "react-native";
import { reglageFlouAndroid } from "@tentacle-tv/tv-core";
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
 * Les deux plateformes l'empruntent, mais pas avec la même valeur de flou :
 * Android n'applique pas l'échelle d'écran à `stdDeviation` et sature son rayon
 * à 25 sans le dire. La valeur y est donc pré-compensée et le canevas réduit
 * d'autant qu'il faut — voir `reglageFlouAndroid`. iOS reçoit exactement ce
 * qu'il recevait.
 *
 * # Le `viewBox`, et pourquoi il n'est pas décoratif
 *
 * Sans lui, les nombres écrits dans le SVG ne sont PAS ceux de la mise en page.
 * `react-native-svg` résout une longueur nue dans sa propre échelle (`mScale`,
 * la densité que lui rapporte l'affichage) ; React Native, lui, pose la vue
 * dans son espace de points. Sur l'Android TV de banc les deux ne coïncident
 * pas — `PixelRatio.get()` y rend 1 pour une dalle en densité 320 — et l'image
 * était donc dessinée à une échelle, la boîte censée la contenir à une autre.
 * L'image débordait sa propre région de filtre : la gaussienne n'avait plus de
 * vide où s'éteindre.
 *
 * Ce que cela donnait à l'écran, mesuré à l'émulateur par différence entre deux
 * captures identiques, halo allumé puis éteint : une DALLE pleine, à bords
 * francs, tout autour de la carte. Sur la ligne médiane, la contribution du
 * halo valait 115 contre le bord de la carte et encore 106 à cent quarante
 * pixels de là — plate, puis coupée net. Aucune extinction, nulle part.
 *
 * Avec le `viewBox`, l'unité utilisateur est arrimée au viewport et les deux
 * espaces se rejoignent. Même mesure, même image : 78 contre la carte, puis 63,
 * 45, 28, 12 — une extinction monotone sur exactement les trois σ prévus, et
 * plus aucune couture visible. C'est le seul changement nécessaire ; poser en
 * plus les sous-régions des primitives donnait, au pixel près, le même profil.
 *
 * `0 0 w h` sur un viewport de `w × h` est l'identité : rien ne bouge sur tvOS,
 * qui rendait déjà le halo juste.
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
  //
  // Sur Android il faut en plus PRÉ-COMPENSER : `react-native-svg` y multiplie
  // le rayon par deux au lieu de tenir compte de RenderScript et de la densité,
  // là où sa branche Apple applique l'échelle d'écran (et dit pourquoi en
  // commentaire). Le détail, et la mesure de l'écart, sont dans
  // `reglageFlouAndroid`. iOS garde EXACTEMENT la valeur d'avant.
  const naturel = { k: Math.max(1, Math.round(cardW / sourceW)), stdDeviation: 0 };
  const reglage =
    Platform.OS === "android"
      ? reglageFlouAndroid(sigma, cardW, sourceW, PixelRatio.get())
      : { ...naturel, stdDeviation: sigma / naturel.k };
  const { k, stdDeviation } = reglage;
  const bleed = PORTEE * sigma;
  const w = (cardW + 2 * bleed) / k;
  const h = (cardH + 2 * bleed) / k;
  const marge = bleed / k;

  // Posé par son CENTRE, et mis à l'échelle autour de ce centre.
  //
  // La version d'avant ancrait le coin (`top/left: -bleed` + `transformOrigin:
  // "0% 0%"`), ce qu'Android n'honore pas : il met l'échelle au centre quoi
  // qu'on écrive. L'ancrage au centre lève cette divergence — il ne réglait pas,
  // en revanche, l'absence de lueur qu'on lui a longtemps imputée : celle-là
  // venait des unités du SVG, voir l'en-tête.
  //
  // Le centre du halo est celui de la carte, par construction : la boîte
  // déborde d'autant de chaque côté. S'y ancrer donne donc EXACTEMENT la même
  // géométrie finale qu'avant sur tvOS, sans plus rien devoir à une propriété
  // que les deux plateformes n'interprètent pas pareil.
  return (
    <View
      style={{
        position: "absolute",
        left: cardW / 2 - w / 2,
        top: cardH / 2 - h / 2,
        width: w,
        height: h,
        transform: [{ scale: k }],
      }}
    >
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <Filter id="halo" x={0} y={0} width={w} height={h} filterUnits="userSpaceOnUse">
            <FeGaussianBlur stdDeviation={stdDeviation} />
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
