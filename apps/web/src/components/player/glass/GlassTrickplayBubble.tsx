import { useMemo } from "react";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import { formatDuration } from "../../playerControls/utils";
import type { TrickplayFrame } from "../../../hooks/useTrickplay";
import { GlassSurface } from "./GlassSurface";

interface GlassTrickplayBubbleProps {
  visible: boolean;
  positionSeconds: number;
  frame: TrickplayFrame | null;
  info: TrickplayInfo | null;
  anchorX: number;
  parentWidth: number;
}

/** Même largeur d'image que la vignette d'avant (`TrickplayPreview`). */
const DISPLAY_WIDTH = 256;
const TIME_ONLY_WIDTH = 64;
/** Le liseré de verre autour de l'image (`--lg-player-trickplay-inset`, à l'identique). */
const INSET = 5;
const GAP_TO_SEEKBAR = 18;

/**
 * La vignette du survol de la barre, SERTIE dans une bulle de verre : l'image
 * au-dessus, le temps dessous, sur la matière native — comme les aperçus de
 * macOS 26. Elle suit le curseur : sa région se recale à chaque image
 * (`transition` nulle, sans quoi le verre courrait après l'image).
 *
 * Ni flèche ni ombre : la bulle se détache par la matière ; une ombre floue
 * sortirait en aplat noir sur la surface à alpha (`videoShadow.ts`).
 */
export function GlassTrickplayBubble({ visible, positionSeconds, frame, info, anchorX, parentWidth }: GlassTrickplayBubbleProps) {
  const hasFrame = frame !== null && info !== null;
  const scale = hasFrame ? DISPLAY_WIDTH / info.Width : 1;
  const imageHeight = hasFrame ? Math.round(info.Height * scale) : 0;
  const width = (hasFrame ? DISPLAY_WIDTH : TIME_ONLY_WIDTH) + INSET * 2;

  const left = useMemo(
    () => Math.max(0, Math.min(anchorX - width / 2, Math.max(0, parentWidth - width))),
    [anchorX, parentWidth, width],
  );

  return (
    <div aria-hidden="true" className="lgp-trickplay" data-visible={visible} style={{ left, bottom: GAP_TO_SEEKBAR, width }}>
      <GlassSurface className="lgp-trickplay__bubble" present={visible} group="player-trickplay">
        {hasFrame && (
          <div
            className="lgp-trickplay__frame"
            style={{
              height: imageHeight,
              backgroundImage: `url(${frame.url})`,
              backgroundSize: `${Math.round(info.Width * info.TileWidth * scale)}px ${Math.round(info.Height * info.TileHeight * scale)}px`,
              backgroundPosition: `-${Math.round(frame.xInTile * scale)}px -${Math.round(frame.yInTile * scale)}px`,
            }}
          />
        )}
        <span className="lgp-time lgp-trickplay__time">{formatDuration(positionSeconds)}</span>
      </GlassSurface>
    </div>
  );
}
