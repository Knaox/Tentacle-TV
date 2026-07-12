import type { ElementRef } from "react";
import { View, Text, TouchableOpacity, Platform, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem, SegmentTimestamps, QualityKey, SourceQuality } from "@tentacle-tv/shared";
import { MemoizedPlayer } from "./MemoizedPlayer";
import { TVPlayerOverlay } from "../TVPlayerOverlay";
import { TVSkipSegmentButton } from "../TVSkipSegmentButton";
import { TVAutoPlaySwitch, type AutoPlayCtx } from "./TVAutoPlaySwitch";
import { TVPlayerEpisodePanel } from "./TVPlayerEpisodePanel";
import { TVPlayerLoadingScreen, TVBufferingSpinner } from "./TVPlayerLoadingScreen";
import { TVReloadFrame } from "./TVReloadFrame";
import { TVScrubFullscreen } from "./TVScrubFullscreen";
import { TVSkipBadge } from "./TVSkipBadge";
import { TVSubtitleOverlay } from "./TVSubtitleOverlay";
import type { MPVPlayerHandle, MpvTrack } from "./MPVPlayer";
import type { ExoTextTrack } from "./ExoPlayer";
import type { UseTVTrickplayResult } from "../../hooks/useTVTrickplay";
import { useTVFocusGrab } from "../../hooks/useTVFocusGrab";

interface ControlsCtx {
  overlayVisible: boolean;
  scrubbing: boolean;
  scrubPosition: number;
  /** Badge éphémère « +30s / −10s » après un skip OSD caché */
  skipFlash: { delta: number; id: number } | null;
  speedLabel?: string | null;
  showOverlay: () => void;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
  /** Tap court ⏪/⏩ (Android) : petit saut immédiat sans fantôme */
  handleNudgeBack: () => void;
  handleNudgeForward: () => void;
  /** Avance/recul rapide au MAINTIEN : début (accélération) / fin (figé, OK confirme) */
  buttonSeekStart: (dir: "forward" | "backward") => void;
  buttonSeekStop: () => void;
  /** Scrub initié par un bouton OSD maintenu → focus non verrouillé */
  scrubViaButton: boolean;
  /** En mode scrub, OK sur un bouton valide le scrub au lieu d'agir */
  guardScrub: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
}

export interface TVPlayerViewProps {
  // Item & state
  item?: MediaItem | null;
  streamUrl: string;
  paused: boolean;
  /** Pause EFFECTIVE de la surface (paused || reloadHold) : garde le lecteur en pause pendant un reload
   *  remux (anti son sortant) sans changer l'intention `paused` (OSD/reporting). Défaut = paused. */
  playerPaused?: boolean;
  isLoading: boolean;
  /** Lecture déjà démarrée — distingue chargement initial / rebuffering */
  hasStarted: boolean;
  videoError: string | null;
  displayTime: number;
  bufferedTime: number;
  displayDuration: number;
  showSettings: boolean;
  autoPlayActive: boolean;
  hasPreviousEpisode: boolean;

  // Player refs
  useExoPlayer: boolean;
  isLocalRemux?: boolean;   // remux on-device tvOS → overlay sous-titres JS (pas de piste manifeste)
  /** Direct play vs transcode HLS (décision serveur) — gate le sideload tvOS. */
  isDirectPlay: boolean;
  exoRef: React.Ref<MPVPlayerHandle>;
  mpvRef: React.Ref<MPVPlayerHandle>;
  backgroundRef: React.Ref<ElementRef<typeof TouchableOpacity>>;
  playerStyle: ViewStyle;

  // Tracks / qualité
  audioTracksList: { index: number; label: string }[];
  subtitleTracksList: { index: number; label: string }[];
  audioIndex: number;
  subtitleIndex: number;
  qualityKey: QualityKey;
  sourceQuality?: SourceQuality;
  skipSegments: { intro: SegmentTimestamps | null; credits: SegmentTimestamps | null };
  autoPlay: AutoPlayCtx;
  controls: ControlsCtx;

  // Handlers
  onLoad: (duration: number) => void;
  onProgress: (currentTime: number, buffered: number) => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onTracks: (tracks: MpvTrack[]) => void;
  onVideoSize: (width: number, height: number, pixelRatio: number) => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onToggleSettings: () => void;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityKey) => void;
  onCloseSettings: () => void;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  /** Vignettes de prévisualisation pendant le scrub */
  trickplay?: UseTVTrickplayResult;
  /** Position figée (s) à afficher pendant un reload doux (audio/qualité) ;
   *  null = pas de reload doux en cours. */
  reloadFrameSec?: number | null;
  /** Capture réelle de la dernière frame (pause longue remux) — prioritaire
   *  sur la vignette trickplay dans TVReloadFrame. */
  pauseFrameUri?: string | null;
  /** Incrémenter pour refocus le dernier bouton OSD utilisé */
  osdFocusSignal?: number;
  /** Cue de sous-titres texte rendue en JS (useTVSubtitles) — MPV/transcode */
  subtitleText?: string | null;
  /** Pistes texte VTT pour le rendu natif ExoPlayer (direct play) */
  textTracks?: ExoTextTrack[];
  /** Panneau Saisons & épisodes (séries) */
  showEpisodes?: boolean;
  onToggleEpisodes?: () => void;
  onCloseEpisodes?: () => void;
  onSelectEpisode?: (episode: MediaItem) => void;
  /** Dismiss de l'écran de FIN (« Ignorer ») : à la vraie fin → retour fiche média. */
  onEofDismiss?: () => void;
}

export function TVPlayerView({
  item, streamUrl, paused, playerPaused, isLoading, hasStarted, videoError, displayTime, bufferedTime,
  displayDuration, showSettings, autoPlayActive, hasPreviousEpisode,
  useExoPlayer, isLocalRemux, isDirectPlay, exoRef, mpvRef, backgroundRef, playerStyle,
  audioTracksList, subtitleTracksList, audioIndex, subtitleIndex,
  qualityKey, sourceQuality, skipSegments, autoPlay, controls,
  onLoad, onProgress, onEnd, onError, onTracks, onVideoSize,
  onPlayPause, onSeek, onBack, onToggleSettings,
  onSelectAudio, onSelectSubtitle, onSelectQuality, onCloseSettings,
  onPrevEpisode, onNextEpisode, trickplay, reloadFrameSec, pauseFrameUri, osdFocusSignal, subtitleText, textTracks,
  showEpisodes, onToggleEpisodes, onCloseEpisodes, onSelectEpisode, onEofDismiss,
}: TVPlayerViewProps) {
  const { t } = useTranslation("player");

  // Le fond n'est focusable que quand l'OSD est CACHÉ (et aucun panneau) :
  // OK/direction sur le fond → showOverlay, puis le focus passe aux boutons.
  const overlayShown = controls.overlayVisible || paused;
  const panelOpen = showSettings || autoPlayActive || !!showEpisodes;
  const backgroundFocusable = !overlayShown && !panelOpen;

  // Un segment skip (intro/générique) dans sa plage garde le focus (cf. skip
  // button), sinon c'est le fond qui doit le récupérer.
  const inSeg = (s?: { start: number; end: number } | null) =>
    !!s && displayTime >= s.start && displayTime < s.end - 1;
  const skipActive = inSeg(skipSegments.intro) || inSeg(skipSegments.credits);

  // tvOS : dès que l'OSD se cache (et qu'aucun panneau / skip n'est actif),
  // ramener le focus sur le fond pour que le D-pad continue d'émettre ses events
  // et puisse rallumer l'OSD (parité avec useFocusRecovery côté Android).
  useTVFocusGrab(
    backgroundRef as unknown as React.RefObject<unknown>,
    backgroundFocusable && !skipActive,
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <MemoizedPlayer
        useExoPlayer={useExoPlayer} exoRef={exoRef} mpvRef={mpvRef}
        source={streamUrl} paused={playerPaused ?? paused} playerStyle={playerStyle}
        // Mute de transition (filet secondaire) : tant que l'image figée masque la vidéo, couper l'audio de
        // la session sortante. Le vrai blocage du son vient du « hold » (playerPaused) côté PlayerScreen.
        muted={reloadFrameSec != null && hasStarted}
        textTracks={textTracks} subtitleIndex={subtitleIndex} isDirectPlay={isDirectPlay}
        onLoad={onLoad} onProgress={onProgress} onEnd={onEnd}
        onError={onError} onTracks={onTracks} onVideoSize={onVideoSize}
      />
      <TouchableOpacity
        ref={backgroundRef} activeOpacity={1}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={controls.showOverlay}
        // @ts-ignore react-native-tvos
        hasTVPreferredFocus={backgroundFocusable}
        focusable={backgroundFocusable}
        accessible={backgroundFocusable}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
      >
        <View style={{ flex: 1 }} />
      </TouchableOpacity>
      {/* Sous-titres : Android = natif (subtitleView ExoPlayer) en direct play,
          overlay JS en MPV/transcode. tvOS (AVPlayer) = NATIF partout : sideload
          VTT en direct play, pistes du manifeste HLS (SubtitleMethod=Hls) en
          transcode → pas d'overlay JS. */}
      {((!useExoPlayer && Platform.OS !== "ios") || isLocalRemux) && (
        <TVSubtitleOverlay text={subtitleText ?? null} osdVisible={overlayShown} />
      )}
      {/* Badge « +30s / −10s » après un double-clic ←/→ (OSD caché) */}
      <TVSkipBadge flash={controls.skipFlash} />
      {/* Chargement initial OU rechargement de flux (piste/qualité) : écran
          contextualisé couvrant jusqu'à la première position réelle (parité
          PlayerLoadingScreen web) ; rebuffering : spinner discret */}
      {!hasStarted && !videoError && <TVPlayerLoadingScreen item={item} />}
      {/* Reload doux (audio/qualité) : « dernière image » (vignette trickplay)
          pour masquer le noir d'AVPlayer pendant le re-buffer, sous le spinner. */}
      {reloadFrameSec != null && hasStarted && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
        >
          <TVReloadFrame
            trickplay={trickplay}
            positionSeconds={reloadFrameSec}
            captureUri={pauseFrameUri}
            width={typeof playerStyle.width === "number" ? playerStyle.width : 0}
            height={typeof playerStyle.height === "number" ? playerStyle.height : 0}
          />
        </View>
      )}
      {isLoading && hasStarted && <TVBufferingSpinner />}
      {videoError && (
        <View style={{
          position: "absolute", top: 60, left: 40, right: 40,
          backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 8, padding: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{t("playbackError")}</Text>
          <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{videoError}</Text>
        </View>
      )}
      <TVPlayerOverlay
        title={item?.Name ?? ""}
        currentTime={displayTime}
        bufferedTime={bufferedTime}
        duration={displayDuration} paused={paused}
        visible={controls.overlayVisible && !autoPlayActive}
        speedLabel={controls.speedLabel}
        scrubbing={controls.scrubbing} scrubPosition={controls.scrubPosition}
        focusSignal={osdFocusSignal}
        onPlayPause={controls.guardScrub(() => { onPlayPause(); controls.showOverlay(); })}
        onSkipBack={controls.guardScrub(() => { controls.handleSkipBack(); controls.showOverlay(); })}
        onSkipForward={controls.guardScrub(() => { controls.handleSkipForward(); controls.showOverlay(); })}
        onRewind={() => { controls.buttonSeekStart("backward"); controls.showOverlay(); }}
        onRewindEnd={() => controls.buttonSeekStop()}
        onFastForward={() => { controls.buttonSeekStart("forward"); controls.showOverlay(); }}
        onFastForwardEnd={() => controls.buttonSeekStop()}
        // Android : le MAINTIEN passe par le canal natif tntCenterHold (les
        // pressIn/Out JS y sont ignorés) — le press JS ne reste déclenché que
        // par un TAP court : petit saut immédiat ; en scrub préparé, guardScrub
        // CONFIRME le seek (OK sur ⏩/⏪ = « Lire ici », comme les autres boutons).
        // tvOS garde pressIn/Out (maintien JS) : pas de onPress, sinon le
        // relâchement d'un hold confirmerait le scrub (auto-confirm de facto).
        onRewindTap={Platform.OS === "android"
          ? controls.guardScrub(() => { controls.handleNudgeBack(); controls.showOverlay(); })
          : undefined}
        onFastForwardTap={Platform.OS === "android"
          ? controls.guardScrub(() => { controls.handleNudgeForward(); controls.showOverlay(); })
          : undefined}
        scrubViaButton={controls.scrubViaButton}
        // SEUL handler OSD historiquement non gardé : en scrub, le focus peut être
        // resté sur Retour → OK déclenchait son onPress natif et QUITTAIT la vidéo.
        // guardScrub : pendant un scrub, OK = valider le seek, jamais l'action du bouton.
        onBack={controls.guardScrub(onBack)}
        onSettings={controls.guardScrub(onToggleSettings)}
        onNextEpisode={onNextEpisode ? controls.guardScrub(onNextEpisode) : undefined}
        onPrevEpisode={onPrevEpisode ? controls.guardScrub(onPrevEpisode) : undefined}
        hasNextEpisode={!!autoPlay.nextEpisode} hasPreviousEpisode={hasPreviousEpisode}
        onEpisodes={item?.SeriesId && onToggleEpisodes ? controls.guardScrub(onToggleEpisodes) : undefined}
      />
      {/* Prévisualisation trickplay PLEIN ÉCRAN pendant le scrub (façon
          Netflix) — couvre l'OSD, qui reste monté dessous (boutons FF/RW
          tenus + verrou focus). Aucun focusable, pointerEvents none. */}
      {controls.scrubbing && (
        <TVScrubFullscreen
          scrubPosition={controls.scrubPosition}
          currentTime={displayTime}
          duration={displayDuration}
          speedLabel={controls.speedLabel}
          trickplay={trickplay}
        />
      )}
      {!autoPlayActive && (
        <>
          <TVSkipSegmentButton type="intro" segment={skipSegments.intro}
            currentTime={displayTime} onSkip={controls.guardScrub(() => onSeek(skipSegments.intro!.end))}
            overlayVisible={controls.overlayVisible} showSettings={showSettings}
            showEpisodes={!!showEpisodes} />
          {/* Générique : avec un épisode suivant, le bouton devient
              « Épisode suivant » et lance la carte À suivre (comme le web). */}
          <TVSkipSegmentButton type="credits" segment={skipSegments.credits}
            currentTime={displayTime}
            labelOverride={autoPlay.nextEpisode ? t("nextEpisodeLabel", { defaultValue: "Épisode suivant" }) : undefined}
            onSkip={controls.guardScrub(() => {
              if (autoPlay.nextEpisode) autoPlay.startAutoPlay();
              else onSeek(skipSegments.credits!.end);
            })}
            overlayVisible={controls.overlayVisible} showSettings={showSettings}
            showEpisodes={!!showEpisodes} />
        </>
      )}
      {showEpisodes && item?.SeriesId && onSelectEpisode && onCloseEpisodes && (
        <TVPlayerEpisodePanel
          seriesId={item.SeriesId}
          currentEpisode={item}
          onSelectEpisode={onSelectEpisode}
          onClose={onCloseEpisodes}
        />
      )}
      {/* Réglages/Qualité : présenté en route MODALE (PlayerSettingsScreen),
          plus en overlay ici → ESC ferme la modale proprement sans flash. */}
      {/* Crédits → bannière « À suivre » ; vraie fin (eof) → écran plein. */}
      <TVAutoPlaySwitch autoPlay={autoPlay} active={autoPlayActive} onEofDismiss={onEofDismiss} />
    </View>
  );
}
