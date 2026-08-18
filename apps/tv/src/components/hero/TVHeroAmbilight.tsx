import { memo } from "react";
import { Image, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { TV_AMBILIGHT_BLUR } from "@tentacle-tv/theme";
import { Colors } from "../../theme/colors";

interface TVHeroAmbilightProps {
  /** L'image de la bannière. Le halo en est une copie floutée, pas une autre. */
  uri?: string;
  /** Rayon des angles de la carte, pour que la lueur en épouse la forme. */
  radius: number;
  /** Débordement de la lueur au-delà du cadre, en points. */
  bleed?: number;
  /** Opacité de la lueur. Réglée au-dessous de 1 : c'est une lueur, pas un
   *  second fond — l'image nette doit rester le sujet. */
  opacity?: number;
}

const DEBORDEMENT = 110;
const OPACITE = 0.55;
/** Fraction du débordement occupée par le fondu vers le noir. */
const PART_FONDU = 0.82;

/**
 * Le halo de bannière — la lueur qui fond le bord de la carte dans la page.
 *
 * Sur la LG, l'effet s'écrit en CSS : l'image est reprise, floutée à 48 px,
 * saturée, et laissée déborder derrière le cadre en mode de fusion « écran ».
 * Aucune de ces trois choses n'existe telle quelle en React Native — et il se
 * trouve que ça n'a pas d'importance.
 *
 * **Le flou** est natif : `blurRadius` sur une `Image`. Il est appliqué UNE FOIS
 * à l'image décodée puis mis en cache, au lieu d'être une passe de compositing
 * par image comme le `filter` CSS. La version native coûte donc moins cher que
 * celle de la LG, ce qui va dans le sens de la règle du dépôt : ce qui n'est pas
 * regardé ne doit rien consommer.
 *
 * **Le mode de fusion « écran »** est inutile ici. `screen(a, 0) = a` : sur du
 * noir, il ne fait rien. Le fond du téléviseur est `#000000`, et le halo ne
 * déborde que sur lui — là où il recouvrirait autre chose, le dégradé de
 * l'estompage l'a déjà éteint. Un rendu normal produit donc les mêmes pixels.
 * (Il n'existe de toute façon pas : `mixBlendMode` demande la nouvelle
 * architecture, et l'application tourne sur l'ancienne.)
 *
 * **La saturation** est le seul écart réel. Elle compense sur le web le
 * délavage dû au flou ; `react-native-svg` saurait le faire, mais son filtre de
 * flou diverge entre iOS et Android (issue amont #2636, ouverte). On s'en passe
 * et on rattrape à l'opacité — un halo à 48 px de flou n'a plus de détail dont
 * la couleur puisse manquer.
 */
export const TVHeroAmbilight = memo(function TVHeroAmbilight({
  uri,
  radius,
  bleed = DEBORDEMENT,
  opacity = OPACITE,
}: TVHeroAmbilightProps) {
  if (!uri) return null;

  // Écart réel avec le CSS : `blur(48px)` fait déborder la LUMIÈRE au-delà du
  // rectangle et s'y éteint tout seul ; `blurRadius` floute DANS le rectangle,
  // dont l'arête reste nette. Sans correction, le halo se lit comme une dalle
  // sombre à bord franc, pas comme une lueur. Les quatre dégradés ci-dessous
  // fondent cette arête vers le noir de la page — même extinction progressive
  // que la référence, pour une passe de composition statique (rien d'animé).
  const fondu = Math.round(bleed * PART_FONDU);
  const NOIR = Colors.bgDeep;
  const T = "rgba(0, 0, 0, 0)";

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -bleed,
        left: -bleed,
        right: -bleed,
        bottom: -bleed,
        opacity,
        // Sous la carte, jamais devant : la lueur est un fond.
        zIndex: -1,
      }}
    >
      <Image
        source={{ uri }}
        blurRadius={TV_AMBILIGHT_BLUR}
        resizeMode="cover"
        style={{ flex: 1, borderRadius: radius + bleed / 2 }}
      />
      <LinearGradient
        colors={[NOIR, T]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: fondu }}
      />
      <LinearGradient
        colors={[T, NOIR]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: fondu }}
      />
      <LinearGradient
        colors={[NOIR, T]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: fondu }}
      />
      <LinearGradient
        colors={[T, NOIR]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: fondu }}
      />
    </View>
  );
});
