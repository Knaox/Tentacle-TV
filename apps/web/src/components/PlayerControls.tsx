import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import type { MediaItem, QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import type { ApplyToSeriesControl } from "../hooks/useApplyToSeries";
import { TrackSelector } from "./TrackSelector";
import { EpisodeSelectorPanel } from "./player/EpisodeSelectorPanel";
import { formatDuration } from "./playerControls/utils";
import { PlayerProgressBar } from "./playerControls/PlayerProgressBar";
import {
  BackIcon, PlayIcon, PauseIcon, VolumeIcon, MuteIcon,
  GearIcon, FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon, PipIcon, EpisodesIcon,
} from "./PlayerIcons";

export interface PlayerControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  fullscreen: boolean;
  item?: MediaItem;
  itemId?: string;
  mediaSourceId?: string;
  title: string;
  subtitle?: string;
  audioTracks: { index: number; label: string }[];
  subtitleTracks: { index: number; label: string }[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  qualityPresets?: readonly QualityPreset[];
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  /** Saut relatif ±10/30 avec badge — fallback sur onSeek si absent */
  onSkip?: (delta: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onBack: () => void;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange?: (key: QualityKey) => void;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  /** Épisode : case « Appliquer à cette série » (préférence de langues). */
  applyToSeries?: ApplyToSeriesControl;
}

// Contrôles superposés à la vidéo (top/bottom bar en dégradé vers transparent)
// → text-white/bg-white volontairement en dur dans les deux thèmes.
// (TrackSelector / EpisodeSelectorPanel ouverts depuis ici sont eux tokenisés :
// panneaux détachés à fond quasi-opaque, pas posés sur la vidéo.)
export function PlayerControls({
  playing, currentTime, duration, buffered, volume, fullscreen,
  item, mediaSourceId,
  title, subtitle, audioTracks, subtitleTracks,
  currentAudio, currentSubtitle, currentQuality, sourceQuality, qualityPresets,
  hasNextEpisode, hasPreviousEpisode,
  onTogglePlay, onSeek, onSkip, onVolumeChange, onToggleMute, onToggleFullscreen, onBack,
  onAudioChange, onSubtitleChange, onQualityChange,
  onNextEpisode, onPreviousEpisode, applyToSeries,
}: PlayerControlsProps) {
  const { t } = useTranslation("player");
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const isEpisode = item?.Type === "Episode" && !!item.SeriesId;
  const hasSettings = audioTracks.length > 0 || subtitleTracks.length > 0;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Top bar — stops propagation so clicks don't toggle play */}
      <div
        className="bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-5"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={onBack} className="rounded-full p-3 hover:bg-white/10 sm:p-2" aria-label={t("player:back")}><BackIcon /></button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h2>
            {subtitle && <p className="truncate text-xs text-white/50 sm:text-sm">{subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Middle spacer — clicks pass through to parent (toggle play) */}
      <div className="flex-1" />

      {/* Bottom bar — stops propagation */}
      <div
        className="relative bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 sm:px-6 sm:pb-5 sm:pt-10"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
      >
        <AnimatePresence>
          {showSettings && hasSettings && (
            <TrackSelector
              audioTracks={audioTracks} subtitleTracks={subtitleTracks}
              currentAudio={currentAudio} currentSubtitle={currentSubtitle}
              currentQuality={currentQuality} sourceQuality={sourceQuality} qualityPresets={qualityPresets}
              onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange} onQualityChange={onQualityChange}
              applyToSeries={applyToSeries}
              onClose={() => setShowSettings(false)}
            />
          )}
          {showEpisodes && isEpisode && item?.SeriesId && (
            <EpisodeSelectorPanel
              seriesId={item.SeriesId}
              currentEpisodeId={item.Id}
              currentSeasonId={item.SeasonId}
              onClose={() => setShowEpisodes(false)}
            />
          )}
        </AnimatePresence>

        <PlayerProgressBar
          currentTime={currentTime} duration={duration} buffered={buffered}
          item={item} mediaSourceId={mediaSourceId} onSeek={onSeek}
        />

        {/* Button row — tactile-friendly: padding p-2.5 ≈ 44px target sur mobile */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            {hasPreviousEpisode && (
              <button onClick={onPreviousEpisode} className="rounded-full p-2.5 hover:bg-white/10 sm:p-2" title={t("player:previousEpisode")} aria-label={t("player:previousEpisode")}><PrevEpIcon /></button>
            )}
            <button onClick={() => onSkip ? onSkip(-10) : onSeek(Math.max(0, currentTime - 10))} className="rounded-full p-2.5 hover:bg-white/10 sm:p-1.5" title={t("player:skipBack")} aria-label={t("player:skipBack")}>
              <span className="text-xs font-bold text-white/70">-10</span>
            </button>
            <button onClick={onTogglePlay} className="rounded-full p-3 hover:bg-white/10 sm:p-2" aria-label={playing ? t("player:pause", "Pause") : t("player:play", "Play")}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
            <button onClick={() => onSkip ? onSkip(30) : onSeek(Math.min(duration, currentTime + 30))} className="rounded-full p-2.5 hover:bg-white/10 sm:p-1.5" title={t("player:skipForward")} aria-label={t("player:skipForward")}>
              <span className="text-xs font-bold text-white/70">+30</span>
            </button>
            {hasNextEpisode && (
              <button onClick={onNextEpisode} className="rounded-full p-2.5 hover:bg-white/10 sm:p-2" title={t("player:nextEpisode")} aria-label={t("player:nextEpisode")}><NextEpIcon /></button>
            )}
            {/* Volume : icône seule sur mobile (slider trop encombrant), slider horizontal sur ≥sm au hover */}
            <div className="group/vol flex items-center gap-2">
              <button onClick={onToggleMute} className="rounded-full p-2.5 hover:bg-white/10 sm:p-2" aria-label={volume === 0 ? t("player:unmute", "Unmute") : t("player:mute", "Mute")}>
                {/* Quatre états qui suivent le volume (0–1 ici) : coupé, bas,
                    moyen, fort. Même icône que le lecteur desktop. */}
                {volume === 0 ? <MuteIcon /> : <VolumeIcon bars={volume <= 0.33 ? 1 : volume <= 0.66 ? 2 : 3} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="hidden w-20 accent-[color:var(--brand-accent)] sm:group-hover/vol:block"
                aria-label={t("player:volume", "Volume")}
                role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(volume * 100)} />
            </div>
            {/* Compteur temps : caché sur très petit écran pour libérer de la place aux contrôles */}
            <span className="hidden whitespace-nowrap text-xs text-white/60 xs:inline sm:text-sm">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isEpisode && (
              <button
                onClick={() => { setShowEpisodes((p) => !p); setShowSettings(false); }}
                className={`rounded-full p-2.5 hover:bg-white/10 sm:p-2 ${showEpisodes ? "bg-white/10" : ""}`}
                title={t("player:episodes")}
                aria-label={t("player:episodes")}
              >
                <EpisodesIcon />
              </button>
            )}
            {hasSettings && (
              <button onClick={() => { setShowSettings((p) => !p); setShowEpisodes(false); }} className="relative rounded-full p-2.5 hover:bg-white/10 sm:p-2" aria-label={t("player:settings")}>
                <GearIcon />
                {currentSubtitle !== null && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-tentacle-accent" />
                )}
              </button>
            )}
            {typeof document !== "undefined" && document.pictureInPictureEnabled && (
              <button
                onClick={() => {
                  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
                  else {
                    const v = document.querySelector("video");
                    if (v) v.requestPictureInPicture().catch(() => {});
                  }
                }}
                className="hidden rounded-full p-2.5 hover:bg-white/10 sm:inline-flex sm:p-2"
                aria-label={t("player:pip", "Picture in Picture")}
              >
                <PipIcon />
              </button>
            )}
            <button onClick={onToggleFullscreen} className="rounded-full p-2.5 hover:bg-white/10 sm:p-2" aria-label={fullscreen ? t("player:exitFullscreen", "Exit fullscreen") : t("player:fullscreen", "Fullscreen")}>
              {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

