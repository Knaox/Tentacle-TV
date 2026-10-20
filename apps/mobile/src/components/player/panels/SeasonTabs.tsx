import { memo, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { PANEL, PANEL_TYPE } from "./panelTokens";

export interface SeasonTab {
  id: string;
  label: string;
}

interface Props {
  seasons: readonly SeasonTab[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  /** Le doigt se pose : de quoi précharger la saison avant le relâché. */
  onIntent?: (id: string) => void;
}

/**
 * Les saisons en tête de la liste, comme l'app TV d'Apple : des libellés en
 * ligne, la saison affichée en pilule claire, les autres en gris. Une saison
 * unique n'a pas d'onglets (rien à choisir).
 */
export const SeasonTabs = memo(function SeasonTabs({ seasons, activeId, onSelect, onIntent }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  // La saison affichée ramenée dans le champ à l'ouverture (saison 14 de 22).
  useEffect(() => {
    if (!activeId) return;
    const timer = setTimeout(() => {
      const x = offsets.current.get(activeId);
      if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - 18), animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeId]);

  if (seasons.length < 2) return null;
  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
      {seasons.map((season) => {
        const active = season.id === activeId;
        return (
          <Pressable
            key={season.id}
            onLayout={(e) => offsets.current.set(season.id, e.nativeEvent.layout.x)}
            onPressIn={() => onIntent?.(season.id)}
            onPress={() => onSelect(season.id)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [st.tab, active && st.tabActive, pressed && !active && st.tabPressed]}
          >
            <Text numberOfLines={1} style={[st.label, active && st.labelActive]}>{season.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const st = StyleSheet.create({
  row: { gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
  tab: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: "center" },
  tabActive: { backgroundColor: "rgba(255, 255, 255, 0.92)" },
  tabPressed: { backgroundColor: PANEL.pressed },
  label: { color: PANEL.secondary, fontSize: PANEL_TYPE.section, fontWeight: "600" },
  labelActive: { color: "#000000" },
});
