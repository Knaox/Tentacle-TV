/**
 * Octave — la barre de progression. Seule à suivre la position (sélecteur à
 * part) ; le dégradé violet → rose, rose en tête (`RangeSlider`). Pendant le
 * glissé, la position suit le doigt ; le moteur ne reçoit le saut qu'au
 * relâcher — à la valeur EXACTE du point lâché (`RangeSlider` › `onScrub`,
 * sans arrondi au pas du clavier). La position et la durée sont celles du
 * moteur (`usePlayerPosition`, durée réelle du fichier quand il la connaît).
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { durationLabel } from "@tentacle-tv/shared/octave";
import { useOctavePlayer, usePlayerPosition } from "../player/OctavePlayerProvider";
import { RangeSlider } from "./RangeSlider";

export const SeekBar = memo(function SeekBar({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const { positionMs, durationMs } = usePlayerPosition();
  const [drag, setDrag] = useState<number | null>(null);
  const duration = durationMs ?? 0;
  const shown = drag ?? positionMs;
  const ratio = duration > 0 ? shown / duration : 0;
  const commit = () => {
    if (drag !== null) player.seek(drag);
    setDrag(null);
  };

  return (
    <div className="oc-meta flex w-full items-center gap-2.5 text-[11px] text-content-tertiary">
      {!compact && <span className="w-10 shrink-0 text-right">{durationLabel(shown)}</span>}
      <RangeSlider
        className="flex-1"
        fill="progress"
        ratio={ratio}
        dragging={drag !== null}
        min={0}
        max={Math.max(1, duration)}
        step={1000}
        value={Math.min(shown, Math.max(1, duration))}
        disabled={duration === 0}
        aria-label={t("player.seek")}
        aria-valuetext={`${durationLabel(shown)} / ${durationLabel(durationMs)}`}
        onChange={(e) => setDrag(Number(e.target.value))}
        onScrub={setDrag}
        onScrubEnd={(value) => {
          if (value !== null) player.seek(Math.round(value));
          setDrag(null);
        }}
        onKeyUp={commit}
        onBlur={commit}
      />
      {!compact && <span className="w-10 shrink-0">{durationLabel(durationMs)}</span>}
    </div>
  );
});
