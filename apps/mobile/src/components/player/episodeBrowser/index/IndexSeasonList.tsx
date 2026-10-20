import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import type { SeasonEntry } from "../../../../player/episodes/episodeBrowserModel";
import { EB, EB_TYPE, brandInk } from "../browserTokens";
import { useEpisodeWords } from "../useEpisodeWords";

interface Props {
  seasons: readonly SeasonEntry[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onIntent?: (id: string) => void;
  large: boolean;
}

/**
 * La colonne des saisons du sommaire (paysage) : une ligne par saison, la
 * saison montrée éclairée ; au bout, le nombre d'épisodes, puis le point rose
 * de la saison en cours ou la coche d'une saison vue.
 */
export const IndexSeasonList = memo(function IndexSeasonList({ seasons, activeId, onSelect, onIntent, large }: Props) {
  const words = useEpisodeWords();
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.list}>
      {seasons.map((season) => {
        const active = season.id === activeId;
        return (
          <Pressable
            key={season.id}
            onPressIn={() => onIntent?.(season.id)}
            onPress={() => onSelect(season.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={words.season(season)}
            style={({ pressed }) => [st.row, large && st.rowLarge, active ? st.active : pressed ? st.pressed : null]}
          >
            <Text numberOfLines={1} style={[st.label, large && st.labelLarge, active && st.labelActive]}>{season.label}</Text>
            {season.count !== undefined ? <Text style={st.count}>{season.count}</Text> : null}
            <View style={st.mark}>
              {season.current ? <View style={[st.dot, { backgroundColor: brandInk() }]} />
                : season.watched ? <Check size={14} color={EB.tertiary} strokeWidth={2.6} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const st = StyleSheet.create({
  list: { gap: 2, paddingBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, height: 44, paddingHorizontal: 12, borderRadius: 12 },
  rowLarge: { height: 50 },
  active: { backgroundColor: EB.selected },
  pressed: { backgroundColor: EB.pressed },
  label: { flex: 1, color: EB.secondary, fontSize: EB_TYPE.titleLarge - 1, fontWeight: "600" },
  labelLarge: { fontSize: EB_TYPE.titleLarge + 1 },
  labelActive: { color: EB.label },
  count: { color: EB.tertiary, fontSize: EB_TYPE.kicker, fontWeight: "600", fontVariant: ["tabular-nums"] },
  mark: { width: 14, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
