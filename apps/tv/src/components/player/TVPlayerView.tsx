import type { ElementRef } from "react";
import { View, Text, TouchableOpacity, Platform, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem, PlayerOverlay, QualityKey, SourceQuality } from "@tentacle-tv/shared";
import { MemoizedPlayer } from "./MemoizedPlayer";
import { TVPlayerOverlay } from "../TVPlayerOverlay";
import { TVPlaybackOverlay } from "../TVPlaybackOverlay";
import { TVAutoPlaySwitch, type AutoPlayCtx } from "./TVAutoPlaySwitch";
import { TVPlayerEpisodePanel } from "./TVPlayerEpisodePanel";
import { TVPlayerLoadingScreen, TVBufferingSpinner } from "./TVPlayerLoadingScreen";
import { TVReloadFrame } from "./TVReloadFrame";
import { TVScrubFullscreen } from "./TVScrubFullscreen";
import { TVSkipBadge } from "./TVSkipBadge";
import { TVAutoCapBadge } from "./TVAutoCapBadge";
import { TVSubtitleOverlay, type SubtitleCue } from "./TVSubtitleOverlay";
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
  /** Bouton ⏩ : appui simple → mode scrub (l'OSD se masque, plein écran) */
  enterScrub: () => void;
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
  /** Cap automatique de qualité actif (débit mesuré insuffisant) → badge 5 s. */
  capAutoActif?: boolean;
  displayTime: number;
  bufferedTime: number;
  displayDuration: number;
  showSettings: boolean;
  autoPlayActive: boolean;
  hasPreviousEpisode: boolean;

  // Player refs
  useExoPlayer: boolean;
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
  /** Ce que l'arbitre partagé demande d'afficher — un passage, une carte, rien. */
  overlay: PlayerOverlay;
  /** Saut manuel du bouton, et refus du passage courant. */
  onSkipSegment: () => void;
  onDismissSegment: () => void;
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
  subtitleCue?: SubtitleCue | null;
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
  item, streamUrl, paused, playerPaused, isLoading, hasStarted, videoError, capAutoActif, displayTime, bufferedTime,
  displayDuration, showSettings, autoPlayActive, hasPreviousEpisode,
  useExoPlayer, isDirectPlay, exoRef, mpvRef, backgroundRef, playerStyle,
  subtitleIndex,
  autoPlay, controls,
  onLoad, onProgress, onEnd, onError, onTracks, onVideoSize,
  onPlayPause, onBack, onToggleSettings,
  
  onPrevEpisode, onNextEpisode, trickplay, reloadFrameSec, pauseFrameUri, osdFocusSignal, subtitleCue, textTracks,
  showEpisodes, onToggleEpisodes, onCloseEpisodes, onSelectEpisode, onEofDismiss,
  overlay, onSkipSegment, onDismissSegment,
}: TVPlayerViewProps) {
  const { t } = useTranslation("player");

  // Le fond n'est focusable que quand l'OSD est CACHÉ (et aucun panneau) :
  // OK/direction sur le fond → showOverlay, puis le focus passe aux boutons.
  // En SCRUB, `paused` est vrai mais l'OSD est masqué : le fond DOIT reprendre
  // le focus (←/→ → curseur fantôme, OK → confirmation globale).
  const overlayShown = controls.overlayVisible || (paused && !controls.scrubbing);
  const panelOpen = showSettings || autoPlayActive || !!showEpisodes;
  const backgroundFocusable = !overlayShown && !panelOpen;

  // Un bouton de saut monté garde le focus, sinon c'est le fond qui doit le
  // récupérer. La question se pose à l'ARBITRE et non à une fenêtre recalculée
  // ici : l'ancienne règle ignorait le refus, le panneau épisodes et le
  // démarrage de lecture (le fond renonçait au focus sans qu'aucun bouton
  // existe : D-pad muet sur tvOS), et ne connaissait que deux types sur cinq.
  const skipActive = overlay.kind === "skip";

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
        hasTVPreferredFocus={backgroundFocusable}
        focusable={backgroundFocusable}
        accessible={backgroundFocusable}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
      >
        <View style={{ flex: 1 }} />
      </TouchableOpacity>
      {/* Sous-titres texte : Android = natif ExoPlayer en direct play, overlay JS
          en MPV/transcode. tvOS = overlay JS PARTOUT — cf. useTVSubtitleSync. */}
      {(Platform.OS === "ios" || !useExoPlayer) && (
        <TVSubtitleOverlay cue={subtitleCue ?? null} osdVisible={overlayShown} />
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
      <TVAutoCapBadge actif={!!capAutoActif} />
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
        // Épisode : la série en TITRE, « S02E05 · Titre » en sous-titre (LG).
        title={item?.Type === "Episode" ? (item.SeriesName ?? item.Name ?? "") : (item?.Name ?? "")}
        subtitle={
          item?.Type === "Episode" && item.ParentIndexNumber != null && item.IndexNumber != null
            ? `S${String(item.ParentIndexNumber).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · ${item.Name}`
            : null
        }
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
        // Bouton ⏩ unique : appui simple → mode scrub ; déjà en scrub →
        // guardScrub transforme l'appui en CONFIRMATION du seek.
        onScrub={controls.guardScrub(controls.enterScrub)}
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
          Netflix) — l'OSD est MASQUÉ pendant le scrub, le fond reprend le
          focus. Aucun focusable, pointerEvents none. */}
      {controls.scrubbing && (
        <TVScrubFullscreen
          scrubPosition={controls.scrubPosition}
          currentTime={displayTime}
          duration={displayDuration}
          speedLabel={controls.speedLabel}
          trickplay={trickplay}
        />
      )}
      {/* Le bouton de saut — un seul, pour les cinq types de passage. Ce qu'il
          propose et où il mène est tranché par l'arbitre : le générique d'un
          épisode qui a une suite n'en a plus (c'est la carte « à suivre » qui
          l'occupe), et une scène post-générique en a un qui y saute. */}
      <TVPlaybackOverlay
        overlay={overlay}
        onSkip={controls.guardScrub(onSkipSegment)}
        onDismiss={onDismissSegment}
        overlayVisible={controls.overlayVisible}
        showSettings={showSettings}
        showEpisodes={!!showEpisodes}
      />
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
