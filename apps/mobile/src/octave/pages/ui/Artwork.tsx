/**
 * Octave mobile — une pochette : `expo-image` (cache mémoire + disque), la
 * place RÉSERVÉE à sa taille (rien ne bouge à l'arrivée), un fond d'attente
 * calme puis un fondu court. Sans image : la note de musique dessinée, jamais
 * une case vide. Ronde pour un artiste.
 */

import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Disc3, Mic2 } from "lucide-react-native";
import { useTheme } from "@/theme";
import { useArtworkResolver } from "../env/pagesEnv";

interface ArtworkProps {
  url: string | null | undefined;
  size: number | "fill";
  round?: boolean;
  radius?: number;
  kind?: "album" | "artist";
  style?: StyleProp<ViewStyle>;
}

export const Artwork = memo(function Artwork({ url, size, round, radius = 8, kind = "album", style }: ArtworkProps) {
  const theme = useTheme();
  const resolve = useArtworkResolver();
  const src = resolve(url);
  const box: ViewStyle = size === "fill" ? { width: "100%", aspectRatio: 1 } : { width: size, height: size };
  const r = round ? 9999 : radius;
  const Fallback = kind === "artist" ? Mic2 : Disc3;
  const glyph = size === "fill" ? 36 : Math.max(16, Math.round(size * 0.34));
  return (
    <View style={[box, { borderRadius: r, backgroundColor: theme.colors.surface.s2, overflow: "hidden" }, style]}>
      {src ? (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} cachePolicy="memory-disk" recyclingKey={src} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Fallback size={glyph} color={theme.colors.text.quaternary} strokeWidth={1.6} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
