import { memo } from "react";
import {
  Image,
  PixelRatio,
  Platform,
  View,
  type ImageLoadEventData,
  type NativeSyntheticEvent,
} from "react-native";
import { rampeHalo, rayonFlou, sigmaSource, sousEchelle } from "@tentacle-tv/tv-core";
import { TV_RADIUS } from "@tentacle-tv/theme";

interface Props {
  uri: string;
  cardW: number;
  cardH: number;
  rampe: ReturnType<typeof rampeHalo>;
  /** Largeur du bitmap effectivement décodé (relevée au chargement). */
  sourceW: number;
  onSourceWidth: (w: number) => void;
  onReady: () => void;
}

/**
 * Le halo par COUCHES — le chemin portable, sans dépendre d'aucun filtre.
 *
 * `blurRadius` ne déborde pas de son rectangle : l'arête reste franche. On
 * reconstruit donc l'extinction avec des rectangles concentriques qui montrent
 * tous la MÊME image au MÊME cadrage — seule leur découpe change, ce qui
 * supprime les coutures qu'un `cover` par couche produisait — et dont les
 * alphas suivent la gaussienne qu'un vrai flou aurait laissée.
 *
 * Deux pièges, tous deux payés d'une régression :
 *
 * 1. `blurRadius` compte en pixels du BITMAP DÉCODÉ, pas de l'écran. Le rayon
 *    se calcule donc sur la largeur RÉELLE de la source (relevée au
 *    chargement : le mode économie de données rétrécit ce que Jellyfin
 *    renvoie) et par plateforme — iOS fait trois passes de boîte, Android deux.
 * 2. L'ensemble est rendu à 1/K puis remis à l'échelle : le cache rastérisé
 *    coûte K² fois moins, et sa magnification bilinéaire transforme ce qui
 *    reste de marches en rampes. C'est le pendant natif du `12.5% + scale(8)`
 *    du web.
 */
export const TVHeroAmbilightCouches = memo(function TVHeroAmbilightCouches({
  uri,
  cardW,
  cardH,
  rampe,
  sourceW,
  onSourceWidth,
  onReady,
}: Props) {
  const boiteW = cardW + 2 * rampe.bleed;
  const boiteH = cardH + 2 * rampe.bleed;
  const k = sousEchelle(rampe.couches);
  const flou = rayonFlou(
    sigmaSource(rampe.sigma, boiteW, sourceW),
    Platform.OS === "ios" ? "ios" : "android",
    PixelRatio.get(),
  );

  return (
    <View
      style={{
        position: "absolute",
        top: -rampe.bleed,
        left: -rampe.bleed,
        width: boiteW / k,
        height: boiteH / k,
        transform: [{ scale: k }],
        transformOrigin: "0% 0%",
      }}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      {rampe.couches.map(({ d, opacity: alpha }, i) => {
        const retrait = (rampe.bleed - d) / k;
        return (
          <View
            key={d}
            style={{
              position: "absolute",
              top: retrait,
              left: retrait,
              right: retrait,
              bottom: retrait,
              borderRadius: (TV_RADIUS.lg + d) / k,
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri }}
              blurRadius={flou}
              resizeMode="cover"
              // Sans cela, Fresco redimensionnerait le bitmap et le rayon
              // calculé pour la source ne vaudrait plus rien.
              resizeMethod="scale"
              style={{
                position: "absolute",
                top: -retrait,
                left: -retrait,
                width: boiteW / k,
                height: boiteH / k,
                // L'opacité vit sur la FEUILLE : une vue intermédiaire à
                // opacité partielle force une passe de groupe hors écran.
                opacity: alpha,
              }}
              onLoad={
                i === 0
                  ? (e: NativeSyntheticEvent<ImageLoadEventData>) => {
                      const w = e.nativeEvent.source?.width;
                      if (w) onSourceWidth(w);
                      onReady();
                    }
                  : undefined
              }
            />
          </View>
        );
      })}
    </View>
  );
});
