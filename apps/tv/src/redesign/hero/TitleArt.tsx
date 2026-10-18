import { memo } from "react";
import { Image, Text } from "react-native";
import { text } from "../theme/tokens";
import { useImageAspect } from "./useImageAspect";

/**
 * Le titre d'une œuvre en grand : son logo quand Jellyfin en a un (aligné à
 * gauche, à sa vraie proportion, borné en largeur ET en hauteur), sinon le
 * titre en toutes lettres, en très grand — aussi quand `acceptsLogo` refuse
 * son logo (la zone d'aperçu : trop étroit pour se lire, tv-core
 * `previewZoneUsesLogo`).
 */
export const TitleArt = memo(function TitleArt({
  title,
  logoUri,
  maxWidth,
  maxHeight,
  fontSize,
  acceptsLogo,
}: {
  title: string;
  logoUri?: string;
  maxWidth: number;
  maxHeight: number;
  fontSize?: number;
  /** Le logo de ce rapport largeur / hauteur se pose ; sinon, le titre écrit. */
  acceptsLogo?: (aspect: number) => boolean;
}) {
  const aspect = useImageAspect(logoUri, 2.8);
  if (logoUri && (!acceptsLogo || acceptsLogo(aspect))) {
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
