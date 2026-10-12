import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { DetailImageRef } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme, withAlpha } from "../../theme";

/**
 * Les visuels de REPLI de la fiche, pour un titre sans images (Jellyfin ne
 * les a pas encore trouvées) — les mêmes que le web : un décor de marque
 * statique sous les voiles de la scène, une affiche au dégradé de marque avec
 * le titre. Jamais une case grise, jamais un décor demandé pour rien (le
 * 404 de `Backdrop` d'un titre qui n'en a pas).
 */

/** Le décor de marque : deux halos sur le fond de page, rien d'animé. */
export const DetailBackdropFallback = memo(function DetailBackdropFallback() {
  const theme = useTheme();
  const { brand, surface } = theme.colors;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.s0 }]}>
      <LinearGradient
        colors={[withAlpha(brand.violet, 0.42, brand.violet), withAlpha(brand.violet, 0, brand.violet)]}
        start={{ x: 0.85, y: 0.15 }}
        end={{ x: 0.2, y: 0.75 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[withAlpha(brand.accent, 0, brand.accent), withAlpha(brand.accent, 0.3, brand.accent)]}
        start={{ x: 0.2, y: 0.4 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

/**
 * Le décor de la scène : le premier décor de la galerie (le sien, sinon
 * celui de la série), adressé par son tag — ou le repli, sans décor ou en
 * échec.
 */
export const DetailBackdropImage = memo(function DetailBackdropImage({ decor }: { decor: DetailImageRef | undefined }) {
  const client = useJellyfinClient();
  const uri = decor
    ? client.getImageUrl(decor.itemId, "Backdrop", { width: 1200, quality: 85, ...(decor.tag ? { tag: decor.tag } : {}) })
    : null;
  const [failed, setFailed] = useState<string | null>(null);
  if (!uri || failed === uri) return <DetailBackdropFallback />;
  return (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      contentPosition={{ top: "30%", left: "50%" }}
      transition={400}
      onError={() => setFailed(uri)}
    />
  );
});

/** L'affiche de repli (colonne gauche de l'iPad paysage) : dégradé de marque et titre. */
export const DetailPosterFallback = memo(function DetailPosterFallback({ title, width, height, radius }: {
  title: string;
  width: number;
  height: number;
  radius: number;
}) {
  const theme = useTheme();
  const { brand } = theme.colors;
  return (
    <LinearGradient
      // Base SOMBRE fixe dans les deux thèmes : c'est une image, le titre
      // blanc y garde son contraste (comme sur le web).
      colors={[withAlpha(brand.violet, 0.75, brand.violet), "#1a1226", withAlpha(brand.accent, 0.6, brand.accent)]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ width, height, borderRadius: radius, alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <Text numberOfLines={3} style={{ color: "#FFFFFF", fontFamily: FONT_FAMILY.bold, fontSize: 18, textAlign: "center" }}>
        {title}
      </Text>
    </LinearGradient>
  );
});
