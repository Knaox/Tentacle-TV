import { useState } from "react";
import { View, Image, type ImageStyle } from "react-native";
import { Colors } from "../../theme/colors";

interface TVCardImageProps {
  uri: string;
  style?: ImageStyle;
}

/**
 * Image wrapper for cards: dark placeholder fill + lazy load + error fallback.
 *
 * Why not the existing SkeletonLoader: that component animates a shimmer over a
 * fixed-height pill — not a fit for arbitrary aspect-ratio image slots.
 */
export function TVCardImage({ uri, style }: TVCardImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
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
      onError={() => setErrored(true)}
    />
  );
}
