import { memo, useMemo } from "react";
import { View, Text, Image } from "react-native";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import type { TVTrickplayFrame } from "../../hooks/useTVTrickplay";
import { Colors } from "../../theme/colors";

interface TVTrickplayPreviewProps {
  visible: boolean;
  /** Position du curseur de scrub, en secondes. */
  positionSeconds: number;
  /** null → pas de trickplay : pastille horodatage seule. */
  frame: TVTrickplayFrame | null;
  info: TrickplayInfo | null;
  /** Position X du curseur (px) dans le conteneur de la seekbar. */
  anchorX: number;
  /** Largeur du conteneur de la seekbar (px), pour le clamp aux bords. */
  parentWidth: number;
}

// Plus large que le mobile (224) : la vignette se regarde à 3 m.
const DISPLAY_WIDTH = 320;
const TIMESTAMP_PILL_WIDTH = 84;
const TIMESTAMP_PILL_HEIGHT = 34;
const GAP_TO_SEEKBAR = 28;

function formatDuration(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Vignette de scrub type Netflix au-dessus de la seekbar (port TV du
 * TrickplayPreview mobile) : crop de la mosaïque via un conteneur
 * overflow:hidden + Image décalée en négatif.
 */
function TVTrickplayPreviewImpl({
  visible, positionSeconds, frame, info, anchorX, parentWidth,
}: TVTrickplayPreviewProps) {
  const hasFrame = frame !== null && info !== null;

  const scale = hasFrame ? DISPLAY_WIDTH / info.Width : 1;
  const cardWidth = hasFrame ? DISPLAY_WIDTH : TIMESTAMP_PILL_WIDTH;
  const cardHeight = hasFrame ? Math.round(info.Height * scale) : TIMESTAMP_PILL_HEIGHT;

  const left = useMemo(() => {
    const max = Math.max(0, parentWidth - cardWidth);
    return Math.max(0, Math.min(anchorX - cardWidth / 2, max));
  }, [anchorX, parentWidth, cardWidth]);

  const mosaicWidth = hasFrame ? Math.round(info.Width * info.TileWidth * scale) : 0;
  const mosaicHeight = hasFrame ? Math.round(info.Height * info.TileHeight * scale) : 0;
  const offsetX = hasFrame ? -Math.round(frame.xInTile * scale) : 0;
  const offsetY = hasFrame ? -Math.round(frame.yInTile * scale) : 0;

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left,
        bottom: GAP_TO_SEEKBAR,
        width: cardWidth,
        alignItems: "center",
        zIndex: 10,
      }}
    >
      {hasFrame ? (
        <View
          style={{
            width: cardWidth,
            height: cardHeight,
            borderRadius: 8,
            overflow: "hidden",
            backgroundColor: "#000",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.85)",
            elevation: 12,
          }}
        >
          <Image
            source={{ uri: frame.url }}
            style={{
              position: "absolute",
              left: offsetX,
              top: offsetY,
              width: mosaicWidth,
              height: mosaicHeight,
            }}
            resizeMode="stretch"
            fadeDuration={0}
          />

          {/* Bandeau horodatage dans la vignette */}
          <View
            style={{
              position: "absolute",
              left: 0, right: 0, bottom: 0,
              paddingTop: 14, paddingBottom: 5,
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.55)",
            }}
          >
            <Text
              style={{
                color: "#fff", fontSize: 15, fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatDuration(positionSeconds)}
            </Text>
          </View>
        </View>
      ) : (
        // Pas de trickplay — pastille horodatage seule
        <View
          style={{
            height: TIMESTAMP_PILL_HEIGHT,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.85)",
            borderWidth: 1,
            borderColor: Colors.glassBorder,
            justifyContent: "center",
            alignItems: "center",
            elevation: 6,
          }}
        >
          <Text
            style={{
              color: "#fff", fontSize: 15, fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatDuration(positionSeconds)}
          </Text>
        </View>
      )}
    </View>
  );
}

export const TVTrickplayPreview = memo(TVTrickplayPreviewImpl);
