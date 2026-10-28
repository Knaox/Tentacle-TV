/**
 * Octave mobile — une pochette : `expo-image` (cache mémoire + disque), la
 * place RÉSERVÉE à sa taille (rien ne bouge à l'arrivée), un fond d'attente
 * calme puis un fondu court. Sans image : la note de musique dessinée, jamais
 * une case vide. Ronde pour un artiste. Le cache disque est rangé SANS jeton
 * et, hors ligne, la pochette gardée avec le titre passe d'abord (`artworkSource.ts`). Une pochette
 * IMPORTÉE (lot « sf ») est demandée à la taille de sa place (`releaseArtForPixels`).
 */

import { memo } from "react";
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Disc3, Mic2 } from "lucide-react-native";
import { releaseArtForPixels } from "@tentacle-tv/api-client";
import { useTheme } from "@/theme";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useArtworkResolver } from "../env/pagesEnv";
import { artworkSource } from "./artworkSource";

interface ArtworkProps {
  url: string | null | undefined;
  size: number | "fill";
  round?: boolean;
  radius?: number;
  kind?: "album" | "artist";
  style?: StyleProp<ViewStyle>;
  /** La pochette gardée sur l'appareil (titre gardé hors ligne), s'il y en a une. */
  localUrl?: string | null;
}

export const Artwork = memo(function Artwork({ url, size, round, radius = 8, kind = "album", style, localUrl = null }: ArtworkProps) {
  const theme = useTheme();
  const resolve = useArtworkResolver();
  const offline = useOfflineMode();
  // Une pochette importée a ses tailles : celle qui couvre la place (« fill » : la tête d'une page, en grand).
  const sized = url ? releaseArtForPixels(url, size === "fill" ? 1200 : size * PixelRatio.get()) : url;
  const src = artworkSource(resolve(sized), localUrl, offline);
  const box: ViewStyle = size === "fill" ? { width: "100%", aspectRatio: 1 } : { width: size, height: size };
  const r = round ? 9999 : radius;
  const Fallback = kind === "artist" ? Mic2 : Disc3;
  const glyph = size === "fill" ? 36 : Math.max(16, Math.round(size * 0.34));
  return (
    <View style={[box, { borderRadius: r, backgroundColor: theme.colors.surface.s2, overflow: "hidden" }, style]}>
      {src ? (
        <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} cachePolicy="memory-disk" recyclingKey={src.cacheKey ?? src.uri} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Fallback size={glyph} color={theme.colors.text.quaternary} strokeWidth={1.6} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
