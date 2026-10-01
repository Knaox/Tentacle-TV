import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated from "react-native-reanimated";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { useOverlayArrival } from "../../motion/useOverlayArrival";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { CircleButton } from "./CircleButton";
import { EpisodeList } from "./EpisodeList";
import { EPISODE_ROW_HEIGHT } from "./EpisodeRow";
import type { EpisodesPanelModel } from "./playerTypes";
import { SeasonTabs } from "./SeasonTabs";
import { DENSE_BASE } from "./surfaces";

/**
 * Le panneau « Épisodes » du lecteur : un grand panneau de verre à droite —
 * la vidéo reste visible à gauche, sous un voile —, l'en-tête (Épisodes, la
 * série, Fermer), les onglets de saisons, puis les grandes lignes d'épisode,
 * ouvertes sur l'épisode en cours (liste virtualisée, `EpisodeList`).
 * Chargement : des lignes fantômes, fixes.
 * Clés : `episodes:close`, `episodes:season:<n>`, `episodes:episode:<n>` (rang
 * dans la bande, rang dans la saison). Groupes : `episodes:panel` — tout le
 * panneau, où l'intégration retient le focus ; `episodes:header` — l'en-tête,
 * qui peut renvoyer toute montée vers Fermer ; `episodes:seasons` — la bande
 * des saisons (`SeasonTabs`).
 */

const SAFE = TV_STAGE.safe;
const WIDTH = 940;
const ROW_GAP = 14;

function GhostRows() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.ghostRow}>
          <View style={styles.ghostThumb} />
          <View style={styles.ghostText}>
            <View style={[styles.ghostLine, { width: 180 }]} />
            <View style={[styles.ghostLine, styles.ghostTitle]} />
            <View style={[styles.ghostLine, { width: 420 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export const EpisodesPanel = memo(function EpisodesPanel({
  model,
  labels,
  onSelectSeason,
  onSelectEpisode,
  onClose,
}: {
  model: EpisodesPanelModel;
  labels: { episodes: string; close: string; nowPlaying: string };
  onSelectSeason?: (id: string) => void;
  onSelectEpisode?: (id: string) => void;
  onClose?: () => void;
}) {
  const backing = useNativeGlassBacking("strong");
  // Le voile en fondu, le panneau qui glisse depuis la droite (Apple TV).
  const arrival = useOverlayArrival("x", TV_MOTION.player.panelSlide);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, arrival.veil]}>
        <LinearGradient
          colors={[scrim(0.3), scrim(0.62), scrim(0.8)]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, arrival.body]}>
        <FocusGroup focusKey="episodes:panel" style={styles.panel}>
          <GlassSurface radius={44} tone="strong" elevated style={[styles.glass, backing]} />
          <FocusGroup focusKey="episodes:header" style={styles.header}>
            <View style={styles.headings}>
              <Text style={styles.title}>{labels.episodes}</Text>
              <Text style={styles.series} numberOfLines={1}>{model.seriesTitle}</Text>
            </View>
            <CircleButton icon="close" label={labels.close} size={64} caption={false} focusKey="episodes:close" onPress={onClose} />
          </FocusGroup>
          <SeasonTabs seasons={model.seasons} activeId={model.activeSeasonId} onSelect={onSelectSeason} />
          <View style={styles.rule} />
          {model.loading ? (
            <GhostRows />
          ) : (
            // Une liste par saison (clé) : l'ouverture sur l'épisode en cours se
            // recalcule à chaque changement, sans reste de la précédente.
            <EpisodeList
              key={model.activeSeasonId}
              episodes={model.episodes}
              nowPlayingLabel={labels.nowPlaying}
              onSelectEpisode={onSelectEpisode}
            />
          )}
        </FocusGroup>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  panel: { position: "absolute", right: SAFE.x - 24, top: SAFE.y - 14, bottom: SAFE.y - 14, width: WIDTH },
  glass: { ...StyleSheet.absoluteFillObject, backgroundColor: DENSE_BASE },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 40, paddingTop: 36, paddingBottom: 18 },
  headings: { flexShrink: 1, gap: 4 },
  title: { ...fonts.extrabold, fontSize: 44, letterSpacing: -0.6, color: colors.text },
  series: { ...fonts.semibold, fontSize: 26, color: colors.textSecondary },
  rule: { height: 1, marginHorizontal: 40, marginTop: 10, backgroundColor: white(0.1) },
  list: { gap: ROW_GAP, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 40 },
  ghostRow: { height: EPISODE_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 24, padding: 16, borderRadius: 26, backgroundColor: white(0.04) },
  ghostThumb: { width: 256, height: 144, borderRadius: 16, backgroundColor: white(0.07) },
  ghostText: { flex: 1, gap: 14 },
  ghostLine: { height: 20, borderRadius: 10, backgroundColor: white(0.08) },
  ghostTitle: { width: 360, height: 28, borderRadius: 14 },
});
