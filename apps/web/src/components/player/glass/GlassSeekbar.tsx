import type { RefObject } from "react";
import { TrickplayPreview } from "../../TrickplayPreview";
import { formatDuration } from "../../playerControls/utils";
import type { useDesktopSeekbar } from "../../../hooks/useDesktopSeekbar";

interface GlassSeekbarProps {
  seekbar: ReturnType<typeof useDesktopSeekbar>;
  displayProgress: number;
  bufProg: number;
  /** Position affichée (secondes FILM) et durée. */
  position: number;
  duration: number;
}

/**
 * La ligne de lecture de la capsule, façon QuickTime : écoulé · piste · restant.
 *
 * Même mécanique que `DesktopSeekbar` (`useDesktopSeekbar` : glissement, survol,
 * vignette) ; seul le dessin change. Deux différences de fond :
 *
 *  - la ZONE de saisie fait toute la hauteur de la ligne, la piste n'en est
 *    que le trait central — on attrape la barre sans viser six pixels ;
 *  - l'épaississement au survol est un `scaleY` du trait, jamais une hauteur
 *    qui s'anime (la règle de coût du dépôt). La poignée n'est pas dans le
 *    trait : elle ne s'écrase pas avec lui.
 *
 * Piste et remplissage BLANCS (jetons `--lg-player-track*`), comme QuickTime :
 * posés sur l'atténuation noire de la capsule — cf. `playerGlass.css`.
 */
export function GlassSeekbar({ seekbar, displayProgress, bufProg, position, duration }: GlassSeekbarProps) {
  const {
    seekBarRef, dragProgress,
    hoverTime, hoverX, barWidth, setBarWidth,
    onScrubStart, onBarMouseMove, endHover, trickplay, trickplayFrame,
  } = seekbar;
  const elapsed = dragProgress != null ? dragProgress * duration : position;
  const remaining = Math.max(0, duration - elapsed);
  const dragging = dragProgress != null;

  return (
    <div className="lgp-scrub">
      <span className="lgp-time lgp-scrub__time">{formatDuration(elapsed)}</span>
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
      <span className="lgp-time lgp-scrub__time lgp-scrub__time--end">−{formatDuration(remaining)}</span>
    </div>
  );
}
