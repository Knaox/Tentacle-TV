import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "../TrackSelector";
import { EpisodeSelectorPanel } from "./EpisodeSelectorPanel";
import { LocalEpisodeSelectorPanel } from "./LocalEpisodeSelectorPanel";
import { DesktopSeekbar } from "./DesktopSeekbar";
import { formatDuration } from "../playerControls/utils";
import {
  BackIcon, PlayIcon, PauseIcon, VolumeIcon, MuteIcon, GearIcon,
  FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon, EpisodesIcon,
} from "../PlayerIcons";
import type { AudioTrack, SubtitleTrack } from "./videoPlayer.types";
import type { ApplyToSeriesControl } from "../../hooks/useApplyToSeries";
import type { MediaItem, QualityKey, SourceQuality } from "@tentacle-tv/shared";
import type { MpvState } from "../../hooks/useDesktopPlayer";
import type { useDesktopSeekbar } from "../../hooks/useDesktopSeekbar";

interface DesktopPlayerControlsProps {
  visible: boolean;
  state: MpvState;
  title: string;
  subtitle?: string;
  isDirectPlay: boolean;
  isEpisode: boolean;
  /** Hors ligne (auto OU manuel — les requêtes serveur sont alors
   *  court-circuitées) : panneau d'épisodes servi par les téléchargements.
   *  En ligne, panneau serveur COMPLET même en lecture locale : ouvrir le
   *  sélecteur est une action utilisateur, une requête est assumée — le
   *  « zéro réseau » ne vaut que pour la lecture passive. */
  useLocalEpisodes: boolean;
  item?: MediaItem;
  displayAudio: AudioTrack[];
  displaySubs: SubtitleTrack[];
  curAudio: number;
  curSub: number | null;
  currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  hasSettings: boolean;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  dur: number;
  actualPos: number;
  displayProgress: number;
  bufProg: number;
  seekbar: ReturnType<typeof useDesktopSeekbar>;
  showSettings: boolean;
  showEpisodes: boolean;
  setShowSettings: (fn: (p: boolean) => boolean) => void;
  setShowEpisodes: (fn: (p: boolean) => boolean) => void;
  closePanels: { settings: () => void; episodes: () => void };
  goBack: () => void;
  togglePause: () => void;
  skipBy: (delta: number) => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  toggleFullscreen: () => void;
  handleAudioChange: (index: number) => void;
  handleSubtitleChange: (index: number | null) => void;
  onQualityChange?: (key: QualityKey) => void;
  applyToSeries?: ApplyToSeriesControl;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
}

/**
 * Barres de contrôle du player desktop : top bar (retour, titre, badge mpv dev)
 * et bottom bar (seekbar, transport, volume mpv 0-100, sélecteurs de pistes et
 * d'épisodes, fullscreen). Extraction mécanique de DesktopPlayer.
 *
 * Barres superposées à la vidéo (gradient bg-black/70 → transparent) →
 * text-white/bg-white volontairement en dur, identiques dans les deux thèmes.
 * (TrackSelector / EpisodeSelectorPanel qu'elles ouvrent sont eux tokenisés :
 * ce sont des panneaux détachés, pas posés sur la vidéo.)
 */
export function DesktopPlayerControls({
  visible, state, title, subtitle, isDirectPlay, isEpisode, useLocalEpisodes, item,
  displayAudio, displaySubs, curAudio, curSub, currentQuality, sourceQuality,
  hasSettings, hasNextEpisode, hasPreviousEpisode,
  dur, actualPos, displayProgress, bufProg, seekbar,
  showSettings, showEpisodes, setShowSettings, setShowEpisodes, closePanels,
  goBack, togglePause, skipBy, toggleMute, setVolume, toggleFullscreen,
  handleAudioChange, handleSubtitleChange, onQualityChange, applyToSeries,
  onNextEpisode, onPreviousEpisode,
}: DesktopPlayerControlsProps) {
  const { t } = useTranslation("player");
  const { dragProgress } = seekbar;

  return (
    <div className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      {/* Top bar */}
      <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-b from-black/70 to-transparent px-6 pb-10 pt-5">
          <div className="flex items-center gap-4">
            <button onClick={() => goBack()} className="rounded-full p-2 hover:bg-white/10"><BackIcon /></button>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
            </div>
            {import.meta.env.DEV && (
              <div className="ml-auto flex items-center gap-2 rounded-full bg-[rgba(var(--brand-rgb),0.3)] px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                <span className="text-xs text-[var(--brand-light)]">mpv{isDirectPlay ? "" : " (transcode)"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-10">
          <AnimatePresence>
            {showSettings && hasSettings && (
              <TrackSelector
                audioTracks={displayAudio} subtitleTracks={displaySubs}
                currentAudio={curAudio} currentSubtitle={curSub}
                currentQuality={currentQuality} sourceQuality={sourceQuality}
                onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange}
                onQualityChange={onQualityChange}
                applyToSeries={applyToSeries}
                onClose={closePanels.settings}
              />
            )}
            {showEpisodes && isEpisode && item?.SeriesId && (
              useLocalEpisodes ? (
                <LocalEpisodeSelectorPanel
                  currentEpisodeId={item.Id}
                  onClose={closePanels.episodes}
                />
              ) : (
                <EpisodeSelectorPanel
                  seriesId={item.SeriesId}
                  currentEpisodeId={item.Id}
                  currentSeasonId={item.SeasonId}
                  onClose={closePanels.episodes}
                />
              )
            )}
          </AnimatePresence>

          {/* Progress bar with buffer + drag scrub */}
          <DesktopSeekbar seekbar={seekbar} displayProgress={displayProgress} bufProg={bufProg} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasPreviousEpisode && (
                <button onClick={onPreviousEpisode} className="rounded-full p-2 hover:bg-white/10" title="(P)"><PrevEpIcon /></button>
              )}
              <button onClick={() => skipBy(-10)} className="rounded-full p-1.5 hover:bg-white/10" title="-10s">
                <span className="text-xs font-bold text-white/70">-10</span>
              </button>
              <button onClick={() => togglePause()} className="rounded-full p-2 hover:bg-white/10">
                {state.paused ? <PlayIcon /> : <PauseIcon />}
              </button>
              <button onClick={() => skipBy(30)} className="rounded-full p-1.5 hover:bg-white/10" title="+30s">
                <span className="text-xs font-bold text-white/70">+30</span>
              </button>
              {hasNextEpisode && (
                <button onClick={onNextEpisode} className="rounded-full p-2 hover:bg-white/10" title="(N)"><NextEpIcon /></button>
              )}
              <div className="group/vol flex items-center gap-2">
                <button onClick={() => toggleMute()} className="rounded-full p-2 hover:bg-white/10">
                  {state.muted || state.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
                </button>
                <input type="range" min={0} max={100} step={1} value={state.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="hidden w-20 accent-tentacle-accent group-hover/vol:block" />
              </div>
              <span className="text-sm text-white/60">{formatDuration(dragProgress != null ? dragProgress * dur : actualPos)} / {formatDuration(dur)}</span>
            </div>
            <div className="flex items-center gap-2">
              {isEpisode && (
                <button
                  onClick={() => { setShowEpisodes((p) => !p); setShowSettings(() => false); }}
                  className={`rounded-full p-2 hover:bg-white/10 ${showEpisodes ? "bg-white/10" : ""}`}
                  title={t("player:episodes")}
                  aria-label={t("player:episodes")}
                >
                  <EpisodesIcon />
                </button>
              )}
              {hasSettings && (
                <button onClick={() => { setShowSettings((p) => !p); setShowEpisodes(() => false); }} className="rounded-full p-2 hover:bg-white/10"><GearIcon /></button>
              )}
              <button onClick={() => toggleFullscreen()} className="rounded-full p-2 hover:bg-white/10" title="(F)">
                {state.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
