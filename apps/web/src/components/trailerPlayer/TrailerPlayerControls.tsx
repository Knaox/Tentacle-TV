/**
 * Les commandes du lecteur des bandes-annonces — l'APPARENCE de celles du
 * lecteur (`PlayerControls`) : barre du haut (fermer, titre, ce que dit la
 * bande-annonce), barre du bas (progression, transport, son, temps, puis
 * liste, réglages, image dans l'image, plein écran). Posées sur la vidéo :
 * blanc sur dégradé noir dans les deux thèmes ; les panneaux, eux, sont
 * détachés et suivent le thème.
 */

import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import type { TrailerQueueItem, TrailerStream } from "@tentacle-tv/shared";
import { PlayerProgressBar } from "../playerControls/PlayerProgressBar";
import { formatDuration } from "../playerControls/utils";
import {
  BackIcon, ExitFullscreenIcon, FullscreenIcon, GearIcon, MuteIcon, NextEpIcon, PauseIcon, PipIcon, PlayIcon, PrevEpIcon, VolumeIcon,
  EpisodesIcon,
} from "../PlayerIcons";
import { rangeFill } from "../../lib/rangeFill";
import { TrailerSettingsPanel } from "./TrailerSettingsPanel";
import { TrailerListPanel } from "./TrailerListPanel";
import type { TrailerItemLabels } from "./trailerLabels";
import { TRAILER_SKIP_S } from "./trailerPlayerKeys";

export interface TrailerPlayerControlsProps {
  item: TrailerQueueItem;
  labels: TrailerItemLabels;
  queue: readonly TrailerQueueItem[];
  index: number;
  language: string | null;
  stream: TrailerStream | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  fullscreen: boolean;
  subtitle: string | null;
  quality: number | null;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (delta: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onPip: (() => void) | null;
  onNeighbor: (direction: 1 | -1) => void;
  onPick: (index: number) => void;
  onSubtitle: (lang: string | null) => void;
  onQuality: (height: number | null) => void;
  onClose: () => void;
}

type Panel = "settings" | "list" | null;

const ROUND = "rounded-full p-2.5 hover:bg-white/10 sm:p-2";

export const TrailerPlayerControls = memo(function TrailerPlayerControls(props: TrailerPlayerControlsProps) {
  const { t } = useTranslation("player");
  const [panel, setPanel] = useState<Panel>(null);
  const { item, labels, queue, index, stream, playing, currentTime, duration, buffered, volume, fullscreen } = props;
  const hasSettings = !!stream && (stream.subtitles.length > 0 || stream.qualities.length >= 2);
  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={props.onClose} className="rounded-full p-3 hover:bg-white/10 sm:p-2" aria-label={t("common:trailerClose")}><BackIcon /></button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-white sm:text-lg">{item.name || t("common:trailer")}</h2>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-white/60 sm:text-sm">
              {[labels.scope, labels.version, labels.origin].filter((l): l is string => !!l).map((label) => (
                <span key={label} className="rounded bg-white/10 px-1.5 py-0.5 font-medium text-white/80">{label}</span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="relative bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 sm:px-6 sm:pb-5 sm:pt-10" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {panel === "settings" && stream && (
            <TrailerSettingsPanel stream={stream} subtitle={props.subtitle} quality={props.quality}
              onSubtitle={props.onSubtitle} onQuality={props.onQuality} onClose={() => setPanel(null)} />
          )}
          {panel === "list" && (
            <TrailerListPanel queue={queue} index={index} language={props.language}
              onPick={(i) => { setPanel(null); props.onPick(i); }} onClose={() => setPanel(null)} />
          )}
        </AnimatePresence>

        <PlayerProgressBar currentTime={currentTime} duration={duration} buffered={buffered} onSeek={props.onSeek} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            {queue.length > 1 && (
              <IconButton label={t("common:trailerPrevious")} disabled={index === 0} onClick={() => props.onNeighbor(-1)}><PrevEpIcon /></IconButton>
            )}
            <button onClick={() => props.onSkip(-TRAILER_SKIP_S)} className="rounded-full p-2.5 hover:bg-white/10 sm:p-1.5" aria-label={`-${TRAILER_SKIP_S}s`}>
              <span className="text-xs font-bold text-white/70">-{TRAILER_SKIP_S}</span>
            </button>
            <button onClick={props.onTogglePlay} className="rounded-full p-3 hover:bg-white/10 sm:p-2" aria-label={playing ? t("player:pause") : t("player:play")}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button onClick={() => props.onSkip(TRAILER_SKIP_S)} className="rounded-full p-2.5 hover:bg-white/10 sm:p-1.5" aria-label={`+${TRAILER_SKIP_S}s`}>
              <span className="text-xs font-bold text-white/70">+{TRAILER_SKIP_S}</span>
            </button>
            {queue.length > 1 && (
              <IconButton label={t("common:trailerNext")} disabled={index >= queue.length - 1} onClick={() => props.onNeighbor(1)}><NextEpIcon /></IconButton>
            )}
            <div className="group/vol flex items-center gap-2">
              <button onClick={props.onToggleMute} className={ROUND} aria-label={volume === 0 ? t("player:unmute") : t("player:mute")}>
                {volume === 0 ? <MuteIcon /> : <VolumeIcon bars={volume <= 0.33 ? 1 : volume <= 0.66 ? 2 : 3} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={(e) => props.onVolumeChange(Number(e.target.value))}
                style={rangeFill(volume, 0, 1)}
                className="ctl-range hidden w-20 sm:group-hover/vol:block"
                aria-label={t("player:volume")} />
            </div>
            <span className="hidden whitespace-nowrap text-xs text-white/60 xs:inline sm:text-sm">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {queue.length > 1 && (
              <IconButton label={t("common:trailerList")} active={panel === "list"} onClick={() => toggle("list")}><EpisodesIcon /></IconButton>
            )}
            {hasSettings && (
              <IconButton label={t("player:settings")} active={panel === "settings"} onClick={() => toggle("settings")}>
                <GearIcon />
                {props.subtitle !== null && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-tentacle-accent" />}
              </IconButton>
            )}
            {props.onPip && (
              <IconButton label={t("player:pictureInPicture")} onClick={props.onPip} className="hidden sm:inline-flex"><PipIcon /></IconButton>
            )}
            <IconButton label={fullscreen ? t("player:exitFullscreen") : t("player:fullscreen")} onClick={props.onToggleFullscreen}>
              {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
});

function IconButton({ label, onClick, children, active = false, disabled = false, className = "" }: {
  label: string; onClick: () => void; children: ReactNode; active?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={active || undefined}
      className={`relative ${ROUND} disabled:opacity-30 disabled:hover:bg-transparent ${active ? "bg-white/10" : ""} ${className}`}>
      {children}
    </button>
  );
}
