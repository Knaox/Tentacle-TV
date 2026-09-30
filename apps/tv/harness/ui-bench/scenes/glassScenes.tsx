import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { i18n } from "@tentacle-tv/shared";
import { PillButton } from "../../../src/redesign/controls/PillButton";
import { RoundButton } from "../../../src/redesign/controls/RoundButton";
import { GlassSurface, type GlassTone } from "../../../src/redesign/glass/GlassSurface";
import { scrim, text } from "../../../src/redesign/theme/tokens";
import type { BenchData } from "../data/benchData";
import type { BenchScene } from "./types";

/**
 * Le verre seul, là où il se juge : sur une vraie image. Deux états :
 * - les trois densités (`regular`, `strong`, `clear`) et les boutons de verre
 *   posés sur un fond d'œuvre — le verre natif y réfracte l'image, la
 *   simulation n'y met qu'un voile ;
 * - le même verre sous des parents à opacité fixe (1 → 0,25) : les images
 *   d'un fondu, figées. C'est là qu'UIKit dégrade le verre natif.
 *
 * À comparer en trois verres : `planche verre --glass=on,sim,off`.
 */

const t = (key: string) => i18n.t(key) as string;

const TONES: GlassTone[] = ["regular", "strong", "clear"];
const FADES = [1, 0.75, 0.5, 0.25];

/** Un fond d'œuvre lumineux : le premier film qui a une image de fond. */
function backdropOf(data: BenchData): string | undefined {
  for (const item of data.list("movies", 12)) {
    const uri = data.image(item.Id, "Backdrop");
    if (uri) return uri;
  }
  return undefined;
}

function Backdrop({ uri }: { uri?: string }) {
  return (
    <>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <LinearGradient colors={[scrim(0.55), scrim(0)]} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
    </>
  );
}

function OnImage({ data }: { data: BenchData }) {
  return (
    <View style={styles.fill}>
      <Backdrop uri={backdropOf(data)} />
      <View style={styles.page}>
        <Text style={text.title}>Verre sur une image</Text>
        <View style={styles.row}>
          {TONES.map((tone) => (
            <GlassSurface key={tone} radius={32} tone={tone} style={styles.tile}>
              <Text style={styles.label}>{tone}</Text>
            </GlassSurface>
          ))}
          <GlassSurface radius={32} tone="regular" elevated style={styles.tile}>
            <Text style={styles.label}>regular · elevated</Text>
          </GlassSurface>
        </View>
        <View style={styles.row}>
          <PillButton variant="glass" label={t("common:trailer")} icon="trailer" focusKey="glass:trailer" />
          <PillButton variant="glass" label={t("common:moreInfo")} icon="info" size="md" focusKey="glass:info" />
          <RoundButton icon="plus" label={t("common:myList")} focusKey="glass:list" />
          <RoundButton icon="heart" label={t("common:myFavorites")} active focusKey="glass:fav" />
        </View>
      </View>
    </View>
  );
}

function UnderFade({ data }: { data: BenchData }) {
  return (
    <View style={styles.fill}>
      <Backdrop uri={backdropOf(data)} />
      <View style={styles.page}>
        <Text style={text.title}>Verre sous un fondu (opacité du parent)</Text>
        {TONES.map((tone) => (
          <View key={tone} style={styles.row}>
            {FADES.map((opacity) => (
              <View key={opacity} style={{ opacity }}>
                <GlassSurface radius={28} tone={tone} style={styles.small}>
                  <Text style={styles.label}>{`${tone} · ${opacity}`}</Text>
                </GlassSurface>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export const GLASS_SCENES: BenchScene[] = [
  {
    id: "verre/image",
    group: "Verre",
    label: "Densités et boutons sur une image",
    focusKeys: ["glass:trailer", "glass:list"],
    images: (data) => [backdropOf(data)].filter((uri): uri is string => !!uri),
    render: (data) => <OnImage data={data} />,
  },
  {
    id: "verre/fondu",
    group: "Verre",
    label: "Sous un parent en fondu (1 → 0,25)",
    images: (data) => [backdropOf(data)].filter((uri): uri is string => !!uri),
    render: (data) => <UnderFade data={data} />,
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  page: { paddingTop: 70, paddingHorizontal: 96, gap: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 28 },
  tile: { width: 340, height: 170, alignItems: "center", justifyContent: "center" },
  small: { width: 300, height: 120, alignItems: "center", justifyContent: "center" },
  label: { ...text.body, fontSize: 26 },
});
