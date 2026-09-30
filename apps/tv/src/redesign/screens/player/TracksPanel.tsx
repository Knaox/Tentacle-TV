import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { CircleButton } from "./CircleButton";
import type { TrackOptionModel, TracksPanelModel } from "./playerTypes";
import { DENSE_BASE } from "./surfaces";
import { TrackOptionRow } from "./TrackOptionRow";

/**
 * Le panneau des pistes : une grande feuille de verre qui monte du bas, trois
 * colonnes lues d'un coup d'œil — Audio, Sous-titres, Qualité (Original et sa
 * définition, les paliers et leur débit, DV/HDR/Atmos, « Auto »). La vidéo
 * reste visible au-dessus. Chaque colonne défile seule ; ouverte sur son
 * choix retenu.
 * Clés : `tracks:close`, `tracks:audio:<clé>`, `tracks:subtitle:<clé>`,
 * `tracks:quality:<clé>`.
 */

const SAFE = TV_STAGE.safe;
const HEIGHT = 680;
const ROW_STEP = 76;

export interface TracksPanelLabels {
  audio: string;
  subtitles: string;
  quality: string;
  auto: string;
  close: string;
}

function Column({
  title,
  icon,
  options,
  prefix,
  autoLabel,
  onSelect,
}: {
  title: string;
  icon: IconName;
  options: TrackOptionModel[];
  prefix: string;
  autoLabel: string;
  onSelect?: (key: string) => void;
}) {
  const selected = Math.max(0, options.findIndex((option) => option.selected));
  return (
    <View style={styles.column}>
      <View style={styles.heading}>
        <Icon name={icon} size={30} color={colors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.headingText}>{title}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.options}
        contentOffset={{ x: 0, y: Math.max(0, selected - 3) * ROW_STEP }}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => (
          <TrackOptionRow
            key={option.key}
            option={option}
            autoLabel={autoLabel}
            focusKey={`tracks:${prefix}:${option.key}`}
            onPress={onSelect ? () => onSelect(option.key) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export const TracksPanel = memo(function TracksPanel({
  model,
  labels,
  onSelectAudio,
  onSelectSubtitle,
  onSelectQuality,
  onClose,
}: {
  model: TracksPanelModel;
  labels: TracksPanelLabels;
  onSelectAudio?: (key: string) => void;
  onSelectSubtitle?: (key: string) => void;
  onSelectQuality?: (key: string) => void;
  onClose?: () => void;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient pointerEvents="none" colors={[scrim(0.15), scrim(0.55), scrim(0.85)]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.sheet}>
        <GlassSurface radius={44} tone="strong" elevated style={styles.glass} />
        <View style={styles.columns}>
          <Column title={labels.audio} icon="audio" options={model.audio} prefix="audio" autoLabel={labels.auto} onSelect={onSelectAudio} />
          <View style={styles.divider} />
          <Column title={labels.subtitles} icon="subtitles" options={model.subtitles} prefix="subtitle" autoLabel={labels.auto} onSelect={onSelectSubtitle} />
          {model.quality.length ? (
            <>
              <View style={styles.divider} />
              <Column title={labels.quality} icon="sliders" options={model.quality} prefix="quality" autoLabel={labels.auto} onSelect={onSelectQuality} />
            </>
          ) : null}
        </View>
        <View style={styles.close}>
          <CircleButton icon="close" label={labels.close} size={64} caption={false} focusKey="tracks:close" onPress={onClose} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: SAFE.x - 24, right: SAFE.x - 24, bottom: SAFE.y - 14, height: HEIGHT },
  glass: { ...StyleSheet.absoluteFillObject, backgroundColor: DENSE_BASE },
  // La liste qui continue se lit à sa dernière ligne coupée, dans le verre.
  columns: { flex: 1, flexDirection: "row", paddingHorizontal: 24, paddingTop: 34, paddingBottom: 28 },
  column: { flex: 1, paddingHorizontal: 20 },
  divider: { width: 1, marginVertical: 12, backgroundColor: white(0.1) },
  heading: { flexDirection: "row", alignItems: "center", gap: 14, height: 64, paddingLeft: 16, marginBottom: 10 },
  headingText: { ...fonts.bold, fontSize: 34, color: colors.text },
  scroll: { flex: 1 },
  options: { gap: 8, paddingBottom: 24 },
  close: { position: "absolute", top: 34, right: 44 },
});
