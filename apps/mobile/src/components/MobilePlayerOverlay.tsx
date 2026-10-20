import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { View, Pressable, Animated, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import type { MediaItem, QualityDrop } from "@tentacle-tv/shared";
import { extractSourceQuality } from "@tentacle-tv/shared";
import { type QualityKey, type QualityPreset } from "../hooks/usePlayerPlayback";
import type { PlaybackOverlayResult, StillWatchingController } from "@tentacle-tv/api-client";
import { CenterControls } from "./player/CenterControls";
import { SkipIndicator } from "./player/SkipIndicator";
import { PlaybackOverlayMobile } from "./player/PlaybackOverlayMobile";
import { StillWatchingCardMobile } from "./player/StillWatchingCardMobile";
import type { LocalTrickplay } from "../hooks/offline/useLocalTrickplay";
import type { NextEpisodeArtwork } from "../hooks/offline/useNextEpisodeArtwork";
import { PlayerTopBar } from "./player/PlayerTopBar";
import { PlayerBottomBar } from "./player/PlayerBottomBar";
import { PlayerMenus } from "./player/panels/PlayerMenus";
import { EpisodePanel } from "./player/panels/EpisodePanel";
import { LocalEpisodePanel } from "./player/panels/LocalEpisodePanel";
import { useChromeInsets } from "../player/chrome/useChromeInsets";
import { playerMenusAvailable, type PlayerMenu } from "../player/panels/playerMenus";

interface Track { index: number; label: string }

interface Props {
  title: string;
  currentTime: number;
  duration: number;
  bufferedTime?: number;
  paused: boolean;
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  qualityKey: QualityKey;
  /** Badge « Auto » sur le palier actif du menu qualité. */
  autoQualityActive?: boolean;
  /** Pourquoi la qualité baisse en Auto : relisible sous les paliers. */
  qualityDrop?: QualityDrop | null;
  /** Paliers calculés d'après la source (cf. buildQualityLadder). */
  qualityPresets: readonly QualityPreset[];
  /** L'arbitre partagé : ce qu'il faut afficher, et de quoi y répondre. */
  playback: PlaybackOverlayResult;
  /** « Vous regardez encore ? » : l'encart prend la place de la pilule et de la carte de coin. */
  stillWatching?: StillWatchingController;
  nextEpisode?: MediaItem | null;
  previousEpisode?: MediaItem | null;
  /** Current item — passed to the seekbar so it can fetch trickplay tiles. */
  item?: MediaItem;
  mediaSourceId?: string;
  /** Planches gardées sur l'appareil (lecture locale). */
  localTrickplay?: LocalTrickplay | null;
  /** Lecture locale : visuels du suivant lus sur l'appareil. */
  nextArtwork?: NextEpisodeArtwork | null;
  /**
   * Lecture d'un fichier de l'appareil : rien ne part sur le réseau — planches
   * et visuels locaux seulement, pas de notation, sélecteur d'épisodes local.
   */
  localSession?: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  /** Un écart depuis la cible en cours (±10/30 s) : des appuis rapides font un seul saut. */
  onSkip?: (delta: number) => void;
  onBack: () => void;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityKey) => void;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  /** Remonte l'état de scrub à l'écran (l'arbitre s'y suspend). */
  onScrubStateChange?: (active: boolean) => void;
  visible: boolean;
  onToggle: () => void;
  /** Watch Together : le bouton du groupe, en tête de la rangée d'outils (absent hors séance). */
  groupButton?: ReactNode;
  /** L'effacement automatique COMMENCE : la barre d'état part avec les commandes. */
  onFadeStart?: () => void;
  /** Le haut droit de la barre du haut (image dans l'image, diffusion). */
  topActions?: ReactNode;
}

export function MobilePlayerOverlay({
  title, currentTime, duration, bufferedTime, paused,
  audioTracks, subtitleTracks, selectedAudio, selectedSubtitle, qualityKey, qualityPresets, autoQualityActive, qualityDrop,
  playback, stillWatching, nextEpisode, previousEpisode,
  item, mediaSourceId, localTrickplay, nextArtwork, localSession = false,
  onPlayPause, onSeek, onSkip, onBack,
  onSelectAudio, onSelectSubtitle, onSelectQuality,
  onNextEpisode, onPreviousEpisode, onScrubStateChange,
  visible, onToggle, groupButton, onFadeStart, topActions,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const edges = useChromeInsets();
  // Contrôles agrandis sur grand écran (player iPad) — téléphone inchangé (ui = 1).
  const isTablet = Math.min(screenW, screenH) >= TABLET_MIN_WIDTH;
  const ui = isTablet ? 1.4 : 1;
  const playSize = Math.min(isTablet ? 92 : 60, Math.round(screenH * 0.08));
  const centerGap = Math.min(isTablet ? 76 : 36, Math.round(screenW * 0.05));
  // UN panneau à la fois : un menu (pistes, réglages) ou les épisodes.
  const [panel, setPanel] = useState<PlayerMenu | "episodes" | null>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Indicateur « +30 / −10 » au tap des boutons de saut (même visuel que le
  // double-tap des gestes)
  const [skipSide, setSkipSide] = useState<"left" | "right" | null>(null);
  const skipFadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashSkip = useCallback((side: "left" | "right") => {
    setSkipSide(side);
    if (skipFadeTimer.current) clearTimeout(skipFadeTimer.current);
    skipFadeTimer.current = setTimeout(() => setSkipSide(null), 700);
  }, []);
  useEffect(() => () => { if (skipFadeTimer.current) clearTimeout(skipFadeTimer.current); }, []);

  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);
  const menus = playerMenusAvailable({ audio: audioTracks.length, subtitles: subtitleTracks.length, quality: qualityPresets.length });

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!paused) {
      hideTimer.current = setTimeout(() => {
        onFadeStart?.();
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onToggle());
      }, 4000);
    }
  }, [paused, opacity, onToggle, onFadeStart]);

  // Un panneau ouvert suspend l'effacement des commandes ; fermé, il le relance.
  const openPanel = useCallback((next: PlayerMenu | "episodes") => {
    setPanel(next);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);
  const closePanel = useCallback(() => { setPanel(null); resetHideTimer(); }, [resetHideTimer]);

  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      resetHideTimer();
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [visible, resetHideTimer, opacity]);

  // L'habillage peut disparaître (auto-masquage à 4 s) sans emporter la
  // surcouche de lecture : le bouton de saut et la carte « à suivre » ne
  // dépendent plus de l'OSD, comme sur le bureau et le web.
  const asking = stillWatching !== undefined && stillWatching.phase !== "none";
  const hasOverlay = playback.overlay.kind !== "none" || asking;

  if (!visible && !hasOverlay) return null;

  return (
    <>
      {visible && (
        <Animated.View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          // Liste des épisodes ouverte : pas de voile plein écran — l'image reste
          // claire, un dégradé en haut seulement porte la barre du haut (la liste
          // pose son propre voile en bas).
          opacity, backgroundColor: panel === "episodes" ? "transparent" : PLAYER.scrim,
        }}>
          {panel === "episodes" && (
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"]}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(120, edges.top + 90) }}
            />
          )}
          {/* Background tap to dismiss */}
          <Pressable
            onPress={onToggle}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Barre du haut — marge stable, heure et batterie là où iOS masque les siennes. */}
          <PlayerTopBar title={title} ui={ui} onBack={onBack} actions={topActions} />

          {/* Center controls — box-none : les zones vides laissent passer le tap
              vers le Pressable de fond (toggle overlay), seuls les boutons captent. */}
          {/* Panneau ouvert : les commandes du centre s'effacent (comme le lecteur
              d'Apple) — un menu ne se pose plus sur « suivant ». Leur place reste. */}
          {panel !== null ? <View pointerEvents="none" style={{ flex: 1 }} /> : (
            <CenterControls
              paused={paused}
              ui={ui}
              centerGap={centerGap}
              playSize={playSize}
              hasPrevious={!!previousEpisode}
              hasNext={!!nextEpisode}
              onPrevious={onPreviousEpisode}
              onNext={onNextEpisode}
              onPlayPause={() => { onPlayPause(); resetHideTimer(); }}
              onRewind={() => { if (onSkip) onSkip(-10); else onSeek(currentTime - 10); flashSkip("left"); resetHideTimer(); }}
              onForward={() => { if (onSkip) onSkip(30); else onSeek(currentTime + 30); flashSkip("right"); resetHideTimer(); }}
            />
          )}

          {/* Indicateur de saut ±10/30 (boutons) */}
          <SkipIndicator side={skipSide} />

          {/* Le bas : progression et outils, collés au bord (`chromeInsets`). La
              liste des épisodes prend sa place : rien ne passe sous elle. */}
          {panel !== "episodes" && <PlayerBottomBar
            ui={ui}
            currentTime={currentTime}
            duration={duration}
            bufferedTime={bufferedTime}
            item={item}
            mediaSourceId={mediaSourceId}
            localTrickplay={localTrickplay}
            localSession={localSession}
            onSeek={(s) => { onSeek(s); resetHideTimer(); }}
            onScrubStateChange={(active) => {
              onScrubStateChange?.(active);
              if (active) {
                if (hideTimer.current) clearTimeout(hideTimer.current);
              } else {
                resetHideTimer();
              }
            }}
            groupButton={groupButton}
            onEpisodes={item?.SeriesId ? () => openPanel("episodes") : undefined}
            onTracks={menus.tracks ? () => openPanel("tracks") : undefined}
            onSettings={menus.settings ? () => openPanel("settings") : undefined}
          />}
        </Animated.View>
      )}

      {/* La surcouche de lecture — pilule de saut ou carte « à suivre ». Hors
          du bloc `visible` : elle ne suit pas l'auto-masquage de l'habillage.
          « Vous regardez encore ? » les remplace ; l'affiche de fin reste. */}
      {(!asking || (playback.overlay.kind === "nextCard" && playback.overlay.final)) && (
        <PlaybackOverlayMobile
          overlay={playback.overlay} countdownTotals={playback.countdownTotals}
          nextEpisode={nextEpisode} currentItem={item} controlsVisible={visible}
          nextArtwork={nextArtwork} ratingEnabled={!localSession} artworkLocalOnly={localSession}
          onSkip={playback.skipNow} onDismiss={playback.dismissOverlay}
          onPlayNow={playback.playNow} onRatingEngage={playback.cancelNextCountdown}
          bottom={edges.bottom + 76} right={edges.right}
        />
      )}
      {asking && <StillWatchingCardMobile controller={stillWatching} controlsVisible={visible} />}

      {/* Les panneaux — menus et épisodes, montés seulement ouverts, sans voile :
          l'image reste visible autour (`panelLayout`). */}
      <PlayerMenus
        open={panel === "tracks" || panel === "settings" ? panel : null}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={selectedAudio}
        selectedSubtitle={selectedSubtitle}
        qualityKey={qualityKey}
        qualityPresets={qualityPresets}
        autoQualityActive={autoQualityActive}
        qualityDrop={qualityDrop}
        sourceQuality={sourceQuality}
        onSelectAudio={onSelectAudio}
        onSelectSubtitle={onSelectSubtitle}
        onSelectQuality={onSelectQuality}
        onClose={closePanel}
      />
      {/* Les épisodes : ceux de l'appareil en lecture locale (en ligne aussi :
          rien ne part), ceux du serveur sinon. */}
      {panel === "episodes" && item?.SeriesId && (localSession ? (
        <LocalEpisodePanel seriesId={item.SeriesId} currentEpisodeId={item.Id} onClose={closePanel} />
      ) : (
        <EpisodePanel seriesId={item.SeriesId} currentEpisodeId={item.Id} initialSeasonId={item.SeasonId} onClose={closePanel} />
      ))}
    </>
  );
}


