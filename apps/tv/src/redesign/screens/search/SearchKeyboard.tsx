import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";
import { KEYBOARD_WIDTH, KEY_GAP, KEY_SIZE, type SearchInputLabels } from "./searchViewModel";

/**
 * Le clavier en grille : A–Z puis 0–9, six touches par rangée, grandes
 * (64 pt) et lisibles à trois mètres ; dessous, espace, effacer et vider —
 * plus le micro sur Android TV seulement (tvOS refuse le micro aux apps :
 * la dictée y passe par le clavier système, cf. `SearchField`).
 *
 * Au focus, la touche grandit et devient blanche, texte noir — jamais
 * d'anneau. Clés : `key:A`… `key:0`, `key:space`, `key:delete`,
 * `key:clear`, `key:mic`.
 */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
const ROWS = Array.from({ length: CHARS.length / 6 }, (_, i) => CHARS.slice(i * 6, i * 6 + 6));

export interface SearchKeyboardProps {
  labels: Pick<SearchInputLabels, "space" | "delete" | "clear" | "mic">;
  /** Android TV : la touche micro (la dictée de l'app). */
  withMic: boolean;
  /** Le micro écoute. */
  listening?: boolean;
  onKey?: (char: string) => void;
  onSpace?: () => void;
  onDelete?: () => void;
  onClear?: () => void;
  onMic?: () => void;
}

function KeyFace({ focused, width, label, icon, active }: {
  focused: boolean;
  width: number;
  label?: string;
  icon?: IconName;
  active?: boolean;
}) {
  const p = useFocusProgress(focused, 160);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.14 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const content = (color: string) => (
    <View style={styles.center}>
      {icon ? <Icon name={icon} size={26} color={color} strokeWidth={2.2} /> : null}
      {label ? <Text style={[icon ? styles.wordLabel : styles.charLabel, { color }]} numberOfLines={1}>{label}</Text> : null}
    </View>
  );
  return (
    <Animated.View style={[{ width, height: KEY_SIZE }, lift]}>
      <View style={[StyleSheet.absoluteFill, styles.base, active && styles.active]} />
      {content(active ? colors.accentLight : colors.text)}
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]}>
        {content(colors.ctaFg)}
      </Animated.View>
    </Animated.View>
  );
}

function Key({ id, width = KEY_SIZE, label, icon, accessibilityLabel, active, onPress }: {
  id: string;
  width?: number;
  label?: string;
  icon?: IconName;
  accessibilityLabel: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={`key:${id}`} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      {(focused) => <KeyFace focused={focused} width={width} label={label} icon={icon} active={active} />}
    </FocusTarget>
  );
}

export const SearchKeyboard = memo(function SearchKeyboard({
  labels,
  withMic,
  listening,
  onKey,
  onSpace,
  onDelete,
  onClear,
  onMic,
}: SearchKeyboardProps) {
  // La rangée du bas : l'espace prend le reste de la largeur.
  const small = withMic ? 84 : 100;
  const count = withMic ? 3 : 2;
  const space = KEYBOARD_WIDTH - count * (small + KEY_GAP);
  return (
    <View style={styles.keyboard}>
      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((char) => (
            <Key key={char} id={char} label={char} accessibilityLabel={char} onPress={onKey ? () => onKey(char.toLowerCase()) : undefined} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Key id="space" width={space} icon="space" label={labels.space} accessibilityLabel={labels.space} onPress={onSpace} />
        <Key id="delete" width={small} icon="backspace" accessibilityLabel={labels.delete} onPress={onDelete} />
        <Key id="clear" width={small} icon="xCircle" accessibilityLabel={labels.clear} onPress={onClear} />
        {withMic ? <Key id="mic" width={small} icon="mic" accessibilityLabel={labels.mic} active={listening} onPress={onMic} /> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  keyboard: { width: KEYBOARD_WIDTH, gap: KEY_GAP },
  row: { flexDirection: "row", gap: KEY_GAP },
  center: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  base: { borderRadius: 18, backgroundColor: white(0.08), borderWidth: 1, borderColor: white(0.07) },
  active: { backgroundColor: white(0.16), borderColor: colors.accent },
  focusFill: {
    borderRadius: 18,
    backgroundColor: colors.ctaBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  charLabel: { ...fonts.semibold, fontSize: 26 },
  wordLabel: { ...fonts.semibold, fontSize: 22 },
});
