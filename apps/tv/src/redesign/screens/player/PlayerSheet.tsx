import { memo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient, STAGE_SIZE } from "../../background/SoftGradient";
import { BACK_BUTTON_SIZE, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon, type IconName } from "../../icons/Icon";
import { useOverlayArrival } from "../../motion/useOverlayArrival";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import type { TrackOptionModel } from "./playerTypes";
import { DENSE_BASE } from "./surfaces";
import { TrackOptionRow } from "./TrackOptionRow";

/**
 * La feuille des panneaux du lecteur — « Pistes » et « Réglages » : une
 * grande feuille de verre qui monte du bas, la vidéo visible au-dessus, des
 * colonnes lues d'un coup d'œil (chacune défile seule, ouverte sur son choix
 * retenu). La croix Retour en haut à gauche, dans une marge à elle (son
 * libellé paraît dessous au focus) : GAUCHE depuis la première colonne.
 *
 * Clés, pour un panneau `p` : `p:close` (la croix) ; groupes `p:panel` — la
 * feuille, où l'intégration retient le focus tant qu'elle est ouverte — et
 * `p:back`, la marge de la croix. Une colonne nomme ses options
 * `p:<colonne>:<clé>`.
 */

const SAFE = TV_STAGE.safe;
const HEIGHT = 680;
const ROW_STEP = 76;
/** Le haut des colonnes, la ligne de leurs titres, et l'écart qui la sépare de la première option. */
const COLUMNS_TOP = 34;
const HEADING_HEIGHT = 64;
const HEADING_GAP = 10;
/**
 * La croix, dans sa marge à gauche des colonnes, à cheval sur le haut de la
 * première ligne d'options : tvOS ne vise que ce qui chevauche — calée sur
 * les titres, GAUCHE depuis la première option ne la trouvait pas (mesuré),
 * et DROITE depuis elle rejoint cette première option. La marge entière est
 * un groupe (`p:back`) : l'intégration y mène GAUCHE depuis toute la
 * première colonne.
 */
const BACK_LEFT = 36;
const BACK_TOP_IN_SHEET = COLUMNS_TOP + HEADING_HEIGHT + HEADING_GAP - BACK_BUTTON_SIZE / 2;
const GUTTER = BACK_LEFT + BACK_BUTTON_SIZE + 12;

/** Le titre d'une colonne : son pictogramme et son nom. */
export function SheetHeading({ title, icon }: { title: string; icon: IconName }) {
  return (
    <View style={styles.heading}>
      <Icon name={icon} size={30} color={colors.textSecondary} strokeWidth={2.2} />
      <Text style={styles.headingText}>{title}</Text>
    </View>
  );
}

/** Une colonne de choix : son titre, puis ses options, ouverte sur celle retenue. */
export function SheetColumn({
  title,
  icon,
  options,
  keyPrefix,
  autoLabel,
  onSelect,
}: {
  title: string;
  icon: IconName;
  options: TrackOptionModel[];
  /** `p:<colonne>` — chaque option ajoute `:<clé>`. */
  keyPrefix: string;
  autoLabel: string;
  onSelect?: (key: string) => void;
}) {
  const selected = Math.max(0, options.findIndex((option) => option.selected));
  return (
    <View style={styles.column}>
      <SheetHeading title={title} icon={icon} />
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
            focusKey={`${keyPrefix}:${option.key}`}
            onPress={onSelect ? () => onSelect(option.key) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** Le filet entre deux colonnes. */
export function SheetDivider() {
  return <View style={styles.divider} />;
}

export const PlayerSheet = memo(function PlayerSheet({
  prefix,
  onClose,
  children,
}: {
  /** `tracks`, `settings` : le préfixe des clés et des groupes. */
  prefix: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const backing = useNativeGlassBacking("strong");
  // Le voile en fondu, la feuille qui monte du bas (Apple TV).
  const arrival = useOverlayArrival("y", TV_MOTION.player.panelSlide);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, arrival.veil]}>
        <SoftGradient {...STAGE_SIZE} colors={[scrim(0.15), scrim(0.55), scrim(0.85)]} locations={[0, 0.4, 1]} />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, arrival.body]}>
        <FocusGroup focusKey={`${prefix}:panel`} style={styles.sheet}>
          <GlassSurface radius={44} tone="strong" elevated style={[styles.glass, backing]} />
          <View style={styles.columns}>{children}</View>
          <FocusGroup focusKey={`${prefix}:back`} style={styles.gutter}>
            <View style={styles.back}>
              <BackButton focusKey={`${prefix}:close`} onPress={onClose} />
            </View>
          </FocusGroup>
        </FocusGroup>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: SAFE.x - 24, right: SAFE.x - 24, bottom: SAFE.y - 14, height: HEIGHT },
  glass: { ...StyleSheet.absoluteFillObject, backgroundColor: DENSE_BASE },
  // La liste qui continue se lit à sa dernière ligne coupée, dans le verre.
  columns: { flex: 1, flexDirection: "row", paddingLeft: GUTTER, paddingRight: 24, paddingTop: COLUMNS_TOP, paddingBottom: 28 },
  column: { flex: 1, paddingHorizontal: 20 },
  divider: { width: 1, marginVertical: 12, backgroundColor: white(0.1) },
  heading: { flexDirection: "row", alignItems: "center", gap: 14, height: HEADING_HEIGHT, paddingLeft: 16, marginBottom: HEADING_GAP },
  headingText: { ...fonts.bold, fontSize: 34, color: colors.text },
  scroll: { flex: 1 },
  options: { gap: 8, paddingBottom: 24 },
  // La marge, sur toute la hauteur de la feuille ; la croix y est posée à sa place.
  gutter: { position: "absolute", top: 0, bottom: 0, left: 0, width: GUTTER },
  back: { position: "absolute", top: BACK_TOP_IN_SHEET, left: BACK_LEFT },
});
