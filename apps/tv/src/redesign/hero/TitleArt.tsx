import { memo } from "react";
import { Image, Text } from "react-native";
import { text } from "../theme/tokens";
import { useImageAspect } from "./useImageAspect";

/**
 * Le titre d'une œuvre en grand : son logo quand Jellyfin en a un (aligné à
 * gauche, à sa vraie proportion, borné en largeur ET en hauteur), sinon le
 * titre en toutes lettres, en très grand.
 */
export const TitleArt = memo(function TitleArt({
  title,
  logoUri,
  maxWidth,
  maxHeight,
  fontSize,
}: {
  title: string;
  logoUri?: string;
  maxWidth: number;
  maxHeight: number;
  fontSize?: number;
}) {
  const aspect = useImageAspect(logoUri, 2.8);
  if (logoUri) {
    const width = Math.min(maxWidth, maxHeight * aspect);
    return (
      <Image
        source={{ uri: logoUri }}
        style={{ width, height: width / aspect }}
        resizeMode="contain"
        accessibilityLabel={title}
        fadeDuration={0}
      />
    );
  }
  return (
    <Text
      style={[text.display, fontSize ? { fontSize, lineHeight: fontSize } : null, { maxWidth }]}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
    >
      {title}
    </Text>
  );
});
