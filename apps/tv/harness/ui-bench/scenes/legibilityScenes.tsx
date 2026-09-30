import { Fragment } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { GlassSurface, type GlassTone } from "../../../src/redesign/glass/GlassSurface";
import { NATIVE_GLASS_BACKING_ALPHA } from "../../../src/redesign/glass/glassBacking";
import { DENSE_BASE, SOFT_BASE } from "../../../src/redesign/screens/player/surfaces";
import { colors, fonts } from "../../../src/redesign/theme/tokens";
import type { BenchData } from "../data/benchData";
import { byName, videoFrameOf } from "../data/playerModels";
import type { BenchScene } from "./types";

/**
 * Le texte blanc sous le verre, au pire : sur du blanc pur (à gauche) et sur
 * l'image la plus claire de l'instantané, la neige d'Interstellar (à droite).
 * Pour chaque ton, trois fonds : aucun, celui du verre natif (la règle,
 * `glass/glassBacking`), celui des vues au verre dessiné (0,84 sous `strong`,
 * 0,5 ailleurs). À juger en `glass on`, où la règle s'applique ; `sim` et
 * `off` posent les mêmes fonds sous le verre dessiné.
 */

const TONES: GlassTone[] = ["strong", "regular", "clear"];
const DRAWN: Record<GlassTone, string> = { strong: DENSE_BASE, regular: SOFT_BASE, clear: SOFT_BASE };
const TILE = { width: 270, height: 120, gap: 20, left: 55, top: 170 };

const nativeOf = (tone: GlassTone) => `rgba(10, 10, 14, ${NATIVE_GLASS_BACKING_ALPHA[tone]})`;
/** L'opacité d'un fond `rgba(…, a)`, écrite à la française. */
const alphaOf = (color: string) => (color.match(/([\d.]+)\)$/)?.[1] ?? "0").replace(".", ",");

function frameOf(data: BenchData): string | undefined {
  const item = byName(data, "Interstellar");
  return item ? videoFrameOf(data, item) : undefined;
}

function Probe({ tone, backing, label, col, row }: { tone: GlassTone; backing?: string; label: string; col: number; row: number }) {
  return (
    <GlassSurface
      radius={28}
      tone={tone}
      style={[
        styles.probe,
        {
          left: TILE.left + col * (TILE.width + TILE.gap),
          top: TILE.top + row * (TILE.height + TILE.gap),
          backgroundColor: backing,
        },
      ]}
    >
      <Text style={styles.primary}>{label}</Text>
      <Text style={styles.secondary}>{`${tone} · secondaire`}</Text>
    </GlassSurface>
  );
}

function Half({ title, uri, dark }: { title: string; uri?: string; dark: boolean }) {
  return (
    <View style={styles.half}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <Text style={[styles.title, dark && styles.titleOnImage]}>{title}</Text>
      {TONES.map((tone, row) => (
        <Fragment key={tone}>
          <Probe tone={tone} label="sans fond" col={0} row={row} />
          <Probe tone={tone} backing={nativeOf(tone)} label={`natif ${alphaOf(nativeOf(tone))}`} col={1} row={row} />
          <Probe tone={tone} backing={DRAWN[tone]} label={`dessiné ${alphaOf(DRAWN[tone])}`} col={2} row={row} />
        </Fragment>
      ))}
    </View>
  );
}

export const LEGIBILITY_SCENES: BenchScene[] = [
  {
    id: "verre/lisibilite",
    group: "Verre",
    label: "Le texte blanc sous le verre, sur du blanc pur et sur la neige",
    images: (data) => [frameOf(data)].filter((uri): uri is string => !!uri),
    render: (data) => (
      <View style={styles.fill}>
        <Half title="Blanc pur" dark={false} />
        <Half title="Interstellar" uri={frameOf(data)} dark />
      </View>
    ),
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1, flexDirection: "row", backgroundColor: "#FFFFFF" },
  half: { width: 960, height: 1080, overflow: "hidden" },
  title: { ...fonts.bold, position: "absolute", left: TILE.left, top: 80, fontSize: 40, color: "#000" },
  titleOnImage: { color: colors.ctaFg },
  probe: { position: "absolute", width: TILE.width, height: TILE.height, justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 14 },
  primary: { ...fonts.bold, fontSize: 24, color: colors.text },
  secondary: { ...fonts.medium, fontSize: 20, color: colors.textSecondary },
});
