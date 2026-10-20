import { memo, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "lucide-react-native";
import type { SeasonEntry } from "../../../../player/episodes/episodeBrowserModel";
import { EB, EB_TYPE, brandGauge, brandInk } from "../browserTokens";
import { useEpisodeWords } from "../useEpisodeWords";

interface Props {
  seasons: readonly SeasonEntry[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onIntent?: (id: string) => void;
  /** Le titre quand il n'y a qu'une saison (rien à choisir). */
  fallbackTitle: string;
  large: boolean;
}

/**
 * Les saisons de l'étagère : des MOTS, pas des boutons — la saison montrée en
 * blanc, soulignée d'un trait de la marque ; les autres en gris. Une coche dit
 * la saison vue ; un point rose, celle de l'épisode en cours quand on en
 * regarde une autre.
 */
export const ShelfSeasonTabs = memo(function ShelfSeasonTabs({ seasons, activeId, onSelect, onIntent, fallbackTitle, large }: Props) {
  const words = useEpisodeWords();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  useEffect(() => {
    const timer = setTimeout(() => {
      const x = activeId ? offsets.current.get(activeId) : undefined;
      if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeId]);

  const size = large ? EB_TYPE.titleLarge : EB_TYPE.title;
  if (seasons.length < 2) {
    return <Text accessibilityRole="header" numberOfLines={1} style={[st.heading, { fontSize: size + 2 }]}>{seasons[0]?.label ?? fallbackTitle}</Text>;
  }
  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} style={st.scroll} contentContainerStyle={st.row}>
      {seasons.map((season) => {
        const active = season.id === activeId;
        return (
          <Pressable
            key={season.id}
            onLayout={(e) => offsets.current.set(season.id, e.nativeEvent.layout.x)}
            onPressIn={() => onIntent?.(season.id)}
            onPress={() => onSelect(season.id)}
            hitSlop={{ top: 10, bottom: 10 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={words.season(season)}
            style={({ pressed }) => [st.tab, pressed && !active && st.pressed]}
          >
            <View style={st.labelRow}>
              <Text numberOfLines={1} style={[st.label, { fontSize: size }, active && st.labelActive]}>{season.label}</Text>
              {season.current && !active ? <View style={[st.dot, { backgroundColor: brandInk() }]} /> : null}
              {season.watched && !season.current ? <Check size={13} color={active ? EB.secondary : EB.tertiary} strokeWidth={2.6} /> : null}
            </View>
            {active ? <LinearGradient colors={brandGauge()} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.underline} /> : <View style={st.underlineSpace} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const st = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  row: { gap: 22, alignItems: "flex-end", paddingRight: 8 },
  tab: { paddingTop: 6, gap: 7 },
  pressed: { opacity: 0.6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  // Plus clair que le gris secondaire : sur une image claire, sous le voile, il doit rester lisible.
  label: { color: "rgba(235, 235, 245, 0.74)", fontWeight: "600", letterSpacing: -0.1 },
  labelActive: { color: EB.label },
  dot: { width: 6, height: 6, borderRadius: 3 },
  underline: { height: 3, borderRadius: 1.5, width: "100%" },
  underlineSpace: { height: 3 },
  heading: { color: EB.label, fontWeight: "700", letterSpacing: -0.2, flexShrink: 1 },
});
