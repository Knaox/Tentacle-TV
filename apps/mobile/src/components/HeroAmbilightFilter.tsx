import { memo } from "react";
import { PixelRatio, Platform, View } from "react-native";
import { androidBlurSetting } from "@tentacle-tv/tv-core";
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
  /** La saturation de la référence (`saturate(1.7)` en sombre). */
  saturation: number;
  /** Largeur de la source Jellyfin : elle fixe la sous-échelle de rendu. */
  sourceW: number;
  onReady: () => void;
}

/** Trois σ : au-delà, la gaussienne ne dépose plus rien de visible. */
const REACH = 3;

/**
 * Le halo, pipeline LITTÉRAL de la référence : un flou gaussien qui déborde
 * vraiment de son rectangle, et la saturation qui va avec.
 *
 * Port de `apps/tv/src/components/hero/TVHeroAmbilightFilter.tsx` — les
 * clients natifs ne partagent pas encore de package de composants ; toute
 * correction ici se reporte LÀ-BAS, et réciproquement.
 *
 * L'image est posée EXACTEMENT sur le rectangle de la carte, comme sur le web.
 * Ce qui déborde n'est donc pas une copie agrandie : c'est la lumière que le
 * flou étale hors du cadre — alpha compris, puisqu'une gaussienne floute aussi
 * la transparence. L'extinction est gratuite et exacte, sans aucune couche.
 *
 * Le rendu se fait à 1/K puis la vue remet à l'échelle — même truc que le
 * `12.5%` + `scale(8)` du web, et ici doublement nécessaire : `stdDeviation`
 * est un nombre de pixels du bitmap de filtre. À l'échelle de l'écran il
 * vaudrait 48 ; en sous-échelle il reste dans les clous partout.
 *
 * Les deux plateformes l'empruntent, mais pas avec la même valeur de flou :
 * Android n'applique pas l'échelle d'écran à `stdDeviation` et sature son
 * rayon à 25 sans le dire. La valeur y est donc pré-compensée et le canevas
 * réduit d'autant qu'il faut — voir `androidBlurSetting`. iOS reçoit
 * exactement la valeur naturelle.
 *
 * # Le `viewBox`, et pourquoi il n'est pas décoratif
 *
 * Sans lui, les nombres écrits dans le SVG ne sont PAS ceux de la mise en
 * page. `react-native-svg` résout une longueur nue dans sa propre échelle
 * (`mScale`, la densité que lui rapporte l'affichage) ; React Native, lui,
 * pose la vue dans son espace de points. Sur l'Android TV de banc les deux ne
 * coïncidaient pas — l'image était dessinée à une échelle, la boîte censée la
 * contenir à une autre. L'image débordait sa propre région de filtre : la
 * gaussienne n'avait plus de vide où s'éteindre. À l'écran : une DALLE pleine,
 * à bords francs, tout autour de la carte (mesures dans le fichier TV).
 *
 * Avec le `viewBox`, l'unité utilisateur est arrimée au viewport et les deux
 * espaces se rejoignent : extinction monotone sur exactement les trois σ
 * prévus. `0 0 w h` sur un viewport de `w × h` est l'identité : rien ne bouge
 * là où le halo était déjà juste.
 */
export const HeroAmbilightFilter = memo(function HeroAmbilightFilter({
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
  // le rayon par deux au lieu de tenir compte de RenderScript et de la
  // densité, là où sa branche Apple applique l'échelle d'écran. Le détail, et
  // la mesure de l'écart, sont dans `androidBlurSetting`. iOS garde la valeur
  // naturelle.
  const natural = { k: Math.max(1, Math.round(cardW / sourceW)), stdDeviation: 0 };
  const setting =
    Platform.OS === "android"
      ? androidBlurSetting(sigma, cardW, sourceW, PixelRatio.get())
      : { ...natural, stdDeviation: sigma / natural.k };
  const { k, stdDeviation } = setting;
  const bleed = REACH * sigma;
  const w = (cardW + 2 * bleed) / k;
  const h = (cardH + 2 * bleed) / k;
  const margin = bleed / k;

  // Posé par son CENTRE, et mis à l'échelle autour de ce centre : Android met
  // l'échelle au centre quoi qu'on écrive dans `transformOrigin` — s'ancrer au
  // centre donne la même géométrie finale sur toutes les plateformes. Le
  // centre du halo est celui de la carte, par construction : la boîte déborde
  // d'autant de chaque côté.
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
          x={margin}
          y={margin}
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
