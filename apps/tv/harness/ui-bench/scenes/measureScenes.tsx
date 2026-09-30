import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { GlassSurface, type GlassTone } from "../../../src/redesign/glass/GlassSurface";
import { useNativeGlassBacking } from "../../../src/redesign/glass/glassBacking";
import { DENSE_BASE, SOFT_BASE } from "../../../src/redesign/screens/player/surfaces";
import { text } from "../../../src/redesign/theme/tokens";
import type { BenchData } from "../data/benchData";
import type { BenchScene } from "./types";

/**
 * Le banc de MESURE du verre (`bench.mjs gpu`) : le pire cas — une image qui
 * glisse sans fin SOUS le verre, qui doit donc se recalculer à chaque image.
 * Cinq états, toujours la même image en mouvement :
 * - `mesure/fond` : sans verre — la référence ;
 * - `mesure/verre` : six surfaces de verre visibles (nav, feuille, boutons) ;
 * - `mesure/cache` : les mêmes, sous une opacité 0 — ce qu'on ne voit pas
 *   doit ne rien coûter ;
 * - `mesure/fonds-dessines` et `mesure/fonds` : les mêmes, chacun sur son fond
 *   — dessiné (0,84 sous `strong`, 0,5 ailleurs), ou celui de la règle du
 *   verre natif (`glass/glassBacking`) : ce que la règle change au coût.
 * La seule animation infinie du dépôt, et elle n'existe qu'ici.
 */

const SLIDE = 240;

function backdropOf(data: BenchData): string | undefined {
  for (const item of data.list("movies", 12)) {
    const uri = data.image(item.Id, "Backdrop");
    if (uri) return uri;
  }
  return undefined;
}

function MovingBackdrop({ uri }: { uri?: string }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, true);
    return () => cancelAnimation(x);
  }, [x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: -SLIDE * x.value }] }));
  return uri ? <Animated.Image source={{ uri }} style={[styles.image, slide]} resizeMode="cover" fadeDuration={0} /> : null;
}

const PANELS: Array<{ tone: GlassTone; style: object; radius: number }> = [
  { tone: "regular", style: { left: 32, top: 40, width: 112, height: 1000 }, radius: 36 },
  { tone: "strong", style: { right: 96, top: 120, width: 640, height: 720 }, radius: 40 },
  { tone: "clear", style: { left: 240, top: 820, width: 300, height: 68 }, radius: 34 },
  { tone: "clear", style: { left: 568, top: 820, width: 240, height: 68 }, radius: 34 },
  { tone: "clear", style: { left: 836, top: 820, width: 68, height: 68 }, radius: 34 },
  { tone: "clear", style: { left: 932, top: 820, width: 68, height: 68 }, radius: 34 },
];

type Backing = "none" | "drawn" | "rule";

/** Un verre du banc, sur son fond : aucun, dessiné, ou celui de la règle. */
function Panel({ panel, backing }: { panel: (typeof PANELS)[number]; backing: Backing }) {
  const native = useNativeGlassBacking(panel.tone);
  const drawn = panel.tone === "strong" ? styles.dense : styles.soft;
  return (
    <GlassSurface
      radius={panel.radius}
      tone={panel.tone}
      style={[styles.panel, panel.style, backing !== "none" && drawn, backing === "rule" && native]}
    />
  );
}

function Measure({ data, glass, backing }: { data: BenchData; glass: "none" | "shown" | "hidden"; backing: Backing }) {
  return (
    <View style={styles.fill}>
      <MovingBackdrop uri={backdropOf(data)} />
      {glass === "none" ? null : (
        <View style={[StyleSheet.absoluteFill, glass === "hidden" && styles.hidden]}>
          {PANELS.map((panel, index) => (
            <Panel key={index} panel={panel} backing={backing} />
          ))}
        </View>
      )}
      <Text style={[text.caption, styles.tag]}>{`mesure · ${glass}${backing === "none" ? "" : ` · fonds ${backing}`}`}</Text>
    </View>
  );
}

const measure = (id: string, label: string, glass: "none" | "shown" | "hidden", backing: Backing = "none"): BenchScene => ({
  id: `mesure/${id}`,
  group: "Mesure",
  label,
  images: (data) => [backdropOf(data)].filter((uri): uri is string => !!uri),
  render: (data) => <Measure data={data} glass={glass} backing={backing} />,
});

export const MEASURE_SCENES: BenchScene[] = [
  measure("fond", "Image en mouvement, sans verre", "none"),
  measure("verre", "Image en mouvement sous six verres", "shown"),
  measure("cache", "Les mêmes verres, sous une opacité 0", "hidden"),
  measure("fonds-dessines", "Les mêmes verres sur leurs fonds dessinés", "shown", "drawn"),
  measure("fonds", "Les mêmes verres sur les fonds de la règle", "shown", "rule"),
];

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  image: { position: "absolute", left: 0, top: 0, width: 1920 + SLIDE, height: 1080 },
  hidden: { opacity: 0 },
  panel: { position: "absolute" },
  dense: { backgroundColor: DENSE_BASE },
  soft: { backgroundColor: SOFT_BASE },
  tag: { position: "absolute", left: 240, top: 60 },
});
