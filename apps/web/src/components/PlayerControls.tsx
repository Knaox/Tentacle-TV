import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import type { MediaItem, QualityDrop, QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import type { ApplyToSeriesControl } from "../hooks/useApplyToSeries";
import { TrackSelector } from "./TrackSelector";
import { EpisodeSelectorPanel } from "./player/EpisodeSelectorPanel";
import { formatDuration } from "./playerControls/utils";
import { PlayerProgressBar } from "./playerControls/PlayerProgressBar";
import { PlaybackRateControl } from "./playerControls/PlaybackRateControl";
import { usePlaybackRate } from "./playerControls/usePlaybackRate";
import {
  VolumeIcon, MuteIcon, GearIcon, FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon, PipIcon, EpisodesIcon,
} from "./PlayerIcons";
import { PauseIcon, PlayIcon } from "./icons/transport";
import { SkipBackGlyph, SkipForwardGlyph } from "./player/chrome/skipGlyphs";
import { ChromeTop } from "./player/chrome/ChromeTop";
import { useChromePresence } from "./player/chrome/useChromePresence";
import { rangeFill } from "../lib/rangeFill";
import "./player/chrome/playerChrome.css";

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
  /** Badge « Auto » sur le palier actif du sélecteur. */
  autoQualityActive?: boolean;
  /** Pourquoi la qualité baisse en Auto — la ligne du menu Qualité (`player/qualityDrop.ts`). */
  qualityDrop?: QualityDrop | null;
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
  /** Épisode : « Garder pour toute la série » (préférence de langues). */
  applyToSeries?: ApplyToSeriesControl;
  /** Applique la vitesse de lecture sur l'élément vidéo. */
  onPlaybackRateChange?: (rate: number) => void;
  /** Un panneau (pistes, épisodes) vient de s'ouvrir ou de se fermer. */
  onPanelsOpenChange?: (open: boolean) => void;
  /**
   * L'habillage est-il à l'écran ? Masqué, il n'est plus dans le DOM (`useChromePresence`) ;
   * l'état qu'il doit garder — panneau ouvert, vitesse — vit ici, au-dessus de ce qui part.
   */
  visible?: boolean;
}

const noRate = () => {};
/** Le fondu de `VideoPlayerControlsLayer` (`duration-300`). */
const LAYER_FADE_MS = 300;

/**
 * L'habillage du lecteur web (refonte de nov. 2026) : la sortie et le titre en haut ; en bas la
 * barre de lecture, puis deux CAPSULES — le transport à gauche, le son et les réglages à droite
 * (`player/chrome/playerChrome.css`). Posé sur la vidéo : blanc et encre en dur, dans les deux
 * thèmes. Les panneaux qu'il ouvre (pistes, vitesse, épisodes) sont des menus, qui suivent le thème.
 */
export function PlayerControls({
  playing, currentTime, duration, buffered, volume, fullscreen,
  item, itemId, mediaSourceId,
  title, subtitle, audioTracks, subtitleTracks,
  currentAudio, currentSubtitle, currentQuality, sourceQuality, qualityPresets, autoQualityActive, qualityDrop,
  hasNextEpisode, hasPreviousEpisode,
  onTogglePlay, onSeek, onSkip, onVolumeChange, onToggleMute, onToggleFullscreen, onBack,
  onAudioChange, onSubtitleChange, onQualityChange,
  onNextEpisode, onPreviousEpisode, applyToSeries, onPlaybackRateChange,
  onPanelsOpenChange, visible = true,
}: PlayerControlsProps) {
  const { t } = useTranslation("player");
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  // La vitesse vit ICI : tenue par son bouton, elle retombait à 1× chaque fois que
  // l'habillage, démonté une fois masqué, revenait à l'écran.
  const speed = usePlaybackRate(onPlaybackRateChange ?? noRate, itemId, !!onPlaybackRateChange);
  // Les pilules de saut partagent le coin bas-droit avec ces panneaux : le
  // lecteur veut savoir quand l'un d'eux est ouvert pour les effacer.
  const panelsOpen = showSettings || showEpisodes;
  useEffect(() => {
    onPanelsOpenChange?.(panelsOpen);
    return () => onPanelsOpenChange?.(false);
  }, [panelsOpen, onPanelsOpenChange]);
  // Le fondu est celui de la couche qui le porte (`VideoPlayerControlsLayer`, 300 ms) : ici on
  // ne fait que partir du DOM une fois ce fondu joué.
  const { mounted, shown } = useChromePresence(visible, LAYER_FADE_MS);
  if (!mounted) return null;

  const isEpisode = item?.Type === "Episode" && !!item.SeriesId;
  const hasSettings = audioTracks.length > 0 || subtitleTracks.length > 0;
  const muted = volume === 0;

  return (
    <div className="pl-chrome pl-chrome--held" data-shown={shown}>
      <ChromeTop title={title} subtitle={subtitle} onBack={onBack} />

      <div className="pl-bar pl-bar--bottom" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {showSettings && hasSettings && (
            <TrackSelector
              audioTracks={audioTracks} subtitleTracks={subtitleTracks}
              currentAudio={currentAudio} currentSubtitle={currentSubtitle}
              currentQuality={currentQuality} sourceQuality={sourceQuality} qualityPresets={qualityPresets}
              autoQualityActive={autoQualityActive} qualityDrop={qualityDrop}
              onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange} onQualityChange={onQualityChange}
              applyToSeries={applyToSeries} seriesName={item?.SeriesName ?? undefined}
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

        <div className="pl-row">
          <div className="pl-caps">
            {hasPreviousEpisode && (
              <button type="button" onClick={onPreviousEpisode} className="pl-btn" title={t("player:previousEpisode")} aria-label={t("player:previousEpisodeLabel")}><PrevEpIcon /></button>
            )}
            <button type="button" onClick={() => onSkip ? onSkip(-10) : onSeek(Math.max(0, currentTime - 10))} className="pl-btn" title={t("player:seekBackBy", { seconds: 10 })} aria-label={t("player:seekBackBy", { seconds: 10 })}>
              <SkipBackGlyph seconds={10} />
            </button>
            <button type="button" onClick={onTogglePlay} className="pl-btn pl-btn--main" aria-label={playing ? t("player:pause", "Pause") : t("player:play", "Play")}>
              {playing ? <PauseIcon size={20} aria-hidden /> : <PlayIcon size={20} aria-hidden />}
            </button>
            <button type="button" onClick={() => onSkip ? onSkip(30) : onSeek(Math.min(duration, currentTime + 30))} className="pl-btn" title={t("player:seekForwardBy", { seconds: 30 })} aria-label={t("player:seekForwardBy", { seconds: 30 })}>
              <SkipForwardGlyph seconds={30} />
            </button>
            {hasNextEpisode && (
              <button type="button" onClick={onNextEpisode} className="pl-btn" title={t("player:nextEpisode")} aria-label={t("player:nextEpisodeLabel")}><NextEpIcon /></button>
            )}
          </div>
          {/* Le temps : caché sur un écran très étroit, pour laisser la place aux capsules. */}
          <span className="pl-time hidden xs:inline">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
          <span className="pl-grow" />
          <div className="pl-caps">
            <div className="pl-volume">
              <button type="button" onClick={onToggleMute} className="pl-btn" aria-label={muted ? t("player:unmute", "Unmute") : t("player:mute", "Mute")} title={muted ? t("player:unmute", "Unmute") : t("player:mute", "Mute")}>
                {/* Quatre états qui suivent le volume (0–1 ici) : coupé, bas, moyen, fort. */}
                {muted ? <MuteIcon /> : <VolumeIcon bars={volume <= 0.33 ? 1 : volume <= 0.66 ? 2 : 3} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                style={rangeFill(volume, 0, 1)}
                className="ctl-range pl-volume__range"
                aria-label={t("player:volume", "Volume")}
                role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(volume * 100)} />
            </div>
            {onPlaybackRateChange && (
              <PlaybackRateControl
                apply={onPlaybackRateChange} resetKey={itemId} state={speed}
                // Un seul panneau à la fois : pistes et épisodes se fermaient
                // déjà l'un l'autre, la vitesse s'ouvrait par-dessus les deux.
                otherPanelOpen={showSettings || showEpisodes}
                onOpen={() => { setShowSettings(false); setShowEpisodes(false); }}
              />
            )}
            {isEpisode && (
              <button type="button"
                onClick={() => { setShowEpisodes((p) => !p); setShowSettings(false); }}
                className="pl-btn" aria-expanded={showEpisodes}
                title={t("player:episodes")} aria-label={t("player:episodes")}
              >
                <EpisodesIcon />
              </button>
            )}
            {hasSettings && (
              <button type="button" onClick={() => { setShowSettings((p) => !p); setShowEpisodes(false); }} className="pl-btn" aria-expanded={showSettings} aria-label={t("player:settings")} title={t("player:settings")}>
                <GearIcon />
                {/* Des sous-titres sont allumés : le bouton le dit sans ouvrir le panneau. */}
                {currentSubtitle !== null && <span className="pl-dot" aria-hidden />}
              </button>
            )}
            {typeof document !== "undefined" && document.pictureInPictureEnabled && (
              <button type="button"
                onClick={() => {
                  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
                  else {
                    const v = document.querySelector("video");
                    if (v) v.requestPictureInPicture().catch(() => {});
                  }
                }}
                className="pl-btn hidden sm:inline-flex"
                aria-label={t("player:pictureInPicture")} title={t("player:pictureInPicture")}
              >
                <PipIcon />
              </button>
            )}
            <button type="button" onClick={onToggleFullscreen} className="pl-btn" aria-label={fullscreen ? t("player:exitFullscreen", "Exit fullscreen") : t("player:fullscreen", "Fullscreen")} title={fullscreen ? t("player:exitFullscreen", "Exit fullscreen") : t("player:fullscreen", "Fullscreen")}>
              {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
