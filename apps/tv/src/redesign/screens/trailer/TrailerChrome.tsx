import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient, STAGE_SIZE } from "../../background/SoftGradient";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { usePresence } from "../../motion/useMotion";
import { SWAP_FLOOR } from "../../motion/useSwap";
import { colors, fonts, scrim, text, white } from "../../theme/tokens";
import { OsdTimeline, TIMELINE_ROW, TIMELINE_WIDTH } from "../player/OsdTimeline";
import { SOFT_BASE } from "../player/surfaces";
import { TRAILER_QUALITY_KEY, TRAILER_SUBTITLES_KEY, TRAILER_TIMELINE_KEY } from "@tentacle-tv/tv-core";
import type { TrailerTimeline, TrailerTools } from "./trailerTypes";

/**
 * Le bas de la bande-annonce : le titre à gauche, [Sous-titres] [Qualité] à
 * droite, AU-DESSUS de la barre ; la barre de temps tout en bas (`OsdTimeline`
 * du grand lecteur : écoulé, chargé, restant qui décompte).
 *
 * La barre est une CIBLE (`trailer:timeline`) : focalisée, ←/→ avancent et
 * reculent (règles de tv-core, posées par l'adaptateur) ; au focus, une
 * plaque claire la soulève, sans changer sa géométrie. `scrubTarget` : la
 * position visée d'un défilement, le trait rose de la frise ; pendant un
 * défilement, la barre reste SEULE (`trailerChromeShown`, tv-core).
 *
 * Les pilules sont du VERRE : montées à la demande, jamais masquées par
 * l'opacité — estompé, le chrome les laisse partir en fondu puis les démonte.
 * La barre (de simples vues) reste montée en lecture, à l'opacité plancher
 * (`SWAP_FLOOR` : tvOS tiendrait pour caché le focus qu'elle garde). Rien ne
 * dessine PAR-DESSUS une cible : le voile et le titre sont posés avant elles.
 *
 * Deux bandes vides, des ponts que l'intégration arme selon le focus (rien
 * ne s'y voit) : `trailer:bridge-timeline`, entre les pilules et la barre
 * (HAUT depuis la barre → le dernier bouton visité), et
 * `trailer:bridge-tools`, au-dessus des pilules (HAUT depuis un bouton → la
 * croix).
 */

export interface TrailerChromeLabels {
  kicker: string;
  /** Le nom lu de la barre (accessibilité). */
  timeline: string;
  subtitles: string;
  quality: string;
}

const SAFE = TV_STAGE.safe;
const SCRIM_HEIGHT = 460;
/** Le haut de la rangée de la barre, tout en bas de la scène. */
const TIMELINE_TOP = STAGE_SIZE.height - SAFE.y - TIMELINE_ROW - 10;
const PLATE_PAD = { x: 22, y: 14 };
/** L'écart entre la rangée du titre et des pilules et la barre. */
const ROW_GAP = 34;

export const TrailerChrome = memo(function TrailerChrome({
  title,
  labels,
  timeline,
  tools,
  lit,
  timelineLit,
  controlsShown,
  scrubTarget,
  onOpenSubtitles,
  onOpenQuality,
  onPressTimeline,
}: {
  title: string;
  labels: TrailerChromeLabels;
  timeline: TrailerTimeline;
  tools: TrailerTools;
  /** 0 → 1 : le chrome allumé (titre, pilules). */
  lit: SharedValue<number>;
  /** 0 → 1 : la barre et son voile — seuls à l'écran pendant un défilement. */
  timelineLit: SharedValue<number>;
  /** Les pilules à l'écran : le chrome allumé, aucun panneau ouvert. */
  controlsShown: boolean;
  scrubTarget?: number | null;
  onOpenSubtitles?: () => void;
  onOpenQuality?: () => void;
  /** OK sur la barre : montrer le chrome, puis la pause (« OK puis OK »). */
  onPressTimeline?: () => void;
}) {
  const faded = useAnimatedStyle(() => ({ opacity: lit.value }));
  const veil = useAnimatedStyle(() => ({ opacity: timelineLit.value }));
  const floored = useAnimatedStyle(() => ({ opacity: Math.max(SWAP_FLOOR, timelineLit.value) }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.scrim, veil]}>
        <SoftGradient width={STAGE_SIZE.width} height={SCRIM_HEIGHT} colors={[scrim(0), scrim(0.6), scrim(0.9)]} locations={[0, 0.5, 1]} />
      </Animated.View>
      <View style={styles.row} pointerEvents="box-none">
        <Animated.View pointerEvents="none" style={[styles.caption, faded]}>
          <Text style={styles.kicker}>{labels.kicker}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </Animated.View>
        <Tools tools={tools} labels={labels} shown={controlsShown} onOpenSubtitles={onOpenSubtitles} onOpenQuality={onOpenQuality} />
      </View>
      <FocusGroup focusKey="trailer:bridge-timeline" style={styles.bridge} pointerEvents="none" />
      <Animated.View style={[styles.timeline, floored]} pointerEvents="box-none">
        <FocusTarget focusKey={TRAILER_TIMELINE_KEY} onPress={onPressTimeline} accessibilityLabel={labels.timeline}>
          {(focused) => <TimelineBody timeline={timeline} focused={focused} scrubTarget={scrubTarget} />}
        </FocusTarget>
      </Animated.View>
    </View>
  );
});

function Tools({ tools, labels, shown, onOpenSubtitles, onOpenQuality }: {
  tools: TrailerTools;
  labels: TrailerChromeLabels;
  shown: boolean;
  onOpenSubtitles?: () => void;
  onOpenQuality?: () => void;
}) {
  const any = tools.subtitles || tools.quality;
  const presence = usePresence(shown && any, "chrome");
  const appear = useAnimatedStyle(() => ({ opacity: presence.progress.value }));
  const backing = useNativeGlassBacking("clear");
  if (!presence.mounted) return null;
  return (
    <View style={styles.tools}>
      <FocusGroup focusKey="trailer:bridge-tools" style={styles.toolsBridge} pointerEvents="none" />
      <Animated.View style={[styles.toolsRow, appear]}>
        {tools.subtitles ? (
          <View style={[styles.base, backing]}>
            <PillButton variant="glass" icon="subtitles" label={labels.subtitles} focusKey={TRAILER_SUBTITLES_KEY} onPress={onOpenSubtitles} />
          </View>
        ) : null}
        {tools.quality ? (
          <View style={[styles.base, backing]}>
            <PillButton variant="glass" icon="sliders" label={labels.quality} focusKey={TRAILER_QUALITY_KEY} onPress={onOpenQuality} />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function TimelineBody({ timeline, focused, scrubTarget }: { timeline: TrailerTimeline; focused: boolean; scrubTarget?: number | null }) {
  const p = useFocusProgress(focused);
  const plate = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={styles.timelineBox}>
      <Animated.View pointerEvents="none" style={[styles.plate, plate]} />
      <OsdTimeline position={timeline.position} duration={timeline.duration} buffered={timeline.buffered} ghost={scrubTarget ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0, top: STAGE_SIZE.height - SCRIM_HEIGHT, height: SCRIM_HEIGHT },
  // Le titre et les pilules, alignés sur leur bas, juste au-dessus de la barre.
  row: {
    position: "absolute",
    left: SAFE.x,
    right: SAFE.x,
    bottom: STAGE_SIZE.height - TIMELINE_TOP + ROW_GAP,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 48,
  },
  caption: { flex: 1 },
  kicker: { ...text.kicker, color: colors.accentLight, marginBottom: 10 },
  title: { ...fonts.bold, fontSize: 44, lineHeight: 52, color: colors.text },
  tools: { flexShrink: 0 },
  // Au-dessus des pilules, de leur largeur, sans les toucher (leur soulèvement au focus compris).
  toolsBridge: { position: "absolute", left: 0, right: 0, bottom: "100%", marginBottom: 18, height: 12 },
  toolsRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  base: { borderRadius: 34, backgroundColor: SOFT_BASE },
  timeline: { position: "absolute", left: SAFE.x, top: TIMELINE_TOP, width: TIMELINE_WIDTH },
  timelineBox: { width: TIMELINE_WIDTH, height: TIMELINE_ROW },
  // Entre le bas des pilules et la plaque de la barre : ne chevauche aucune cible.
  bridge: { position: "absolute", left: SAFE.x, width: TIMELINE_WIDTH, top: TIMELINE_TOP - ROW_GAP + 6, height: ROW_GAP - PLATE_PAD.y - 10 },
  // La plaque du focus déborde de la rangée : la frise ne bouge pas d'un point.
  plate: {
    position: "absolute",
    left: -PLATE_PAD.x,
    right: -PLATE_PAD.x,
    top: -PLATE_PAD.y,
    bottom: -PLATE_PAD.y,
    borderRadius: (TIMELINE_ROW + 2 * PLATE_PAD.y) / 2,
    backgroundColor: white(0.12),
  },
});
