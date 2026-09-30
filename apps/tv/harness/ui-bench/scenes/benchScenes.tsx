import { memo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { BRAND, TEXT } from "@tentacle-tv/shared/theme";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { useFocusVisual } from "../../../src/redesign/focus/focusPreview";
import { useLiquidGlassEnabled } from "../../../src/redesign/glass/liquidGlassMode";
import type { BenchData } from "../data/benchData";
import type { SnapshotImageType } from "../data/snapshotFormat";
import type { BenchScene } from "./types";

/**
 * Les scènes « Banc » : le banc qui se contrôle lui-même — l'instantané
 * (images et états réels), le focus figé, le verre et la langue. Pas une
 * maquette : de quoi vérifier que tout ce que les vues recevront est là.
 */

const GRID_TYPES: Array<{ id: string; label: string; type: SnapshotImageType; ratio: number; width: number }> = [
  { id: "banc/affiches", label: "Instantané · affiches", type: "Primary", ratio: 2 / 3, width: 200 },
  { id: "banc/vignettes", label: "Instantané · vignettes", type: "Thumb", ratio: 16 / 9, width: 330 },
  { id: "banc/fonds", label: "Instantané · fonds", type: "Backdrop", ratio: 16 / 9, width: 330 },
  { id: "banc/logos", label: "Instantané · logos", type: "Logo", ratio: 16 / 6, width: 330 },
];

function catalogItems(data: BenchData): MediaItem[] {
  const { lists } = data.snapshot;
  const ids = [...lists.movies, ...lists.series, ...lists.anime, ...lists.collections, ...lists.episodes, ...lists.people];
  return data.items([...new Set(ids)]);
}

function ImageGrid({ data, type, ratio, width }: { data: BenchData; type: SnapshotImageType; ratio: number; width: number }) {
  const items = catalogItems(data);
  const withImage = items.filter((item) => data.image(item.Id, type));
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      <Text style={styles.title}>{`${type} · ${withImage.length} / ${items.length} éléments`}</Text>
      <View style={styles.grid}>
        {items.map((item) => {
          const uri = data.image(item.Id, type);
          return (
            <View key={item.Id} style={{ width }}>
              <View style={[styles.frame, { width, height: width / ratio }, type === "Logo" && styles.logoFrame]}>
                {uri ? <Image source={{ uri }} style={styles.fill} resizeMode={type === "Logo" ? "contain" : "cover"} /> : <Text style={styles.missing}>{"—"}</Text>}
              </View>
              <Text style={styles.caption} numberOfLines={1}>{item.Name}</Text>
              <Text style={styles.meta} numberOfLines={1}>{item.Type}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function StatesTable({ data }: { data: BenchData }) {
  const { snapshot } = data;
  const all = Object.values(snapshot.items).map((entry) => entry.item);
  const count = (test: (item: MediaItem) => boolean) => all.filter(test).length;
  const rows: Array<[string, number | string]> = [
    ["Compte", snapshot.account],
    ["Capturé le", snapshot.capturedAt.slice(0, 16).replace("T", " à ") || "—"],
    ["Éléments", all.length],
    ["Films · séries · animés", `${snapshot.lists.movies.length} · ${snapshot.lists.series.length} · ${snapshot.lists.anime.length}`],
    ["Épisodes · personnes · sagas", `${snapshot.lists.episodes.length} · ${snapshot.lists.people.length} · ${snapshot.lists.collections.length}`],
    ["En cours (reprise)", count((item) => (item.UserData?.PlaybackPositionTicks ?? 0) > 0)],
    ["Vus", count((item) => item.UserData?.Played === true)],
    ["Favoris", count((item) => item.UserData?.IsFavorite === true)],
    ["Ma liste", snapshot.lists.watchlist.length],
    ["Notes perso", Object.keys(snapshot.ratings).length],
    ["Séries avec saisons", Object.keys(snapshot.seasons).length],
    ["Étagères « Pour vous »", snapshot.shelves.length],
    ["Bibliothèques", snapshot.libraries.map((lib) => lib.name).join(" · ") || "—"],
  ];
  return (
    <View style={styles.page}>
      <Text style={styles.title}>États réels de l'instantané</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

const FOCUS_TILES = ["tile:0", "tile:1", "tile:2", "tile:3"];

/** Une tuile de démonstration du focus figé (la vraie carte viendra avec les briques). */
const DemoTile = memo(function DemoTile({ focusKey, index }: { focusKey: string; index: number }) {
  const { focused, onFocus, onBlur } = useFocusVisual(focusKey);
  return (
    <Pressable onFocus={onFocus} onBlur={onBlur} style={[styles.tile, focused && styles.tileFocused]}>
      <Text style={[styles.tileText, focused && styles.tileTextFocused]}>{`Tuile ${index + 1}`}</Text>
      <Text style={[styles.meta, focused && styles.tileTextFocused]}>{focused ? "focalisée" : "au repos"}</Text>
    </Pressable>
  );
});

function FocusAndModes() {
  const { t } = useTranslation(["common", "nav"]);
  const liquid = useLiquidGlassEnabled();
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Focus figé · verre · langue</Text>
      <View style={styles.tiles}>
        {FOCUS_TILES.map((key, index) => <DemoTile key={key} focusKey={key} index={index} />)}
      </View>
      <Text style={styles.body}>{`Verre : ${liquid ? "Liquid Glass demandé" : "verre enrichi (Liquid Glass coupé)"}`}</Text>
      <Text style={styles.body}>{`i18n : « ${t("common:play")} » · « ${t("nav:home", { defaultValue: "?" })} »`}</Text>
    </View>
  );
}

export const BENCH_SCENES: BenchScene[] = [
  { id: "banc/etats", group: "Banc", label: "Instantané · états", render: (data) => <StatesTable data={data} /> },
  ...GRID_TYPES.map(({ id, label, type, ratio, width }): BenchScene => ({
    id,
    group: "Banc",
    label,
    settleMs: 1500,
    images: (data) => catalogItems(data).map((item) => data.image(item.Id, type)).filter((uri): uri is string => !!uri).slice(0, 40),
    render: (data) => <ImageGrid data={data} type={type} ratio={ratio} width={width} />,
  })),
  { id: "banc/focus", group: "Banc", label: "Focus figé, verre, langue", focusKeys: FOCUS_TILES, render: () => <FocusAndModes /> },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flexGrow: 1, backgroundColor: "#07070c", paddingHorizontal: TV_OVERSCAN_PT.x, paddingTop: TV_OVERSCAN_PT.y, paddingBottom: 120, gap: 24 },
  title: { color: TEXT.primary, fontSize: 40, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  frame: { borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  logoFrame: { backgroundColor: "#2a2a35" },
  missing: { color: TEXT.tertiary, fontSize: 40 },
  caption: { color: TEXT.primary, fontSize: 22, fontWeight: "600", marginTop: 8 },
  meta: { color: TEXT.tertiary, fontSize: 22 },
  row: { flexDirection: "row", gap: 32, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingVertical: 8 },
  rowLabel: { width: 520, color: TEXT.secondary, fontSize: 28 },
  rowValue: { flex: 1, color: TEXT.primary, fontSize: 28, fontWeight: "700" },
  tiles: { flexDirection: "row", gap: 32, marginVertical: 24 },
  tile: { width: 300, height: 170, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  tileFocused: { backgroundColor: BRAND.violet, transform: [{ scale: 1.08 }] },
  tileText: { color: TEXT.primary, fontSize: 30, fontWeight: "700" },
  tileTextFocused: { color: "#FFFFFF" },
  body: { color: TEXT.secondary, fontSize: 28 },
});
