import { useState } from "react";
import { View, Image, type ImageStyle } from "react-native";
import { Colors } from "../../theme/colors";

interface TVCardImageProps {
  /** `null` = la donnée PROUVE qu'il n'y a pas d'image : repli direct, zéro requête. */
  uri: string | null;
  style?: ImageStyle;
}

/**
 * Image wrapper for cards: dark placeholder fill + lazy load + error fallback.
 *
 * Why not the existing SkeletonLoader: that component animates a shimmer over a
 * fixed-height pill — not a fit for arbitrary aspect-ratio image slots.
 *
 * `uri` nul : le résolveur partagé (`cardImage.ts`) a conclu à l'absence — on
 * rend le repli d'emblée, sans requête vouée au 404 (même règle que le web,
 * où une rangée en cours d'indexation Jellyfin partait en rafale de 404).
 *
 * L'échec est attaché à l'ADRESSE, pas au composant : les listes recyclent
 * leurs rangées, et un `errored` qui ne redescend jamais collait le repli sur
 * l'item suivant, parfaitement valide (même leçon que `CardImage` web).
 */
export function TVCardImage({ uri, style }: TVCardImageProps) {
  const [failed, setFailed] = useState({ uri, errored: false });
  if (failed.uri !== uri) setFailed({ uri, errored: false });
  const setErrored = () => setFailed({ uri, errored: true });

  if (failed.errored || uri === null) {
    return (
      <View
        style={[
          {
            backgroundColor: Colors.bgElevated,
            justifyContent: "center",
            alignItems: "center",
          },
          style as object,
        ]}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[{ backgroundColor: Colors.bgElevated }, style as object]}
      resizeMode="cover"
      // Android (Fresco) fond CHAQUE image sur 300 ms par défaut : sur une
      // rangée qui défile, c'est autant de couches redessinées à chaque image
      // pendant un tiers de seconde, pour une transition que personne n'a
      // demandée. Les cartes apparaissent d'un coup, comme sur tvOS.
      fadeDuration={0}
      onError={setErrored}
    />
  );
}
