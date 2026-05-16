import { memo, useMemo } from "react";
import { View, Text, Platform } from "react-native";
import { Image } from "expo-image";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import type { TrickplayFrame } from "../../hooks/useTrickplay";

interface TrickplayPreviewProps {
  visible: boolean;
  /** Position in seconds, mirrors the seekbar API. */
  positionSeconds: number;
  /** null → no trickplay available, falls back to standalone timestamp pill. */
  frame: TrickplayFrame | null;
  info: TrickplayInfo | null;
  /** Touch X position (px) inside the parent seekbar container. */
  anchorX: number;
  /** Width of the parent seekbar container (px), for edge clamping. */
  parentWidth: number;
}

// Slightly smaller than the web's 256px since a finger always occludes the
// bottom of a mobile screen — the preview lives higher and a touch wider
// thumbnail would crowd the screen edges in landscape.
const DISPLAY_WIDTH = 224;
const TIMESTAMP_PILL_WIDTH = 64;
const TIMESTAMP_PILL_HEIGHT = 26;
const POINTER_SIZE = 6;
// Lifted higher than the desktop (22px) because a finger sits where the
// pointer arrow would otherwise be.
const GAP_TO_SEEKBAR = 56;

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
 * Mobile port of the web TrickplayPreview. Renders the same Netflix-style
 * tile preview above the seekbar; on iOS + Android we crop the sprite mosaic
 * via an overflow:hidden wrapper + absolutely-positioned <Image> (RN has no
 * equivalent of CSS background-position).
 */
function TrickplayPreviewImpl({
  visible,
  positionSeconds,
  frame,
  info,
  anchorX,
  parentWidth,
}: TrickplayPreviewProps) {
  const hasFrame = frame !== null && info !== null;

  const scale = hasFrame ? DISPLAY_WIDTH / info.Width : 1;
  const cardWidth = hasFrame ? DISPLAY_WIDTH : TIMESTAMP_PILL_WIDTH;
  const cardHeight = hasFrame ? Math.round(info.Height * scale) : TIMESTAMP_PILL_HEIGHT;

  const totalWidth = Math.max(cardWidth, TIMESTAMP_PILL_WIDTH);

  const left = useMemo(() => {
    const max = Math.max(0, parentWidth - totalWidth);
    return Math.max(0, Math.min(anchorX - totalWidth / 2, max));
  }, [anchorX, parentWidth, totalWidth]);

  const pointerLeft = useMemo(() => {
    const raw = anchorX - left;
    return Math.max(POINTER_SIZE * 2, Math.min(raw, totalWidth - POINTER_SIZE * 2));
  }, [anchorX, left, totalWidth]);

  // Mosaic dimensions scaled to display size — Image is sized to the full
  // mosaic and offset by negative left/top so only the right tile is shown
  // through the parent's overflow:hidden window.
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
        width: totalWidth,
        alignItems: "center",
        zIndex: 10,
      }}
    >
      {hasFrame ? (
        <View
          style={{
            width: cardWidth,
            height: cardHeight,
            borderRadius: 6,
            overflow: "hidden",
            backgroundColor: "#000",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.22)",
            // Deep shadow matches web's "0 14px 40px -10px rgba(0,0,0,0.85)"
            ...Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOpacity: 0.85,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
              },
              android: { elevation: 12 },
              default: {},
            }),
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
            contentFit="fill"
            cachePolicy="memory-disk"
            transition={0}
          />

          {/* Bottom gradient + timestamp INSIDE the frame for compactness.
              RN has no native gradients — a 50% black band gives a similar
              read at this size without pulling in another dependency. */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingTop: 16,
              paddingBottom: 6,
              paddingHorizontal: 8,
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.55)",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: "600",
                letterSpacing: 0.1,
                textShadowColor: "rgba(0,0,0,0.6)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatDuration(positionSeconds)}
            </Text>
          </View>

          {/* Subtle top highlight */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 1,
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          />
        </View>
      ) : (
        // No trickplay available — standalone timestamp pill (same as web)
        <View
          style={{
            height: TIMESTAMP_PILL_HEIGHT,
            paddingHorizontal: 10,
            borderRadius: 6,
            backgroundColor: "rgba(0,0,0,0.85)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            justifyContent: "center",
            alignItems: "center",
            ...Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOpacity: 0.7,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 4 },
              },
              android: { elevation: 6 },
              default: {},
            }),
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 12,
              fontWeight: "600",
              letterSpacing: 0.1,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatDuration(positionSeconds)}
          </Text>
        </View>
      )}

      {/* Pointer arrow under the frame — anchored under the touch */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: pointerLeft - POINTER_SIZE,
          bottom: -POINTER_SIZE + 1,
          width: 0,
          height: 0,
          borderLeftWidth: POINTER_SIZE,
          borderRightWidth: POINTER_SIZE,
          borderTopWidth: POINTER_SIZE,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: hasFrame ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.85)",
        }}
      />
    </View>
  );
}

export const TrickplayPreview = memo(TrickplayPreviewImpl);
