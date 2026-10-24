/**
 * Octave — le volume : bouton muet + glissière. Le remplissage est une échelle.
 */

import { memo } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";

export const VolumeControl = memo(function VolumeControl() {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const volume = usePlayerSelector((s) => s.volume);
  const muted = usePlayerSelector((s) => s.muted);
  const shown = muted ? 0 : volume;
  const Icon = shown === 0 ? VolumeX : shown < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => player.toggleMute()}
        aria-label={t(muted ? "player.unmute" : "player.mute")}
        title={t(muted ? "player.unmute" : "player.mute")}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>
      <div className="group relative flex h-4 w-20 items-center">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-fill-medium">
          <div className="octave-progress-fill absolute inset-0 rounded-full bg-content-primary group-hover:bg-brand" style={{ transform: `scaleX(${shown})` }} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(shown * 100)}
          aria-label={t("player.volume")}
          onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
});
