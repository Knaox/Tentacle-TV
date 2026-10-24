/**
 * Octave — aléatoire, précédent, lecture/pause, suivant, répétition. Le bouton
 * central suit l'INTENTION (« Pause » dès le clic sur un titre), jamais un
 * spinner : l'attente du son ne se montre pas.
 */

import { memo } from "react";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";

const iconButton =
  "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-[color,transform] duration-150 hover:text-content-primary active:scale-90 disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const Transport = memo(function Transport({ size = "md" }: { size?: "md" | "lg" }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const wantsPlay = usePlayerSelector((s) => s.wantsPlay);
  const hasTrack = usePlayerSelector((s) => s.current !== null);
  const shuffle = usePlayerSelector((s) => s.queue.shuffle);
  const repeat = usePlayerSelector((s) => s.queue.repeat);
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const big = size === "lg";
  const mainBox = big ? "h-16 w-16" : "h-10 w-10";
  const mainIcon = big ? "h-7 w-7" : "h-5 w-5";
  const repeatLabel = repeat === "off" ? t("player.repeatOff") : repeat === "all" ? t("player.repeatAll") : t("player.repeatOne");
  const activeDot = <span aria-hidden className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand" />;

  return (
    <div className={`flex items-center justify-center ${big ? "gap-6" : "gap-2"}`}>
      <button
        type="button"
        aria-pressed={shuffle}
        aria-label={t(shuffle ? "player.shuffleOff" : "player.shuffleOn")}
        title={t(shuffle ? "player.shuffleOff" : "player.shuffleOn")}
        onClick={() => queueActions.toggleShuffle(player)}
        className={`${iconButton} ${shuffle ? "text-brand hover:text-brand" : ""}`}
      >
        <Shuffle className="h-4 w-4" />
        {shuffle && activeDot}
      </button>
      <button type="button" disabled={!hasTrack} aria-label={t("player.previous")} title={t("player.previous")} onClick={() => player.previous()} className={iconButton}>
        <SkipBack className={big ? "h-6 w-6" : "h-[18px] w-[18px]"} fill="currentColor" />
      </button>
      <button
        type="button"
        disabled={!hasTrack}
        aria-label={t(wantsPlay ? "player.pause" : "player.play")}
        title={t(wantsPlay ? "player.pause" : "player.play")}
        onClick={() => player.togglePlay()}
        className={`flex ${mainBox} cursor-pointer items-center justify-center rounded-full bg-cta-primary-bg text-cta-primary-fg transition-transform duration-150 hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}
      >
        {wantsPlay ? <Pause className={mainIcon} fill="currentColor" /> : <Play className={`${mainIcon} ml-0.5`} fill="currentColor" />}
      </button>
      <button type="button" disabled={!hasTrack} aria-label={t("player.next")} title={t("player.next")} onClick={() => player.next()} className={iconButton}>
        <SkipForward className={big ? "h-6 w-6" : "h-[18px] w-[18px]"} fill="currentColor" />
      </button>
      <button
        type="button"
        aria-pressed={repeat !== "off"}
        aria-label={repeatLabel}
        title={repeatLabel}
        onClick={() => queueActions.cycleRepeat(player)}
        className={`${iconButton} ${repeat !== "off" ? "text-brand hover:text-brand" : ""}`}
      >
        <RepeatIcon className="h-4 w-4" />
        {repeat !== "off" && activeDot}
      </button>
    </div>
  );
});
