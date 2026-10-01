import { memo, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { CardShell } from "../../cards/CardShell";
import { useCardFocused } from "../../cards/useCardFocused";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { pressScale, usePressProgress } from "../../motion/pressProgress";
import { useRecede, useRowFocus, type RowPlace } from "../../motion/useRowRecede";
import { colors, fonts, text } from "../../theme/tokens";
import { PersonPortrait } from "./PersonPortrait";
import type { SearchPersonModel } from "./searchViewModel";

/**
 * La rangée « Personnes » : des portraits ronds, le nom dessous et ce que la
 * personne représente ici (« Interprétation — 4 titres »). Au focus, le
 * portrait grandit et se soulève, le nom passe au blanc ; les voisins
 * reculent, par une valeur partagée (`useRowFocus`) : un pas du focus ne
 * redessine pas la rangée. Clés : `people:0`…
 */

const SIZE = TV_STAGE.card.person.size;
/** Plus large que le portrait : le nom et « Interprétation — 4 titres » y tiennent. */
const CELL = SIZE + 110;

/** Le portrait : il grandit, se soulève, et suit le pouce — dans la cible. */
function Portrait({ person, focused, place }: { person: SearchPersonModel; focused: boolean; place: RowPlace }) {
  const p = useFocusProgress(focused);
  const recede = useRecede(place);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({
    opacity: 1 - (1 - TV_STAGE.focus.recede) * recede.value,
    transform: [{ translateY: -4 * p.value }, { scale: (1 + 0.1 * p.value) * pressScale(press ? press.value : 0) }],
  }));
  const shadow = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.portrait, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, shadow]} />
      <PersonPortrait uri={person.imageUri} initials={person.initials} size={SIZE} />
    </Animated.View>
  );
}

/** Une personne : le portrait suit le pouce, le nom reste droit (`CardShell`). */
const Person = memo(function Person({
  person,
  index,
  row,
  onOpen,
  onItemFocusChange,
}: {
  person: SearchPersonModel;
  index: number;
  row: SharedValue<number>;
  onOpen?: (person: SearchPersonModel) => void;
  onItemFocusChange: (index: number, focused: boolean) => void;
}) {
  const focusKey = `people:${index}`;
  const report = useCallback((focused: boolean) => onItemFocusChange(index, focused), [index, onItemFocusChange]);
  const { focused, onTargetFocusChange } = useCardFocused(focusKey, report);
  const place = useMemo(() => ({ row, index }), [row, index]);
  return (
    <CardShell
      focusKey={focusKey}
      width={CELL}
      frameHeight={SIZE}
      centerFrame
      onPress={onOpen ? () => onOpen(person) : undefined}
      onTargetFocusChange={onTargetFocusChange}
      accessibilityLabel={person.name}
      frame={<Portrait person={person} focused={focused} place={place} />}
    >
      <Text style={[styles.name, focused && styles.nameFocused]} numberOfLines={1}>{person.name}</Text>
      {person.detail ? <Text style={styles.detail} numberOfLines={1}>{person.detail}</Text> : null}
    </CardShell>
  );
});

export const PeopleRow = memo(function PeopleRow({
  title,
  people,
  inset,
  onOpen,
}: {
  title: string;
  people: SearchPersonModel[];
  inset: number;
  onOpen?: (person: SearchPersonModel) => void;
}) {
  const forced = useForcedFocusKey();
  const forcedIndex = forced?.startsWith("people:") ? Number(forced.slice(7)) : null;
  const { row, onItemFocusChange } = useRowFocus(forced !== null, forcedIndex);
  if (people.length === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={[text.rowTitle, { paddingLeft: inset }]} numberOfLines={1}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.track}
        // Le premier portrait s'aligne sur le titre ; son nom, centré dessous, déborde à gauche.
        contentContainerStyle={[styles.content, { paddingLeft: inset - (CELL - SIZE) / 2, paddingRight: TV_STAGE.safe.x }]}
      >
        {people.map((person, index) => (
          <Person key={person.id} person={person} index={index} row={row} onOpen={onOpen} onItemFocusChange={onItemFocusChange} />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { marginBottom: TV_STAGE.row.spacing - 24 },
  track: { overflow: "visible", marginTop: TV_STAGE.row.titleGap - 8 },
  content: { gap: 0, paddingTop: 18, paddingBottom: 24 },
  portrait: { width: SIZE, height: SIZE },
  shadow: {
    borderRadius: SIZE / 2,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
  },
  name: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary, marginTop: 22, textAlign: "center", alignSelf: "stretch" },
  nameFocused: { color: colors.text },
  detail: { ...fonts.medium, fontSize: 22, color: colors.textTertiary, marginTop: 2, textAlign: "center", alignSelf: "stretch" },
});
