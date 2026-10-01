import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";
import { KEYBOARD_WIDTH, type SearchSuggestionModel } from "./searchViewModel";

/**
 * Les suggestions, sous le clavier : quatre lettres tapées, et le titre
 * s'obtient d'un appui au lieu de huit. D'abord la complétion du meilleur
 * résultat (mise en avant, la partie tapée en gras), puis ce que le moteur
 * propose (`suggestionsFrom`). Cinq au plus : au D-pad, chaque ligne coûte un
 * appui. Clés : `suggestion:0`…
 */

export const SUGGESTION_HEIGHT = 48;
const MAX = 5;

function Label({ query, typed, color, strong }: { query: string; typed: string; color: string; strong: boolean }) {
  const head = typed && query.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()) ? query.slice(0, typed.length) : "";
  return (
    <Text style={[strong ? styles.strong : styles.regular, { color }]} numberOfLines={1}>
      {head ? <Text style={styles.head}>{head}</Text> : null}
      {query.slice(head.length)}
    </Text>
  );
}

function Face({ suggestion, typed, focused }: { suggestion: SearchSuggestionModel; typed: string; focused: boolean }) {
  const p = useFocusProgress(focused, 180);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const complete = suggestion.kind === "complete";
  const row = (color: string, icon: string) => (
    <View style={styles.row}>
      <Icon name="search" size={22} color={icon} strokeWidth={2.4} />
      <Label query={suggestion.query} typed={typed} color={color} strong={complete} />
    </View>
  );
  return (
    <Animated.View style={[styles.face, lift]}>
      {complete ? <View style={[StyleSheet.absoluteFill, styles.lead]} /> : null}
      {row(complete ? colors.text : colors.textSecondary, complete ? colors.accentLight : colors.textTertiary)}
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]}>
        {row(colors.ctaFg, colors.ctaFg)}
      </Animated.View>
    </Animated.View>
  );
}

export const SearchSuggestions = memo(function SearchSuggestions({
  title,
  typed,
  suggestions,
  onPick,
}: {
  title: string;
  /** La saisie : sa part, dans chaque suggestion, s'écrit en gras. */
  typed: string;
  suggestions: SearchSuggestionModel[];
  onPick?: (query: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.column}>
      <Text style={styles.title}>{title}</Text>
      {suggestions.slice(0, MAX).map((suggestion, index) => (
        <FocusTarget
          key={`${suggestion.kind}:${suggestion.query}`}
          focusKey={`suggestion:${index}`}
          form="row"
          onPress={onPick ? () => onPick(suggestion.query) : undefined}
          accessibilityLabel={suggestion.query}
        >
          {(focused) => <Face suggestion={suggestion} typed={typed.trim()} focused={focused} />}
        </FocusTarget>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  column: { width: KEYBOARD_WIDTH, gap: 6 },
  title: {
    ...fonts.bold,
    fontSize: 22,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: 6,
    marginLeft: 22,
  },
  face: { width: KEYBOARD_WIDTH, height: SUGGESTION_HEIGHT },
  lead: { borderRadius: SUGGESTION_HEIGHT / 2, backgroundColor: white(0.08) },
  focusFill: { borderRadius: SUGGESTION_HEIGHT / 2, backgroundColor: colors.ctaBg },
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22 },
  regular: { ...fonts.medium, fontSize: 26, flexShrink: 1 },
  strong: { ...fonts.semibold, fontSize: 26, flexShrink: 1 },
  head: { ...fonts.extrabold },
});
