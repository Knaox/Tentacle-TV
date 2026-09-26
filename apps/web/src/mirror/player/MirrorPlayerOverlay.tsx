import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useEpisodeNavigation } from "@tentacle-tv/api-client";
import { MediaStateLayers } from "./controls/MediaStateLayers";
import { PlayerChrome } from "./controls/PlayerChrome";
import { PlayerGestures } from "./controls/PlayerGestures";
import { EpisodePicker } from "./episodes/EpisodePicker";
import { SettingsMenus } from "./menus/SettingsMenus";
import { PlaybackOverlayMirror } from "./overlay/PlaybackOverlayMirror";
import { SKIP_BACK_SECONDS, SKIP_FORWARD_SECONDS } from "./playerMetrics";
import type { MirrorPlayerOverlayProps } from "./types";
import { usePlayerChrome } from "./usePlayerChrome";

/** Rien ne traverse vers la surface du lecteur web (clic = lecture/pause, double-clic = plein écran, balayage = saut). */
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * La surcouche TACTILE du lecteur web dans le miroir de l'app mobile —
 * `MobilePlayerOverlay` de l'app, branché comme dans `PlayerScreen` : même
 * habillage (voile, barre du haut, rangée centrale, barre de lecture et
 * boutons), mêmes gestes (tap, double-tap ±, balayage vers le bas), mêmes
 * menus en pop-up, même sélecteur d'épisodes, même rendu de l'arbitre (pilule,
 * carte « à suivre », affiche de fin) et même écran de chargement.
 *
 * Le MOTEUR reste celui du web (`VideoPlayer`) : cette surcouche reçoit ses
 * états et ses commandes (`controls`, ceux de la barre du bureau) sans rien
 * décider de la lecture. Seules la visibilité de l'habillage et l'état de
 * glissé remontent au lecteur, par le pont (`useMirrorPlayerBridge`).
 */
export function MirrorPlayerOverlay({ controls, playback, bridge, media }: MirrorPlayerOverlayProps) {
  const {
    playing, currentTime, duration, buffered, item, mediaSourceId, title,
    audioTracks, subtitleTracks, currentAudio, currentSubtitle, currentQuality, sourceQuality,
    qualityPresets, autoQualityActive, hasNextEpisode, hasPreviousEpisode,
    onTogglePlay, onSeek, onSkip, onBack, onAudioChange, onSubtitleChange, onQualityChange,
    onNextEpisode, onPreviousEpisode,
  } = controls;
  const { visible, setVisible, setScrubbing } = bridge;
  const paused = !playing;
  const chrome = usePlayerChrome({ visible, setVisible, paused });
  const { resetHideTimer, clearHide } = chrome;
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  // La carte et l'affiche de fin veulent le MÉDIA suivant (vignette, titre,
  // synopsis) : même requête que la page, servie par le cache.
  const { nextEpisode } = useEpisodeNavigation(item);

  const skipBy = useCallback((delta: number) => {
    if (onSkip) onSkip(delta);
    else onSeek(Math.max(0, currentTime + delta));
  }, [onSkip, onSeek, currentTime]);

  // L'indicateur « −10 / +30 » des boutons de saut (700 ms).
  const [skipSide, setSkipSide] = useState<"left" | "right" | null>(null);
  const skipFade = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashSkip = useCallback((side: "left" | "right") => {
    setSkipSide(side);
    clearTimeout(skipFade.current);
    skipFade.current = setTimeout(() => setSkipSide(null), 700);
  }, []);
  useEffect(() => () => clearTimeout(skipFade.current), []);

  const onScrubStateChange = useCallback((active: boolean) => {
    setScrubbing(active);
    if (active) clearHide();
    else resetHideTimer();
  }, [setScrubbing, clearHide, resetHideTimer]);

  const selectSubtitle = useCallback((index: number) => onSubtitleChange(index === -1 ? null : index), [onSubtitleChange]);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-20 select-none"
      onClick={stop}
      onDoubleClick={stop}
      onTouchStart={stop}
      onTouchEnd={stop}
    >
      <MediaStateLayers media={media} item={item} onBack={onBack} />

      {media.hasStarted && visible && (
        <PlayerChrome
          opacity={chrome.opacity}
          title={item?.Name ?? title}
          paused={paused}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          item={item}
          mediaSourceId={mediaSourceId}
          hasPrevious={!!hasPreviousEpisode}
          hasNext={!!hasNextEpisode}
          hasSubtitles={subtitleTracks.length > 0}
          skipSide={skipSide}
          videoRef={media.videoRef}
          onBackgroundTap={chrome.toggle}
          onBack={onBack}
          onPlayPause={() => { onTogglePlay(); resetHideTimer(); }}
          onRewind={() => { skipBy(-SKIP_BACK_SECONDS); flashSkip("left"); resetHideTimer(); }}
          onForward={() => { skipBy(SKIP_FORWARD_SECONDS); flashSkip("right"); resetHideTimer(); }}
          onPrevious={onPreviousEpisode}
          onNext={onNextEpisode}
          onSeek={(s) => { onSeek(s); resetHideTimer(); }}
          onScrubStateChange={onScrubStateChange}
          onOpenEpisodes={() => { setShowEpisodes(true); clearHide(); }}
          onOpenSubtitles={() => { setShowSubtitles(true); setShowSettings(false); clearHide(); }}
          onOpenSettings={() => { setShowSettings(true); setShowSubtitles(false); clearHide(); }}
        />
      )}

      {media.hasStarted && (
        <PlayerGestures overlayVisible={visible} onSkip={skipBy} onToggleOverlay={chrome.toggle} onSwipeDown={onBack} />
      )}

      {/* Hors du bloc `visible` : la surcouche de lecture ne suit pas l'auto-masquage. */}
      <PlaybackOverlayMirror playback={playback} nextEpisode={nextEpisode} currentItem={item} controlsVisible={visible} />

      <SettingsMenus
        showSettings={showSettings}
        showSubtitles={showSubtitles}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={currentAudio}
        selectedSubtitle={currentSubtitle ?? -1}
        qualityKey={currentQuality}
        qualityPresets={qualityPresets ?? []}
        autoQualityActive={autoQualityActive}
        sourceQuality={sourceQuality}
        onSelectAudio={onAudioChange}
        onSelectSubtitle={selectSubtitle}
        onSelectQuality={onQualityChange}
        onCloseSettings={() => { setShowSettings(false); resetHideTimer(); }}
        onCloseSubtitles={() => { setShowSubtitles(false); resetHideTimer(); }}
      />

      {item?.SeriesId && (
        <EpisodePicker
          visible={showEpisodes}
          seriesId={item.SeriesId}
          currentEpisodeId={item.Id}
          initialSeasonId={item.SeasonId}
          onClose={() => { setShowEpisodes(false); resetHideTimer(); }}
        />
      )}
    </div>
  );
}
