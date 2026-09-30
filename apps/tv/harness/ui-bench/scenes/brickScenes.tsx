import { ScrollView, StyleSheet, Text, View } from "react-native";
import { i18n } from "@tentacle-tv/shared";
import { AmbientBackdrop } from "../../../src/redesign/background/AmbientBackdrop";
import { Chip } from "../../../src/redesign/controls/Chip";
import { PillButton } from "../../../src/redesign/controls/PillButton";
import { RoundButton } from "../../../src/redesign/controls/RoundButton";
import { GlassSurface } from "../../../src/redesign/glass/GlassSurface";
import { MediaRow } from "../../../src/redesign/rows/MediaRow";
import { text } from "../../../src/redesign/theme/tokens";
import type { BenchData } from "../data/benchData";
import { cardOf, episodeLabel, resumeSubtitle, yearOf } from "../data/models";
import type { BenchScene } from "./types";

/**
 * Les briques seules, sur les vraies images : cartes 16:9, affiches, cartes
 * qui se redressent, boutons, pastilles et verre — chacune figée au focus
 * tour à tour. C'est la planche « Briques » de la refonte.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

function Cards({ data }: { data: BenchData }) {
  const movies = data.list("movies", 8);
  const palette = cardOf(data, movies[0]).palette!;
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={palette} />
      <ScrollView contentContainerStyle={styles.page}>
        <MediaRow rowKey="land" title={t("common:resumeWatching")} variant="landscape" inset={96}
          cards={data.list("resume", 6).map((it) => cardOf(data, it, resumeSubtitle(it)))} />
        <MediaRow rowKey="morph" title={t("common:latestAdditionsShort")} variant="morph" inset={96}
          cards={movies.map((it) => cardOf(data, it, yearOf(it)))} />
        <MediaRow rowKey="ep" title={t("common:nextEpisodes")} variant="landscape" inset={96}
          cards={data.list("nextUp", 6).map((it) => cardOf(data, it, episodeLabel(it, true)))} />
      </ScrollView>
    </View>
  );
}

function Posters({ data }: { data: BenchData }) {
  const series = data.list("series", 8);
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={cardOf(data, series[0]).palette!} />
      <View style={styles.page}>
        <MediaRow rowKey="poster" title={t("common:myList")} variant="poster" inset={96}
          cards={series.map((it) => cardOf(data, it, yearOf(it)))} />
        <MediaRow rowKey="anime" title="Animés" variant="poster" inset={96}
          cards={data.list("anime", 8).map((it) => cardOf(data, it, yearOf(it)))} />
      </View>
    </View>
  );
}

function Controls({ data }: { data: BenchData }) {
  const palette = cardOf(data, data.list("movies")[3]).palette!;
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={palette} />
      <View style={[styles.page, styles.gapped]}>
        <Text style={text.title}>{t("common:play")} · {t("common:resume")}</Text>
        <View style={styles.row}>
          {/* La lecture porte la marque (`brand`) ; la pilule blanche reste celle d'un écran qui ne lit rien. */}
          <PillButton variant="brand" label={t("common:play")} icon="play" focusKey="btn:play" />
          <PillButton variant="brand" label={t("common:resume")} icon="play" progress={0.62} focusKey="btn:resume" />
          <PillButton variant="primary" label={t("common:retry")} icon="refresh" focusKey="btn:retry" />
          <PillButton variant="glass" label={t("common:trailer")} icon="trailer" focusKey="btn:trailer" />
          <PillButton variant="glass" label={t("common:moreInfo")} icon="info" size="md" focusKey="btn:info" />
        </View>
        <View style={styles.row}>
          <RoundButton icon="plus" activeIcon="check" label={t("common:myList")} focusKey="round:list" />
          <RoundButton icon="heart" label={t("common:myFavorites")} active focusKey="round:fav" />
          <RoundButton icon="check" label={t("cards:markWatched")} focusKey="round:seen" />
          <RoundButton icon="star" label={t("reco:yourRating")} focusKey="round:rate" />
        </View>
        <View style={styles.row}>
          <Chip label="Genres" detail="3" trailingIcon="chevronDown" focusKey="chip:genres" />
          <Chip label="Drame" selected trailingIcon="close" focusKey="chip:drama" />
          <Chip label="Trier par" detail="Titre A→Z" icon="sort" focusKey="chip:sort" />
          <Chip label="Saison 2" detail="22" size="md" focusKey="chip:season" />
        </View>
        <View style={styles.row}>
          <GlassSurface radius={32} style={styles.glassDemo}><Text style={text.body}>regular</Text></GlassSurface>
          <GlassSurface radius={32} tone="strong" style={styles.glassDemo}><Text style={text.body}>strong</Text></GlassSurface>
          <GlassSurface radius={32} tone="clear" style={styles.glassDemo}><Text style={text.body}>clear</Text></GlassSurface>
        </View>
      </View>
    </View>
  );
}

export const BRICK_SCENES: BenchScene[] = [
  { id: "briques/cartes", group: "Briques", label: "Cartes 16:9 et redressées", focusKeys: ["land:1", "morph:1", "morph:3", "ep:0"], settleMs: 1400, render: (data) => <Cards data={data} /> },
  { id: "briques/affiches", group: "Briques", label: "Affiches", focusKeys: ["poster:2", "anime:0"], settleMs: 1400, render: (data) => <Posters data={data} /> },
  {
    id: "briques/controles",
    group: "Briques",
    label: "Boutons, ronds, pastilles, verre",
    focusKeys: ["btn:play", "btn:resume", "btn:retry", "btn:trailer", "round:list", "round:fav", "chip:genres", "chip:drama"],
    render: (data) => <Controls data={data} />,
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingTop: 70, paddingBottom: 120 },
  gapped: { paddingHorizontal: 96, gap: 44 },
  row: { flexDirection: "row", alignItems: "center", gap: 28 },
  glassDemo: { width: 300, height: 150, alignItems: "center", justifyContent: "center" },
});
