import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useAnimatedScrollHandler, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReorderList, type ReorderSlot } from "../../octave/reorder/ReorderList";
import { SHELF_REORDER_ROW_HEIGHT, ShelfReorderRow } from "../../octave/collections/reorder/ShelfReorderRow";

interface BenchItem {
  key: string;
  name: string;
  hue: number;
}

interface BenchStats {
  rowRenders: number;
  jsFrames: number;
  uiFrames: number;
  scrollEvents: number;
  scrollY: number;
  moves: string[];
  /** Coupe ou rouvre les poignées (ce que fait un rechargement de la liste en plein geste). */
  setEnabled?: (on: boolean) => void;
}

const COUNT = 150;
const BAR = 52;

/** L'état du banc, lu par l'inspecteur Hermes (`globalThis.__fl1Bench`). */
const stats = (): BenchStats => {
  const g = globalThis as { __fl1Bench?: BenchStats };
  g.__fl1Bench ??= { rowRenders: 0, jsFrames: 0, uiFrames: 0, scrollEvents: 0, scrollY: 0, moves: [] };
  return g.__fl1Bench;
};

const initialItems = (): BenchItem[] => Array.from({ length: COUNT }, (_, i) => ({ key: `t${i + 1}`, name: `Titre ${i + 1}`, hue: (i * 37) % 360 }));

/**
 * Banc du GLISSER (développement seulement) : 150 rangées sur la liste de tri partagée (`ReorderList`), sous une
 * barre du haut à boutons qui la recouvre (comme une page d'Octave). Les compteurs (rendus de rangées, images
 * des deux fils, évènements de défilement, déplacements) se lisent dans `globalThis.__fl1Bench`, et
 * `__fl1Bench.setEnabled(false)` coupe les poignées en plein geste (une liste rechargée).
 */
export function ReorderBenchScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(initialItems);
  const [enabled, setEnabled] = useState(true);
  stats().setEnabled = setEnabled;
  const scrollY = useSharedValue(0);
  const scrolls = useSharedValue(0);
  const uiFrames = useSharedValue(0);
  useFrameCallback(() => {
    uiFrames.value += 1;
  });
  const onScroll = useAnimatedScrollHandler({
    onScroll: () => {
      scrolls.value += 1;
    },
  });
  useEffect(() => {
    let live = true;
    const tick = () => {
      if (!live) return;
      stats().jsFrames += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const copy = setInterval(() => {
      const s = stats();
      s.uiFrames = uiFrames.value;
      s.scrollEvents = scrolls.value;
      s.scrollY = scrollY.value;
    }, 200);
    return () => {
      live = false;
      clearInterval(copy);
    };
  }, [scrollY, scrolls, uiFrames]);

  const onMove = useCallback((from: number, to: number) => {
    stats().moves.push(`${from}->${to}`);
    setItems((list) => {
      const next = list.slice();
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  }, []);
  const renderRow = useCallback((item: BenchItem, _index: number, slot: ReorderSlot) => {
    stats().rowRenders += 1;
    return <ShelfReorderRow name={item.name} subtitle={item.key} art={<View style={[styles.art, { backgroundColor: `hsl(${item.hue}, 55%, 45%)` }]} />} gutter={16} slot={slot} />;
  }, []);
  const keyOf = useCallback((item: BenchItem) => item.key, []);
  const edgeInsets = useMemo(() => ({ top: insets.top + BAR, bottom: insets.bottom }), [insets.bottom, insets.top]);
  const scrollProps = useMemo(() => ({ contentContainerStyle: { paddingTop: insets.top + BAR, paddingBottom: insets.bottom + 24 } }), [insets.bottom, insets.top]);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <ReorderList data={items} keyOf={keyOf} rowHeight={SHELF_REORDER_ROW_HEIGHT} renderRow={renderRow} onMove={enabled ? onMove : null} scrollY={scrollY} onScroll={onScroll} scrollProps={scrollProps} edgeInsets={edgeInsets} />
      <View style={[styles.bar, { paddingTop: insets.top, height: insets.top + BAR }]}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => stats().moves.push("bouton")}>
          <Text style={styles.buttonText}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0d0b13" },
  art: { width: 44, height: 44, borderRadius: 8 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 16, backgroundColor: "rgba(20,16,30,0.85)" },
  button: { minWidth: 64, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
