import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { resolveResumeSprite, type TrickplayManifest } from "@tentacle-tv/shared";
import type { LocalTrickplay } from "@/hooks/offline/useLocalTrickplay";

interface Props {
  local: LocalTrickplay;
  positionTicks: number;
}

/**
 * La vignette EXACTE d'une reprise, rognée dans une planche trickplay gardée
 * sur l'appareil — la même case que l'aperçu de la barre de lecture, zéro
 * réseau. Le parent porte `overflow: hidden` : la planche entière est posée
 * derrière lui, décalée pour n'en montrer qu'une case, à l'échelle du cadre.
 */
export function ResumeSpriteImage({ local, positionTicks }: Props) {
  const [boxWidth, setBoxWidth] = useState(0);
  const sprite = useMemo(() => {
    const manifest: TrickplayManifest = { [local.mediaSourceId]: { [String(local.width)]: local.info } };
    return resolveResumeSprite(manifest, positionTicks, local.mediaSourceId);
  }, [local, positionTicks]);
  if (!sprite) return null;

  const { info } = sprite.selection;
  const scale = boxWidth > 0 ? boxWidth / info.Width : 0;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      {scale > 0 && (
        <Image
          source={{ uri: local.tileUri(sprite.tileIndex) }}
          style={{
            position: "absolute",
            left: -Math.round(sprite.col * info.Width * scale),
            top: -Math.round(sprite.row * info.Height * scale),
            width: Math.round(info.Width * info.TileWidth * scale),
            height: Math.round(info.Height * info.TileHeight * scale),
          }}
          contentFit="fill"
          cachePolicy="none"
          transition={0}
        />
      )}
    </View>
  );
}
