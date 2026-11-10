import type { RefObject } from "react";
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
 * Posée sur la vidéo → blanc et encre en dur dans les deux thèmes.
 *
 * Le dessin est celui du lecteur web (`chrome/playerChrome.css`) : rail qui s'épaissit en
 * `scaleY`, remplissage au DÉGRADÉ de jauge en `scaleX`, poignée en `translateX`. La poignée
 * n'a PAS d'ombre : sur la surface à canal alpha de macOS et de Linux, un flou sort en aplat
 * sombre (`lib/videoShadow.ts`) — une auréole suivait le curseur pendant tout le glissement.
 */
export function DesktopSeekbar({ seekbar, displayProgress, bufProg }: DesktopSeekbarProps) {
  const {
    seekBarRef, dragProgress,
    hoverTime, hoverX, barWidth, setBarWidth,
    onScrubStart, onBarMouseMove, endHover, trickplay, trickplayFrame,
  } = seekbar;

  const fill = Math.max(0, Math.min(1, displayProgress));
  return (
    <div ref={seekBarRef as RefObject<HTMLDivElement>}
      className="pl-seek"
      data-active={dragProgress != null ? "true" : undefined}
      onMouseDown={onScrubStart}
      onMouseMove={onBarMouseMove}
      onMouseEnter={(e) => setBarWidth(e.currentTarget.getBoundingClientRect().width)}
      onMouseLeave={endHover}>
      <div className="pl-seek__rail">
        <i className="pl-seek__buffer" style={{ transform: `scaleX(${Math.max(0, Math.min(1, bufProg))})` }} />
        <i className="pl-seek__fill" style={{ transform: `scaleX(${fill})` }} />
      </div>
      <span className="pl-seek__travel" style={{ transform: `translateX(${fill * 100}%)` }}>
        <span className="pl-seek__thumb" />
      </span>
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
