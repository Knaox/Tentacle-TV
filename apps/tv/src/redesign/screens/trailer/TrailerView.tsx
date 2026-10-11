import { memo, useRef, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BACK_TOP, BackButton } from "../../controls/BackButton";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { Presented } from "../../motion/Presented";
import { useExit, useMotion } from "../../motion/useMotion";
import { SWAP_FLOOR } from "../../motion/useSwap";
import { colors, fonts, scrim, text } from "../../theme/tokens";
import { ActivitySpinner } from "../../controls/ActivitySpinner";
import { SeekFlash } from "../player/SeekFlash";
import { SubtitleLayer } from "../player/SubtitleLayer";
import { TrailerChrome } from "./TrailerChrome";
import { TrailerPanelSheet } from "./TrailerPanelSheet";
import { TRAILER_CLOSE_KEY } from "@tentacle-tv/tv-core";
import type { SubtitleCue, TrailerPanelModel, TrailerTimeline, TrailerTools } from "./trailerTypes";

/**
 * La bande-annonce, plein écran : un lecteur ULTRA simplifié. La vidéo occupe
 * tout ; par-dessus, la croix Retour en haut à gauche (`BackButton`, la même
 * partout), et en bas (`TrailerChrome`) le titre, [Sous-titres] [Qualité] et
 * la barre de temps, focalisable, où ←/→ avancent et reculent. Ni épisodes,
 * ni vitesse, ni réglages.
 *
 * Vue pure. Contrat :
 * - `video` : le lecteur, rendu par le câblage ; absent, l'image de l'œuvre
 *   en tient lieu. Monté DÈS le chargement, sous un voile opaque qui ne se
 *   lève qu'en lecture ;
 * - `state` : `loading`, `playing`, `unavailable` ; `unavailableReason` :
 *   `youtube` (le défaut) ou `unsupported` ;
 * - `chromeShown` / `timelineShown` : estompé en lecture sans geste, le
 *   chrome laisse la croix à peine visible (infocalisable, tv-core) et la
 *   barre à l'opacité plancher — elle garde le focus ; les pilules de verre
 *   se démontent après leur fondu. Pendant un défilement, la barre seule ;
 * - `timeline` : la barre (absente tant que la durée n'est pas connue) ;
 *   `scrubTarget` : la cible d'un défilement ; `seekFlash` : le badge d'un
 *   saut (« +30 s ») ; `paused` : un voile léger ;
 * - `tools` : les boutons à montrer — le câblage n'en donne que si le serveur
 *   déclare `trailers.player` ET qu'il y a de quoi choisir. Sans, la barre
 *   seule : avancer / reculer ;
 * - `panel` : le panneau ouvert (une colonne de choix, `TrailerPanelSheet`) ;
 *   refermé, il s'efface d'un bloc (`handoff`), puis `onPanelExited` — le
 *   moment de rendre le focus au bouton qui l'avait ouvert ;
 * - `subtitle` : la réplique à l'écran (`SubtitleLayer` du grand lecteur).
 * Clés : `trailerTypes.ts`.
 */

export interface TrailerViewProps {
  state: "loading" | "playing" | "unavailable";
  /** Le nom de la bande-annonce, sinon le titre de l'œuvre. */
  title: string;
  /** L'image de l'œuvre : le fond du chargement et de l'indisponible. */
  backdropUri?: string;
  video?: ReactNode;
  /** Le chrome à l'écran (`trailerChromeShown(…).chrome`) : la croix, le titre, les pilules. */
  chromeShown?: boolean;
  /** La barre à l'écran (`trailerChromeShown(…).timeline`) — seule pendant un défilement. */
  timelineShown?: boolean;
  /** La lecture lancée attend le réseau (le temps n'avance plus). */
  waiting?: boolean;
  /** Pourquoi rien ne se lit : YouTube qui refuse (défaut), ou une vidéo que le téléviseur ne sait pas lire. */
  unavailableReason?: "youtube" | "unsupported";
  timeline?: TrailerTimeline | null;
  paused?: boolean;
  scrubTarget?: number | null;
  seekFlash?: { forward: boolean; label: string } | null;
  subtitle?: SubtitleCue | null;
  tools?: TrailerTools;
  panel?: TrailerPanelModel | null;
  onClose?: () => void;
  onOpenSubtitles?: () => void;
  onOpenQuality?: () => void;
  onPressTimeline?: () => void;
  onSelectSubtitle?: (key: string) => void;
  onSelectQuality?: (key: string) => void;
  onClosePanel?: () => void;
  onPanelExited?: () => void;
}

const NO_TOOLS: TrailerTools = { subtitles: false, quality: false };

export const TrailerView = memo(function TrailerView(props: TrailerViewProps) {
  const { state, title, backdropUri, video, chromeShown = true, waiting = false, unavailableReason = "youtube", panel } = props;
  const { t } = useTranslation("common");
  const playing = state === "playing";
  // Le chrome du bas recule devant un panneau, comme l'habillage du grand lecteur.
  const chromeOn = !playing || (chromeShown && !panel);
  const lit = useFocusProgress(chromeOn, 420);
  const timelineLit = useFocusProgress(playing && (props.timelineShown ?? chromeShown) && !panel, 420);
  const croix = useAnimatedStyle(() => ({ opacity: 0.15 + 0.85 * lit.value }));
  const dim = useMotion(playing && !!props.paused && !panel, "veil");
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const backing = useNativeGlassBacking("strong");

  // Le panneau, gardé le temps de sa sortie : il s'efface d'un bloc, focus compris.
  const exit = useExit(!!panel, "handoff", props.onPanelExited);
  const live = !exit.leaving;
  const lastPanel = useRef<TrailerPanelModel | null>(null);
  if (panel) lastPanel.current = panel;
  const shownPanel = exit.mounted ? lastPanel.current : null;
  const exitStyle = useAnimatedStyle(() => ({ opacity: Math.max(SWAP_FLOOR, exit.progress.value) }));

  return (
    <View style={styles.root}>
      {state !== "unavailable" && video ? <View style={StyleSheet.absoluteFill}>{video}</View> : null}
      {playing && !video && backdropUri ? (
        <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
      ) : null}
      {!playing ? (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          {backdropUri ? (
            <Image source={{ uri: backdropUri }} style={[StyleSheet.absoluteFill, styles.dimArt]} resizeMode="cover" blurRadius={state === "unavailable" ? 18 : 0} fadeDuration={0} />
          ) : null}
        </View>
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pauseDim, dimStyle]} />

      {playing && props.subtitle && !shownPanel ? <SubtitleLayer cue={props.subtitle} raised={chromeOn} /> : null}

      {playing && props.timeline ? (
        <TrailerChrome
          title={title}
          labels={{ kicker: t("trailer"), timeline: t("trailerTimeline"), subtitles: t("trailerSubtitles"), quality: t("trailerQuality") }}
          timeline={props.timeline}
          tools={props.tools ?? NO_TOOLS}
          lit={lit}
          timelineLit={timelineLit}
          controlsShown={chromeOn}
          scrubTarget={props.scrubTarget}
          onOpenSubtitles={props.onOpenSubtitles}
          onOpenQuality={props.onOpenQuality}
          onPressTimeline={props.onPressTimeline}
        />
      ) : null}

      {playing && waiting ? (
        <View pointerEvents="none" style={styles.center}>
          <View style={styles.waitBadge}>
            <ActivitySpinner size="large" color={colors.text} style={styles.waitSpinner} />
          </View>
        </View>
      ) : null}

      {state === "loading" ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivitySpinner size="large" color={colors.text} style={styles.spinner} />
          <Text style={styles.kicker}>{t("trailer")}</Text>
          <Text style={[styles.title, styles.centered]} numberOfLines={2}>{title}</Text>
        </View>
      ) : null}

      {state === "unavailable" ? (
        <View style={styles.center}>
          <GlassSurface radius={TV_STAGE.radius.panel} tone="strong" elevated style={[styles.panel, backing]}>
            <View style={styles.badge}>
              <Icon name="trailer" size={40} color={colors.text} />
            </View>
            <Text style={[styles.title, styles.centered]} numberOfLines={2}>{title}</Text>
            <Text style={[text.body, styles.centered]}>{t(unavailableReason === "unsupported" ? "trailerUnavailableTv" : "trailerUnavailableYoutube")}</Text>
          </GlassSurface>
        </View>
      ) : null}

      <Animated.View style={[styles.back, croix]}>
        <BackButton focusKey={TRAILER_CLOSE_KEY} onPress={props.onClose} />
      </Animated.View>

      <Presented value={playing && props.seekFlash && props.scrubTarget == null ? props.seekFlash : null} motion="reveal">
        {(flash, appear) => <SeekFlash forward={flash.forward} label={flash.label} appear={appear} />}
      </Presented>

      {shownPanel ? (
        <Animated.View style={[StyleSheet.absoluteFill, exitStyle]} pointerEvents="box-none">
          <TrailerPanelSheet
            panel={shownPanel}
            labels={{
              title: t(shownPanel.kind === "subtitles" ? "trailerSubtitles" : "trailerQuality"),
              auto: t("trailerQualityAuto"),
              noteTitle: t("trailerNoteTitle"),
              note: t(shownPanel.kind === "subtitles" ? "trailerSubtitlesNote" : "trailerQualityNote"),
            }}
            onSelect={live ? (shownPanel.kind === "subtitles" ? props.onSelectSubtitle : props.onSelectQuality) : undefined}
            onClose={live ? props.onClosePanel : undefined}
          />
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  // Le voile du chargement : opaque, il cache le lecteur qui se prépare dessous.
  cover: { backgroundColor: "#000" },
  dimArt: { opacity: 0.32 },
  pauseDim: { backgroundColor: scrim(0.28) },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 240 },
  spinner: { transform: [{ scale: 1.6 }], marginBottom: 44 },
  // La roue de l'attente, sur un disque sombre : lisible sur une image claire.
  waitBadge: { width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center", backgroundColor: scrim(0.55) },
  waitSpinner: { transform: [{ scale: 1.6 }] },
  kicker: { ...text.kicker, color: colors.accentLight, marginBottom: 10 },
  title: { ...fonts.bold, fontSize: 44, lineHeight: 52, color: colors.text },
  centered: { textAlign: "center" },
  panel: { width: 900, alignItems: "center", gap: 18, paddingHorizontal: 64, paddingVertical: 52, backgroundColor: "rgba(12, 12, 16, 0.78)" },
  badge: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.1)", marginBottom: 6 },
  back: { position: "absolute", top: BACK_TOP, left: TV_STAGE.safe.x },
});
