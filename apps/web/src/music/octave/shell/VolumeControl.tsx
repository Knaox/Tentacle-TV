/**
 * Octave — le volume : bouton muet + glissière ROSE (Damien, 25/10 : « pas un
 * truc violet, plutôt rose »).
 */

import { memo } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";
import { RangeSlider } from "./RangeSlider";

export const VolumeControl = memo(function VolumeControl({ className = "w-24" }: { className?: string }) {
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
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <RangeSlider
        className={className}
        fill="volume"
        ratio={shown}
        min={0}
        max={100}
        step={1}
        value={Math.round(shown * 100)}
        aria-label={t("player.volume")}
        aria-valuetext={`${Math.round(shown * 100)} %`}
        onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
        onScrub={(value) => player.setVolume(value / 100)}
      />
    </div>
  );
});
