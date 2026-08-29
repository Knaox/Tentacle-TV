import { memo, useCallback, useState } from "react";
import { useWindowDimensions, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { TV_BANNER_CARD, TV_RADIUS, withAlpha } from "@tentacle-tv/theme";
import { Colors, Spacing } from "../../theme/colors";
import { TVHeroAmbilight } from "./TVHeroAmbilight";
import { useMontageDiffere } from "../../hooks/useMontageDiffere";

interface TVBannerCardFrameProps {
  /** Hauteur de la carte, en centièmes de la hauteur d'écran (62 accueil,
   *  44 bibliothèque — `TV_BANNER_CARD`). */
  heightVh: number;
  /** Backdrop en PETITE taille (`TV_AMBILIGHT.sourceWidth`) : le halo est une
   *  copie floutée, un original fin n'apporterait rien — même économie que le
   *  web, à ceci près qu'en natif le noyau de flou se quantifie sur la source,
   *  ce qui interdit de descendre aussi bas que les 128 px du navigateur. */
  ambilightUri?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * La carte bannière — le cadre commun de l'accueil et de la bibliothèque.
 *
 * Sur ces écrans, la bannière n'est pas le fond de la page : c'est le premier
 * élément d'une liste. Une carte arrondie, cernée d'un liseré de marque et de
 * son halo, dit cela ; une image plein écran dit « vous êtes dans une fiche »
 * (la fiche, elle, reste plein cadre — `TV_DETAIL_BANNER`).
 *
 * Le halo est monté en FRÈRE PRÉCÉDENT de la carte : peint dessous, il ne
 * dépasse que par son débordement flouté. C'est l'ordre que la LG a dû rétablir
 * pour sa bibliothèque (`library-tv.css`) — on naît du bon côté.
 */
export const TVBannerCardFrame = memo(function TVBannerCardFrame({
  heightVh,
  ambilightUri,
  children,
  style,
}: TVBannerCardFrameProps) {
  const { height: screenH } = useWindowDimensions();
  const height = Math.round((screenH * heightVh) / 100);

  // Le halo se dimensionne sur la carte MESURÉE, pas sur des points en dur :
  // l'espace de points d'un téléviseur n'est pas celui d'un autre — la même
  // dalle 1920×1080 se compose en 1920 pt sur l'Android TV de banc
  // (`PixelRatio.get()` y rend 1) et un débordement écrit en dur y changerait
  // de taille d'un appareil au suivant.
  const [cardW, setCardW] = useState(0);
  const mesurer = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setCardW((precedent) => (precedent === w ? precedent : w));
  }, []);

  // Le halo attend que l'écran soit interactif. C'est un flou gaussien SVG :
  // monté avec le reste, sa passe de rastérisation tombe pile dans l'instant
  // où l'on veut voir la page arriver. Il entre en fondu sur 1,4 s de toute
  // façon — le décalage ne se voit pas, l'attente en moins se voit.
  const haloMontable = useMontageDiffere();

  return (
    <View
      style={[{ height, marginHorizontal: Spacing.rowGutter }, style]}
      onLayout={mesurer}
    >
      {haloMontable && (
        <TVHeroAmbilight
          uri={ambilightUri}
          cardW={cardW}
          cardH={height}
          opacity={TV_BANNER_CARD.haloOpacity}
        />
      )}
      <View
        style={{
          flex: 1,
          borderRadius: TV_RADIUS.lg,
          borderWidth: 1,
          borderColor: withAlpha(
            Colors.accentPurple,
            TV_BANNER_CARD.borderOpacity,
            "rgba(139, 92, 246, 0.22)",
          ),
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
});
