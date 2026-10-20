import { memo, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Check, Play } from "lucide-react-native";
import type { SeasonEntry } from "../../../../player/episodes/episodeBrowserModel";
import { EB, EB_TYPE } from "../browserTokens";
import { useEpisodeWords } from "../useEpisodeWords";

interface Props {
  seasons: readonly SeasonEntry[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onIntent?: (id: string) => void;
  inset: number;
  large: boolean;
}

/**
 * Les saisons du panneau, comme la TV : une pastille par saison — blanche,
 * texte noir, quand elle est montrée ; le triangle de lecture sur celle de
 * l'épisode en cours, la coche sur une saison vue, le nombre d'épisodes au
 * bout, en plus pâle.
 */
export const SeasonChips = memo(function SeasonChips({ seasons, activeId, onSelect, onIntent, inset, large }: Props) {
  const words = useEpisodeWords();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  useEffect(() => {
    const timer = setTimeout(() => {
      const x = activeId ? offsets.current.get(activeId) : undefined;
      if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - inset), animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeId, inset]);

  if (seasons.length < 2) return null;
  const height = large ? 38 : 34;
  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} style={st.scroll} contentContainerStyle={[st.row, { paddingHorizontal: inset }]}>
      {seasons.map((season) => {
        const active = season.id === activeId;
        const ink = active ? "#000000" : EB.label;
        return (
          <Pressable
            key={season.id}
            onLayout={(e) => offsets.current.set(season.id, e.nativeEvent.layout.x)}
            onPressIn={() => onIntent?.(season.id)}
            onPress={() => onSelect(season.id)}
            hitSlop={{ top: 5, bottom: 5 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={words.season(season)}
            style={({ pressed }) => [st.chip, { height, borderRadius: height / 2 }, active ? st.active : pressed ? st.pressed : null]}
          >
            {season.current ? <Play size={11} color={ink} fill={ink} strokeWidth={0} /> : null}
            <Text numberOfLines={1} style={[st.label, { color: ink }, large && st.labelLarge]}>{season.label}</Text>
            {season.count !== undefined ? <Text style={[st.count, active && st.countActive]}>{season.count}</Text> : null}
            {season.watched && !season.current ? <Check size={13} color={active ? "rgba(0,0,0,0.55)" : EB.secondary} strokeWidth={2.6} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const st = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, backgroundColor: EB.fill },
  active: { backgroundColor: "rgba(255, 255, 255, 0.94)" },
  pressed: { backgroundColor: EB.fillStrong },
  label: { fontSize: EB_TYPE.title - 1, fontWeight: "600" },
  labelLarge: { fontSize: EB_TYPE.title },
  count: { color: EB.tertiary, fontSize: EB_TYPE.kicker, fontWeight: "600", fontVariant: ["tabular-nums"] },
  countActive: { color: "rgba(0, 0, 0, 0.45)" },
});
