/**
 * Octave — la barre de progression. Seule à suivre la position (sélecteur à
 * part) ; le remplissage est une ÉCHELLE (`scaleX`, composée), jamais une
 * largeur. Un `<input type="range">` porte le clavier et les lecteurs d'écran.
 * Pendant le glissé, la position suit le doigt ; le moteur ne reçoit le saut
 * qu'au relâcher.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { durationLabel } from "@tentacle-tv/shared/octave";
import { useOctavePlayer, usePlayerPosition } from "../player/OctavePlayerProvider";

export const SeekBar = memo(function SeekBar({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const { positionMs, durationMs, running } = usePlayerPosition();
  const [drag, setDrag] = useState<number | null>(null);
  const duration = durationMs ?? 0;
  const shown = drag ?? positionMs;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;
  const commit = () => {
    if (drag !== null) player.seek(drag);
    setDrag(null);
  };

  return (
    <div className={`flex w-full items-center gap-2 ${compact ? "" : "text-[11px]"}`}>
      {!compact && <span className="w-10 shrink-0 text-right tabular-nums text-content-tertiary">{durationLabel(shown)}</span>}
      <div className="group relative flex h-4 flex-1 items-center">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-fill-medium">
          <div
            className="octave-progress-fill absolute inset-0 rounded-full bg-content-primary group-hover:bg-brand"
            data-running={running && drag === null ? "true" : "false"}
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={1000}
          value={Math.min(shown, Math.max(1, duration))}
          disabled={duration === 0}
          aria-label={t("player.seek")}
          aria-valuetext={`${durationLabel(shown)} / ${durationLabel(durationMs)}`}
          onChange={(e) => setDrag(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </div>
      {!compact && <span className="w-10 shrink-0 tabular-nums text-content-tertiary">{durationLabel(durationMs)}</span>}
    </div>
  );
});
