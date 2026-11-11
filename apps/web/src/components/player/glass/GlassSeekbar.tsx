import type { RefObject } from "react";
import { TrickplayPreview } from "../../TrickplayPreview";
import type { useDesktopSeekbar } from "../../../hooks/useDesktopSeekbar";

interface GlassSeekbarProps {
  seekbar: ReturnType<typeof useDesktopSeekbar>;
  displayProgress: number;
  bufProg: number;
}

/**
 * La barre de lecture du lecteur en verre : celle de l'habillage sans verre
 * (`DesktopSeekbar`), au même endroit — d'une marge à l'autre, au-dessus des
 * capsules, une zone de saisie de 18 px et un trait de 4 (lot rf2). Le temps
 * n'est plus de part et d'autre du trait : il se lit après la capsule du
 * transport, comme sans verre (`GlassControlsRow`).
 *
 * Même mécanique (`useDesktopSeekbar` : glissement, survol, vignette) ; seul
 * le dessin change. L'épaississement au survol est un `scaleY` du trait, jamais
 * une hauteur qui s'anime (la règle de coût du dépôt). La poignée n'est pas
 * dans le trait : elle ne s'écrase pas avec lui.
 *
 * Piste BLANCHE translucide, partie lue au dégradé de marque
 * (`--lg-player-progress-fill`, violet → rose), posées NUES sur le voile du bas
 * (lot lg8) — cf. `playerGlass.css`.
 */
export function GlassSeekbar({ seekbar, displayProgress, bufProg }: GlassSeekbarProps) {
  const {
    seekBarRef, dragProgress,
    hoverTime, hoverX, barWidth, setBarWidth,
    onScrubStart, onBarMouseMove, endHover, trickplay, trickplayFrame,
  } = seekbar;
  const dragging = dragProgress != null;

  return (
    <div
      ref={seekBarRef as RefObject<HTMLDivElement>}
      className="lgp-scrub__zone"
      data-dragging={dragging}
      onMouseDown={onScrubStart}
      onMouseMove={onBarMouseMove}
      onMouseEnter={(e) => setBarWidth(e.currentTarget.getBoundingClientRect().width)}
      onMouseLeave={endHover}
    >
      <div className="lgp-scrub__rail">
        <div className="lgp-scrub__buffer" style={{ width: `${bufProg * 100}%` }} />
        <div className="lgp-scrub__fill" style={{ width: `${displayProgress * 100}%` }} />
      </div>
      <div className="lgp-scrub__thumb-track" style={{ left: `${displayProgress * 100}%` }}>
        <span className="lgp-scrub__thumb" />
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
