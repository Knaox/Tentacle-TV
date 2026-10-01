import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient, STAGE_SIZE } from "../../background/SoftGradient";
import { FocusGroup } from "../../focus/FocusGroup";
import { Presented } from "../../motion/Presented";
import { useMotion } from "../../motion/useMotion";
import { scrim } from "../../theme/tokens";
import { EndScreen } from "./EndScreen";
import { EpisodesPanel } from "./EpisodesPanel";
import { FrameView } from "./FrameView";
import { OsdControls, type OsdControlsProps } from "./OsdControls";
import { OsdTimeline } from "./OsdTimeline";
import { OsdTopBar } from "./OsdTopBar";
import { BufferingBadge, ErrorBanner, QualityNotice } from "./PlaybackStatus";
import { PlayerLoading } from "./PlayerLoading";
import type {
  EndScreenModel, FrameImage, PlayerLabels, PlayerMedia, PlayerPanel, PlayerPhase, PlayerTimeline, ScrubModel,
  SkipPillModel, SubtitleCue, UpNextModel,
} from "./playerTypes";
import { ScrubOverlay } from "./ScrubOverlay";
import { SeekFlash } from "./SeekFlash";
import { SkipPill } from "./SkipPill";
import { SubtitleLayer } from "./SubtitleLayer";
import { TracksPanel } from "./TracksPanel";
import { UpNextCard } from "./UpNextCard";

/**
 * L'HABILLAGE du lecteur TV — tout ce qui se pose sur la vidéo, jamais la
 * vidéo elle-même (le moteur vit sous la vue, l'intégration le monte).
 *
 * Contrat : un état résolu en entrée, des gestes en sortie. Alimenté par :
 * - `usePlayerMediaState` : `paused`, `timeline` (displayTime, bufferedTime),
 *   `buffering` (isLoading && hasStarted), `error` (videoError, 8 s) ;
 * - `useTVPlayerControls` : `osdVisible` (overlayVisible, ou pause hors
 *   défilement), `scrub` (scrubbing, scrubPosition, speedLabel), `seekFlash`
 *   (skipFlash), et les gestes du transport ;
 * - `useTVTrickplay` : `scrub.frame`, `reloadFrame` (vignette de la position) ;
 * - `useTVPlaybackOverlay` (arbitre partagé) : `skip` (overlay skip ou
 *   nextButton, libellé par `skipPillLabel`), `upNext` (nextCard du
 *   générique), `endScreen` (nextCard final) — images et titres par
 *   `useNextEpisodeMedia` ;
 * - `useTVPrismProgress` : `phase.step` ; `useTVTrackLists` + qualité
 *   (`buildQualityLadder`, `extractSourceQuality`) : `panel` pistes ;
 *   `useSeasonBrowser` : `panel` épisodes ; `useTVSubtitleSync` : `subtitle` ;
 *   `useTVAutoQualityCap` : `notice`.
 * Les clés de focus sont listées dans chaque sous-vue ; aucune décision de
 * focus ici (entrée, Retour, restauration : l'intégration).
 *
 * Groupes (`FocusGroup`) : `player:osd` — tout l'habillage (Retour, frise,
 * commandes), là où l'intégration pose sa mémoire du dernier bouton ;
 * `player:timeline` — la frise, passive, que le focus TRAVERSE en montant des
 * commandes vers la pilule de saut.
 *
 * Mouvement (Apple TV) : l'habillage paraît vite — la frise et les commandes
 * montent de quelques points, la barre du haut descend — et s'efface
 * posément à l'inactivité (préréglage `chrome`) ; le badge de saut entre et
 * sort en fondu ; panneaux, carte « À suivre » et écran de fin entrent en
 * glissant (chacun chez lui).
 */

export interface PlayerChromeViewProps extends Omit<OsdControlsProps, "transport" | "paused" | "labels"> {
  media: PlayerMedia;
  labels: PlayerLabels;
  phase: PlayerPhase;
  timeline: PlayerTimeline;
  transport: OsdControlsProps["transport"];
  paused: boolean;
  /** L'habillage à l'écran (commandes, frise, titre). */
  osdVisible: boolean;
  buffering?: boolean;
  scrub?: ScrubModel | null;
  seekFlash?: { forward: boolean; label: string } | null;
  skip?: SkipPillModel | null;
  upNext?: UpNextModel | null;
  endScreen?: EndScreenModel | null;
  panel?: PlayerPanel | null;
  /** Rechargement doux (piste, qualité) : l'image figée à la position. */
  reloadFrame?: FrameImage | null;
  /** « Qualité réduite… » — le plafond automatique de débit. */
  notice?: string | null;
  error?: { title: string; message?: string } | null;
  subtitle?: SubtitleCue | null;
  onBack?: () => void;
  onRetry?: () => void;
  onSkip?: () => void;
  onDismissSkip?: () => void;
  onPlayNext?: () => void;
  onDismissNext?: () => void;
  /** L'affiche de fin refusée : retour à la fiche. */
  onLeaveEnd?: () => void;
  onSelectSeason?: (id: string) => void;
  onSelectEpisode?: (id: string) => void;
  onSelectAudio?: (key: string) => void;
  onSelectSubtitle?: (key: string) => void;
  onSelectQuality?: (key: string) => void;
  onClosePanel?: () => void;
}

const SAFE = TV_STAGE.safe;
/** Le voile du bas, sous la frise et les commandes. */
const BOTTOM_SCRIM = 540;

export const PlayerChromeView = memo(function PlayerChromeView(props: PlayerChromeViewProps) {
  const { media, labels, phase, timeline, paused, osdVisible, scrub, panel, endScreen, upNext, skip } = props;
  const playing = phase.kind === "playing";
  // L'habillage recule devant ce qui le recouvre : panneau, défilement, fin.
  const chrome = playing && osdVisible && !panel && !scrub && !endScreen;
  const shown = useMotion(chrome, "chrome");
  const dim = useMotion(playing && paused && !scrub && !endScreen, "veil");
  const chromeStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -TV_MOTION.player.chromeDrop * (1 - shown.value) }] }));
  const bottomStyle = useAnimatedStyle(() => ({ transform: [{ translateY: TV_MOTION.player.chromeRise * (1 - shown.value) }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {props.reloadFrame ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <FrameView frame={props.reloadFrame} />
        </View>
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pauseDim, dimStyle]} />
      {props.subtitle && playing && !scrub && !endScreen ? <SubtitleLayer cue={props.subtitle} raised={chrome} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, chromeStyle]} pointerEvents={chrome ? "box-none" : "none"}>
        <FocusGroup focusKey="player:osd" style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <SoftGradient width={STAGE_SIZE.width} height={BOTTOM_SCRIM} colors={[scrim(0), scrim(0.66), scrim(0.94)]} locations={[0, 0.48, 1]} style={styles.bottomScrim} />
          <Animated.View style={[StyleSheet.absoluteFill, topStyle]} pointerEvents="box-none">
            <OsdTopBar media={media} backLabel={labels.back} onBack={props.onBack} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, bottomStyle]} pointerEvents="box-none">
            <FocusGroup focusKey="player:timeline" style={styles.timeline} pointerEvents="none">
              <OsdTimeline position={timeline.position} duration={timeline.duration} buffered={timeline.buffered} segments={timeline.segments} />
            </FocusGroup>
            <View style={styles.controls} pointerEvents="box-none">
              <OsdControls
                transport={props.transport}
                paused={paused}
                labels={labels}
                onPlayPause={props.onPlayPause}
                onSeekBack={props.onSeekBack}
                onSeekForward={props.onSeekForward}
                onScrub={props.onScrub}
                onPrevious={props.onPrevious}
                onNext={props.onNext}
                onOpenEpisodes={props.onOpenEpisodes}
                onOpenTracks={props.onOpenTracks}
              />
            </View>
          </Animated.View>
        </FocusGroup>
      </Animated.View>
      {props.buffering || props.reloadFrame ? <BufferingBadge /> : null}
      <Presented value={props.seekFlash && !scrub ? props.seekFlash : null} motion="reveal">
        {(flash, appear) => <SeekFlash forward={flash.forward} label={flash.label} appear={appear} />}
      </Presented>
      {props.notice && playing ? <QualityNotice text={props.notice} /> : null}
      {props.error ? <ErrorBanner title={props.error.title} message={props.error.message} /> : null}
      {skip && playing && !scrub && !panel && !endScreen ? (
        <SkipPill model={skip} raised={chrome} dismissLabel={labels.dismiss} onSkip={props.onSkip} onDismiss={props.onDismissSkip} />
      ) : null}
      {upNext && playing && !scrub && !panel && !endScreen ? (
        <UpNextCard model={upNext} labels={labels} onPlayNext={props.onPlayNext} onDismiss={props.onDismissNext} />
      ) : null}
      {scrub && playing ? (
        <ScrubOverlay scrub={scrub} timeline={timeline} confirmLabel={labels.scrubConfirm} cancelLabel={labels.scrubCancel} />
      ) : null}
      {panel?.kind === "episodes" ? (
        <EpisodesPanel
          model={panel.episodes}
          labels={labels}
          onSelectSeason={props.onSelectSeason}
          onSelectEpisode={props.onSelectEpisode}
          onClose={props.onClosePanel}
        />
      ) : null}
      {panel?.kind === "tracks" ? (
        <TracksPanel
          model={panel.tracks}
          labels={labels}
          onSelectAudio={props.onSelectAudio}
          onSelectSubtitle={props.onSelectSubtitle}
          onSelectQuality={props.onSelectQuality}
          onClose={props.onClosePanel}
        />
      ) : null}
      {endScreen ? <EndScreen model={endScreen} labels={labels} onPlayNext={props.onPlayNext} onLeave={props.onLeaveEnd} /> : null}
      {phase.kind !== "playing" ? <PlayerLoading media={media} phase={phase} labels={labels} onBack={props.onBack} onRetry={props.onRetry} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  pauseDim: { backgroundColor: scrim(0.28) },
  bottomScrim: { top: STAGE_SIZE.height - BOTTOM_SCRIM },
  timeline: { position: "absolute", left: SAFE.x, right: SAFE.x, top: 818 },
  controls: { position: "absolute", left: SAFE.x, right: SAFE.x, top: 888 },
});
