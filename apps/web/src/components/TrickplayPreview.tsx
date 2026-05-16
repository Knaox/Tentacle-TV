import { memo, useMemo } from "react";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import { formatDuration } from "./playerControls/utils";
import type { TrickplayFrame } from "../hooks/useTrickplay";

interface TrickplayPreviewProps {
  visible: boolean;
  /** Position in seconds (matches the seekbar API). */
  positionSeconds: number;
  /** null when trickplay is unavailable — component falls back to timestamp-only. */
  frame: TrickplayFrame | null;
  info: TrickplayInfo | null;
  /** Pointer X position (px) inside the parent seekbar container. */
  anchorX: number;
  /** Width of the parent seekbar container (px), used for edge clamping. */
  parentWidth: number;
  /** Touch interaction → lift the preview a bit higher to avoid finger occlusion. */
  isTouch?: boolean;
}

// Netflix-style sizing: 256px wide preview — substantial without being intrusive.
// Change DISPLAY_WIDTH alone to resize: height, background scale, position,
// clamping and pointer all derive from it.
const DISPLAY_WIDTH = 256;
const TIMESTAMP_PILL_WIDTH = 64;
const TIMESTAMP_PILL_HEIGHT = 26;
const POINTER_SIZE = 6;
// `bottom` is relative to the seekbar bottom edge — only the GAP is needed,
// the element's own height extends upward implicitly.
const GAP_TO_SEEKBAR = 22;
const TOUCH_EXTRA_OFFSET = 28;

const ENTER_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Tile mosaic preview shown above the seekbar at hover/scrub.
 * Netflix-inspired: 256px wide, thin white outline + deep black shadow,
 * timestamp overlaid inside the bottom of the frame for compactness.
 */
function TrickplayPreviewImpl({
  visible,
  positionSeconds,
  frame,
  info,
  anchorX,
  parentWidth,
  isTouch = false,
}: TrickplayPreviewProps) {
  const hasFrame = frame !== null && info !== null;

  // Downscale the native-resolution tile to a consistent display width.
  const scale = hasFrame ? DISPLAY_WIDTH / info.Width : 1;
  const cardWidth = hasFrame ? DISPLAY_WIDTH : TIMESTAMP_PILL_WIDTH;
  const cardHeight = hasFrame
    ? Math.round(info.Height * scale)
    : TIMESTAMP_PILL_HEIGHT;

  const totalWidth = Math.max(cardWidth, TIMESTAMP_PILL_WIDTH);

  const left = useMemo(() => {
    const min = 0;
    const max = Math.max(0, parentWidth - totalWidth);
    return Math.max(min, Math.min(anchorX - totalWidth / 2, max));
  }, [anchorX, parentWidth, totalWidth]);

  const pointerLeft = useMemo(() => {
    const raw = anchorX - left;
    return Math.max(POINTER_SIZE * 2, Math.min(raw, totalWidth - POINTER_SIZE * 2));
  }, [anchorX, left, totalWidth]);

  // KEY FIX: bottom only contains the gap, not the height.
  // The element grows upward from this point on its own.
  const bottomOffset = GAP_TO_SEEKBAR + (isTouch ? TOUCH_EXTRA_OFFSET : 0);

  const transform = visible
    ? "translateY(0) scale(1)"
    : "translateY(3px) scale(0.96)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 flex flex-col items-center motion-reduce:transition-none"
      style={{
        left,
        bottom: bottomOffset,
        width: totalWidth,
        opacity: visible ? 1 : 0,
        transform,
        transformOrigin: "bottom center",
        transition: visible
          ? `opacity 160ms ease-out, transform 200ms ${ENTER_EASING}`
          : "opacity 110ms ease-in, transform 130ms ease-in",
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}
    >
      {hasFrame ? (
        <div
          className="relative overflow-hidden rounded-md bg-black"
          style={{
            width: cardWidth,
            height: cardHeight,
            boxShadow:
              "0 0 0 1px var(--text-disabled), 0 14px 40px -10px rgba(0,0,0,0.85), 0 4px 12px -2px rgba(0,0,0,0.6)",
            backgroundImage: `url(${frame.url})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${Math.round(info.Width * info.TileWidth * scale)}px ${Math.round(info.Height * info.TileHeight * scale)}px`,
            backgroundPosition: `-${Math.round(frame.xInTile * scale)}px -${Math.round(frame.yInTile * scale)}px`,
          }}
        >
          {/* Bottom gradient + timestamp INSIDE the frame for compactness */}
          <div
            className="absolute inset-x-0 bottom-0 flex justify-center px-2 pb-1.5 pt-4"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0) 100%)",
            }}
          >
            <span
              className="text-[13px] font-semibold leading-none text-white"
              style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.01em",
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              }}
            >
              {formatDuration(positionSeconds)}
            </span>
          </div>

          {/* Subtle top highlight for depth */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)" }}
          />
        </div>
      ) : (
        // No trickplay: standalone timestamp pill
        <div
          className="flex items-center justify-center rounded-md bg-black/85 px-2.5 backdrop-blur-sm"
          style={{
            height: TIMESTAMP_PILL_HEIGHT,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.18), 0 6px 16px -4px var(--surface-overlay)",
          }}
        >
          <span
            className="text-[12px] font-semibold leading-none text-white"
            style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.01em" }}
          >
            {formatDuration(positionSeconds)}
          </span>
        </div>
      )}

      {/* Pointer arrow under the frame — anchored under the cursor */}
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          left: pointerLeft - POINTER_SIZE,
          bottom: -POINTER_SIZE + 1,
          width: POINTER_SIZE * 2,
          height: POINTER_SIZE,
        }}
      >
        <div
          className="h-full w-full"
          style={{
            background: hasFrame ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.85)",
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
            filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.12))",
          }}
        />
      </div>
    </div>
  );
}

export const TrickplayPreview = memo(TrickplayPreviewImpl);
