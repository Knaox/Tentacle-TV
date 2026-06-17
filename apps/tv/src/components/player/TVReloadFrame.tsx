import { memo } from "react";
import { View, Image } from "react-native";
import type { UseTVTrickplayResult } from "../../hooks/useTVTrickplay";

interface TVReloadFrameProps {
  /** Trickplay (vignettes) — source de l'image figée. */
  trickplay?: UseTVTrickplayResult;
  /** Position figée à afficher (secondes) — capturée au début du reload. */
  positionSeconds: number | null;
  /** Dimensions de la zone vidéo (mêmes que le player) pour aligner l'image. */
  width: number;
  height: number;
}

/**
 * Image figée affichée pendant un reload « doux » (changement de piste audio /
 * qualité) : AVPlayer remplace l'item et passe au noir le temps du re-buffer.
 * On masque ce noir par la vignette trickplay de la position courante → l'écran
 * garde « la dernière image » (basse résolution mais continuité visuelle), avec
 * le spinner par-dessus. No-op si pas de trickplay pour ce média.
 */
function TVReloadFrameImpl({ trickplay, positionSeconds, width, height }: TVReloadFrameProps) {
  if (positionSeconds == null || !trickplay) return null;
  const info = trickplay.info;
  const frame = trickplay.getFrameAt(positionSeconds * 1000);
  if (!info || !frame) return null;

  // Crop de la mosaïque (même principe que TVTrickplayPreview) mais mis à
  // l'échelle de la zone vidéo pour remplir l'écran.
  const scale = width / info.Width;
  const mosaicWidth = Math.round(info.Width * info.TileWidth * scale);
  const mosaicHeight = Math.round(info.Height * info.TileHeight * scale);
  const offsetX = -Math.round(frame.xInTile * scale);
  const offsetY = -Math.round(frame.yInTile * scale);

  return (
    <View
      pointerEvents="none"
      style={{
        width, height,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <Image
        source={{ uri: frame.url }}
        style={{ position: "absolute", left: offsetX, top: offsetY, width: mosaicWidth, height: mosaicHeight }}
        resizeMode="stretch"
        fadeDuration={0}
      />
    </View>
  );
}

export const TVReloadFrame = memo(TVReloadFrameImpl);
