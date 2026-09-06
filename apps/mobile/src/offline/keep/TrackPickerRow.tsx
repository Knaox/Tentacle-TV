import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MediaStream } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, typography, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  label: string;
  /** Libellé du choix « par défaut » / « aucun ». */
  emptyLabel: string;
  tracks: readonly MediaStream[];
  value: number | undefined;
  onChange: (index: number | undefined) => void;
  /** Index des pistes que cet appareil ne lit pas (barrées d'un avertissement). */
  unplayable?: readonly number[];
}

export function trackLabel(stream: MediaStream): string {
  return stream.DisplayTitle ?? `${stream.Language ?? "?"} (#${stream.Index})`;
}

/** Un choix de piste (audio à embarquer, sous-titre à incruster) en puces. */
export function TrackPickerRow({ label, emptyLabel, tracks, value, onChange, unplayable = [] }: Props) {
  const st = useThemedStyles(makeStyles);
  const choices: Array<{ index: number | undefined; text: string; warn: boolean }> = [
    { index: undefined, text: emptyLabel, warn: false },
    ...tracks.map((track) => ({ index: track.Index, text: trackLabel(track), warn: unplayable.includes(track.Index) })),
  ];
  return (
    <View>
      <Text style={st.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
        {choices.map((choice) => {
          const selected = choice.index === value;
          return (
            <Pressable
              key={String(choice.index)}
              onPress={() => onChange(choice.index)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[st.chip, selected && st.chipSelected]}
            >
              <Text style={[st.chipText, selected && st.chipTextSelected, choice.warn && st.chipWarn]} numberOfLines={1}>
                {choice.text}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
    row: { gap: 8 },
    chip: {
      maxWidth: 220,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    chipSelected: {
      backgroundColor: withAlpha(t.colors.brand.violet, 0.16, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow),
    },
    chipText: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    chipTextSelected: { color: t.colors.text.primary, fontFamily: FONT_FAMILY.semibold },
    chipWarn: { textDecorationLine: "line-through", color: t.colors.text.quaternary },
  });
