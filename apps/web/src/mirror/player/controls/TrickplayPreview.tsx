import { memo, useMemo } from "react";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import type { TrickplayFrame } from "../../../hooks/useTrickplay";
import { PLAYER } from "../playerColors";
import { formatTime } from "../playerMetrics";

interface Props {
  visible: boolean;
  positionSeconds: number;
  /** `null` : pas de planche, la pastille d'horodatage seule. */
  frame: TrickplayFrame | null;
  info: TrickplayInfo | null;
  /** Abscisse du doigt dans la barre (px). */
  anchorX: number;
  /** Largeur de la barre (px), pour borner la vignette aux bords. */
  parentWidth: number;
}

/** Plus étroite que les 256 du web : un doigt couvre toujours le bas de l'écran. */
const DISPLAY_WIDTH = 224;
const PILL_WIDTH = 64;
const PILL_HEIGHT = 26;
const POINTER_SIZE = 6;
/** Plus haut que les 22 du bureau : le doigt est là où serait la flèche. */
const GAP_TO_SEEKBAR = 56;

/**
 * L'aperçu au-dessus de la barre pendant le glissé — `TrickplayPreview` de
 * l'app : vignette 224 de large (rayon 6, filet `border`), l'horodatage 13 px
 * dans un bandeau `controlBg` en bas, flèche de 6 sous le doigt ; sans
 * planche, une pastille 64 × 26. La mosaïque se recadre par
 * `background-position` (l'app, qui n'en a pas, décale une `<Image>`).
 */
export const TrickplayPreview = memo(function TrickplayPreview({
  visible, positionSeconds, frame, info, anchorX, parentWidth,
}: Props) {
  const hasFrame = frame !== null && info !== null;
  const scale = hasFrame ? DISPLAY_WIDTH / info.Width : 1;
  const cardWidth = hasFrame ? DISPLAY_WIDTH : PILL_WIDTH;
  const cardHeight = hasFrame ? Math.round(info.Height * scale) : PILL_HEIGHT;
  const totalWidth = Math.max(cardWidth, PILL_WIDTH);

  const left = useMemo(() => {
    const max = Math.max(0, parentWidth - totalWidth);
    return Math.max(0, Math.min(anchorX - totalWidth / 2, max));
  }, [anchorX, parentWidth, totalWidth]);
  const pointerLeft = Math.max(POINTER_SIZE * 2, Math.min(anchorX - left, totalWidth - POINTER_SIZE * 2));

  if (!visible) return null;
  const label = formatTime(positionSeconds);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 flex flex-col items-center"
      style={{ left, bottom: GAP_TO_SEEKBAR, width: totalWidth }}
    >
      {hasFrame ? (
        <div
          className="relative overflow-hidden"
          style={{
            width: cardWidth, height: cardHeight, borderRadius: 6,
            backgroundColor: PLAYER.bg, border: `1px solid ${PLAYER.border}`,
            boxShadow: "0 8px 28px rgba(0,0,0,0.85)",
            backgroundImage: `url("${frame.url}")`,
            backgroundSize: `${Math.round(info.Width * info.TileWidth * scale)}px ${Math.round(info.Height * info.TileHeight * scale)}px`,
            backgroundPosition: `${-Math.round(frame.xInTile * scale)}px ${-Math.round(frame.yInTile * scale)}px`,
            backgroundRepeat: "no-repeat",
          }}
        >
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-center"
            style={{ paddingTop: 16, paddingBottom: 6, paddingInline: 8, backgroundColor: PLAYER.controlBg }}
          >
            <span className="tabular-nums" style={{ color: PLAYER.text, fontSize: 13, fontWeight: 600, letterSpacing: 0.1, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
              {label}
            </span>
          </div>
          <div className="absolute inset-x-0 top-0" style={{ height: 1, backgroundColor: PLAYER.border }} />
        </div>
      ) : (
        <div
          className="flex items-center justify-center"
          style={{
            height: PILL_HEIGHT, paddingInline: 10, borderRadius: 6,
            backgroundColor: PLAYER.controlBgHeavy, border: `1px solid ${PLAYER.border}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
          }}
        >
          <span className="tabular-nums" style={{ color: PLAYER.text, fontSize: 12, fontWeight: 600, letterSpacing: 0.1 }}>{label}</span>
        </div>
      )}
      <div
        className="absolute"
        style={{
          left: pointerLeft - POINTER_SIZE, bottom: -POINTER_SIZE + 1, width: 0, height: 0,
          borderLeft: `${POINTER_SIZE}px solid transparent`,
          borderRight: `${POINTER_SIZE}px solid transparent`,
          borderTop: `${POINTER_SIZE}px solid ${PLAYER.controlBgHeavy}`,
        }}
      />
    </div>
  );
});
