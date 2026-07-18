import type { MutableRefObject, RefObject } from "react";
import { TrickplayPreview } from "../TrickplayPreview";
import type { useDesktopSeekbar } from "../../hooks/useDesktopSeekbar";

type SeekbarApi = ReturnType<typeof useDesktopSeekbar>;

interface DesktopSeekbarProps {
  seekbar: SeekbarApi;
  displayProgress: number;
  bufProg: number;
}

/**
 * Barre de progression du player desktop : buffer, progression, thumb au
 * survol/drag, vignette trickplay. Extraction mécanique de DesktopPlayer —
 * la logique (scrub/hover/trickplay) vit dans useDesktopSeekbar.
 *
 * Posée sur la vidéo → bg-white/* volontairement en dur dans les deux thèmes.
 */
export function DesktopSeekbar({ seekbar, displayProgress, bufProg }: DesktopSeekbarProps) {
  const {
    seekBarRef, dragProgress, isDragging,
    hoverTime, hoverX, barWidth, setHoverTime, setBarWidth,
    onScrubStart, onBarMouseMove, trickplay, trickplayFrame,
  } = seekbar;

  return (
    <div ref={seekBarRef as RefObject<HTMLDivElement>}
      className={`group/bar relative mb-3 flex h-1.5 cursor-pointer items-center rounded-full bg-white/20 transition-all ${dragProgress != null ? "h-2.5" : "hover:h-2.5"}`}
      onMouseDown={onScrubStart}
      onMouseMove={onBarMouseMove}
      onMouseEnter={(e) => setBarWidth(e.currentTarget.getBoundingClientRect().width)}
      onMouseLeave={() => { if (!(isDragging as MutableRefObject<boolean>).current) setHoverTime(null); }}>
      {/* Buffer bar */}
      <div className="absolute h-full rounded-full bg-white/10" style={{ width: `${bufProg * 100}%` }} />
      {/* Progress bar */}
      <div className="relative h-full rounded-full bg-tentacle-accent" style={{ width: `${displayProgress * 100}%` }}>
        <div className={`absolute -right-1.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-opacity ${dragProgress != null ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`} />
      </div>
      <TrickplayPreview
        visible={hoverTime !== null}
        positionSeconds={hoverTime ?? 0}
        frame={trickplayFrame}
        info={trickplay.info}
        anchorX={hoverX}
        parentWidth={barWidth}
      />
    </div>
  );
}
