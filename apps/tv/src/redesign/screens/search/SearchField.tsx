import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim } from "../../theme/tokens";
import { KEYBOARD_WIDTH } from "./searchViewModel";

/**
 * Le champ de la recherche : ce qui est tapé en blanc, la suite du meilleur
 * résultat en gris, un curseur rose. Il dit toujours où l'on en est, même
 * quand le focus est trois rangées plus bas.
 *
 * tvOS : le champ est un BOUTON (OK ouvre le clavier système, et avec lui la
 * dictée de la Siri Remote — l'app n'a pas le droit au micro) ; une ligne le
 * rappelle dessous. Android TV : un simple affichage, la saisie passe par le
 * clavier à l'écran et sa touche micro.
 */

export const FIELD_HEIGHT = 80;

export interface SearchFieldProps {
  query: string;
  completion: string | null;
  placeholder: string;
  /** Le champ est focalisable (tvOS) et dit où est la dictée. */
  systemInput: boolean;
  dictationHint?: string;
  onPress?: () => void;
}

function Line({ query, completion, placeholder, typed, rest, cursor }: {
  query: string;
  completion: string | null;
  placeholder: string;
  typed: string;
  rest: string;
  cursor: string;
}) {
  if (!query) {
    return (
      <Text style={[styles.text, { color: rest }]} numberOfLines={1}>
        {placeholder}
      </Text>
    );
  }
  return (
    <View style={styles.line}>
      <Text style={[styles.text, styles.shrink, { color: typed }]} numberOfLines={1} ellipsizeMode="head">
        {query}
      </Text>
      <View style={[styles.cursor, { backgroundColor: cursor }]} />
      {completion ? (
        <Text style={[styles.text, styles.completion, { color: rest }]} numberOfLines={1}>
          {completion}
        </Text>
      ) : null}
    </View>
  );
}

function Face({ focused, query, completion, placeholder }: Pick<SearchFieldProps, "query" | "completion" | "placeholder"> & { focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const line = { query, completion, placeholder };
  return (
    <Animated.View style={[styles.field, lift]}>
      <GlassSurface radius={FIELD_HEIGHT / 2} tone="clear" style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        <Icon name="search" size={30} color={query ? colors.text : colors.textTertiary} strokeWidth={2.4} />
        <Line {...line} typed={colors.text} rest={colors.textTertiary} cursor={colors.accent} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.white, whiteLayer]}>
        <View style={styles.row}>
          <Icon name="search" size={30} color={colors.ctaFg} strokeWidth={2.4} />
          <Line {...line} typed={colors.ctaFg} rest={scrim(0.42)} cursor={colors.accentDeep} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export const SearchField = memo(function SearchField({
  query,
  completion,
  placeholder,
  systemInput,
  dictationHint,
  onPress,
}: SearchFieldProps) {
  const face = { query, completion, placeholder };
  return (
    <View style={styles.column}>
      {systemInput ? (
        <FocusTarget focusKey="search:field" onPress={onPress} accessibilityLabel={query || placeholder}>
          {(focused) => <Face {...face} focused={focused} />}
        </FocusTarget>
      ) : (
        <Face {...face} focused={false} />
      )}
      {systemInput && dictationHint ? (
        <View style={styles.hint}>
          <Icon name="mic" size={22} color={colors.textTertiary} />
          <Text style={styles.hintText} numberOfLines={1}>{dictationHint}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  column: { width: KEYBOARD_WIDTH, gap: 12 },
  field: { width: KEYBOARD_WIDTH, height: FIELD_HEIGHT },
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 26 },
  white: { borderRadius: FIELD_HEIGHT / 2, backgroundColor: colors.ctaBg },
  line: { flex: 1, flexDirection: "row", alignItems: "center" },
  text: { ...fonts.medium, fontSize: 30 },
  shrink: { flexShrink: 1 },
  completion: { flexShrink: 1000 },
  cursor: { width: 3, height: 36, borderRadius: 2, marginHorizontal: 2 },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 26 },
  hintText: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
