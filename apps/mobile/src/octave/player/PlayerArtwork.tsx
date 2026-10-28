/**
 * Octave (mobile) — la pochette d'un titre dans le lecteur : l'adresse authentifiée vers le serveur seulement
 * (`elementSourceUrl` : jamais le jeton chez un hôte tiers), un fondu à l'arrivée, et la note de musique sur le
 * dégradé de la marque tant qu'il n'y a rien.
 */

import { memo, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Music } from "lucide-react-native";
import { elementSourceUrl } from "@tentacle-tv/shared/octave";
import { useMobileEngineAuth } from "../audio/useMobileEngineAuth";
import { useOctaveColors } from "../theme/octaveColors";

interface Props {
  url: string | null | undefined;
  size?: number;
  radius: number;
  style?: StyleProp<ViewStyle>;
  /** Flou de fond (le décor du lecteur plein écran). */
  blurRadius?: number;
  /**
   * D'un titre à l'autre, un FONDU CROISÉ : l'ancienne pochette reste jusqu'à ce que la nouvelle soit là
   * (la grande pochette du lecteur). Sans lui, la pochette repart du dégradé (listes, recyclage).
   */
  crossfade?: boolean;
}

export function useArtworkUri(url: string | null | undefined): string | null {
  const auth = useMobileEngineAuth();
  return useMemo(() => (url ? elementSourceUrl(url, auth) : null), [url, auth]);
}

export const PlayerArtwork = memo(function PlayerArtwork({ url, size, radius, style, blurRadius, crossfade = false }: Props) {
  const colors = useOctaveColors();
  const uri = useArtworkUri(url);
  const box = size === undefined ? null : { width: size, height: size };
  return (
    <View style={[styles.frame, box, { borderRadius: radius, backgroundColor: colors.raised }, style]}>
      <LinearGradient colors={[colors.gradient[0], colors.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.placeholder]}>
        <Music color="rgba(255,255,255,0.85)" size={size === undefined ? 48 : Math.max(16, size * 0.36)} strokeWidth={1.8} />
      </LinearGradient>
      {uri !== null && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={crossfade ? CROSSFADE : 180}
          blurRadius={blurRadius}
          recyclingKey={crossfade ? undefined : uri}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
});

const CROSSFADE = { duration: 360, effect: "cross-dissolve", timing: "ease-in-out" } as const;

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
  placeholder: { alignItems: "center", justifyContent: "center" },
});
