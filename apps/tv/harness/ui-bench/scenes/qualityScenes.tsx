import { ScrollView, StyleSheet, View } from "react-native";
import { formatDuration, i18n, type MediaItem } from "@tentacle-tv/shared";
import { AmbientBackdrop } from "../../../src/redesign/background/AmbientBackdrop";
import { MediaRow } from "../../../src/redesign/rows/MediaRow";
import { EpisodeCard } from "../../../src/redesign/screens/detail/EpisodeCard";
import type { EpisodeModel } from "../../../src/redesign/screens/detail/detailTypes";
import { cardQualityOf } from "../../../src/redesignWiring/cards/cardQuality";
import type { BenchData } from "../data/benchData";
import { cardOf, episodeLabel, paletteOf, progressOf, resumeSubtitle, yearOf } from "../data/models";
import type { BenchScene } from "./types";

/**
 * Les badges de qualité au focus d'une carte (Apple TV), sur trois titres
 * réels de l'instantané, aux flux connus : un film 4K Dolby Vision avec une
 * VO TrueHD Atmos (Captain America : Brave New World), un film 1080p sans
 * rien (Les Chevaliers du ciel — sa vignette porte un logo), un épisode 4K
 * HDR10 (Game of Thrones, « Le Prince de Winterfell »). En affiche, en
 * vignette 16:9, en vignette d'épisode de la fiche : chacune figée au focus
 * tour à tour, les autres au repos.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
/** L'appui maintenu ouvre le grand panneau dans l'app ; au banc, seule son indication compte. */
const HOLD = () => undefined;

const TITLES = ["112752524c0d653b8565e47fb4022c10", "f66bfe92aa359b3f2eabfb9d88a34540", "7ad305f033e78e3d1a94ebb5a1be2d9f"];

function itemsOf(data: BenchData): MediaItem[] {
  return TITLES.map((id) => data.item(id)).filter((item): item is MediaItem => item !== undefined);
}

function episodeOf(data: BenchData, item: MediaItem): EpisodeModel {
  return {
    id: item.Id,
    number: item.IndexNumber ?? undefined,
    title: item.Type === "Episode" ? item.Name ?? "" : `${item.Name ?? ""} (exemple)`,
    imageUri: data.image(item.Id, item.Type === "Episode" ? "Primary" : "Backdrop"),
    meta: formatDuration(item.RunTimeTicks) ?? undefined,
    progress: progressOf(item),
    palette: paletteOf(data, item),
    quality: cardQualityOf(item),
  };
}

function QualityCards({ data }: { data: BenchData }) {
  const items = itemsOf(data);
  if (items.length === 0) return null;
  const subtitle = (item: MediaItem) => (item.Type === "Episode" ? episodeLabel(item, true) : yearOf(item));
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={cardOf(data, items[0]).palette!} />
      <ScrollView contentContainerStyle={styles.page}>
        <MediaRow rowKey="poster" title={t("common:latestAdditionsShort")} variant="poster" inset={96} onLongPressCard={HOLD}
          cards={items.map((item) => cardOf(data, item, subtitle(item)))} />
        <MediaRow rowKey="landscape" title={t("common:resumeWatching")} variant="landscape" inset={96} onLongPressCard={HOLD}
          cards={items.map((item) => cardOf(data, item, resumeSubtitle(item), "item"))} />
      </ScrollView>
    </View>
  );
}

/** Les vignettes d'épisode de la fiche (460 × 259) : sans note, toute la largeur. */
function QualityEpisodes({ data }: { data: BenchData }) {
  const items = itemsOf(data);
  if (items.length === 0) return null;
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={cardOf(data, items[0]).palette!} />
      <View style={styles.episodes}>
        {items.map((item, index) => (
          <EpisodeCard key={item.Id} episode={episodeOf(data, item)} focusKey={`episode:${index}`} onLongPress={HOLD} />
        ))}
      </View>
    </View>
  );
}

const imagesOf = (data: BenchData) =>
  itemsOf(data).flatMap((item) => [data.image(item.Id, "Primary"), data.image(item.Id, "Thumb"), data.image(item.Id, "Backdrop")]).filter((uri): uri is string => !!uri);

const G = "Badges de qualité";

export const QUALITY_SCENES: BenchScene[] = [
  {
    id: "badges/cartes",
    group: G,
    label: "4K Dolby Vision Atmos · 1080p sans badge · épisode 4K HDR10 — affiches et vignettes",
    focusKeys: ["poster:0", "poster:1", "poster:2", "landscape:0", "landscape:1", "landscape:2"],
    settleMs: 1600,
    images: imagesOf,
    render: (data) => <QualityCards data={data} />,
  },
  {
    id: "badges/episodes",
    group: G,
    label: "Les mêmes en vignettes d'épisode de la fiche",
    focusKeys: ["episode:0", "episode:1", "episode:2"],
    settleMs: 1600,
    images: imagesOf,
    render: (data) => <QualityEpisodes data={data} />,
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingTop: 48, paddingBottom: 120 },
  episodes: { flexDirection: "row", gap: 36, paddingLeft: 96, paddingTop: 220 },
});
