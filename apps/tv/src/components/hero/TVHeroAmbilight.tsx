import { memo } from "react";
import { Image, View } from "react-native";
import { TV_AMBILIGHT_BLUR } from "@tentacle-tv/theme";

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

const DEBORDEMENT = 56;
const OPACITE = 0.55;

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
    </View>
  );
});
