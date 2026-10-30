/**
 * Octave mobile — choisir une playlist pour un titre, ou en CRÉER une (« Nouvelle
 * playlist… » : un nom, puis le titre y entre aussitôt). La demande vient du
 * magasin commun (`openPlaylistChooser`, api-client : la feuille d'un titre,
 * « Changer » d'un avis) ; les gestes sont ceux du bureau. Seules les playlists
 * modifiables se proposent : les FAVORITES d'abord, dans l'ordre personnel, puis
 * les autres (`usePlaylistChooserSections`, lot fl).
 */

import { useState, useSyncExternalStore } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react-native";
import { chooserSnapshot, closePlaylistChooser, subscribeChooser, usePlaylistChooserSections, type ChooserRequest } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useMobileBulkGestures, useMobileTrackActions } from "../env/useMobileActionsUi";
import { LibraryPlaylistArtwork } from "../ui/PlaylistArtwork";
import { accentTextOf } from "../ui/pageStyle";
import { OctaveBrandFill } from "../../layout/OctaveBrandFill";

type ChooserRow = { type: "title"; label: string } | { type: "playlist"; playlist: MusicPlaylist };

/** Les rangées : « Playlists favorites » puis « Autres playlists » s'il y a des favorites ; sinon une seule liste. */
function chooserRows(favorites: readonly MusicPlaylist[], others: readonly MusicPlaylist[], label: (key: "favorites" | "others") => string): ChooserRow[] {
  const rows = (list: readonly MusicPlaylist[]) => list.map((playlist): ChooserRow => ({ type: "playlist", playlist }));
  if (favorites.length === 0) return rows(others);
  return [{ type: "title", label: label("favorites") }, ...rows(favorites), ...(others.length > 0 ? [{ type: "title" as const, label: label("others") }, ...rows(others)] : [])];
}

function Chooser({ request }: { request: ChooserRequest }) {
  const { t } = useTranslation("music");
  const { t: tf } = useTranslation("musicFavorites");
  const theme = useTheme();
  const sections = usePlaylistChooserSections(request.moveFrom?.jellyfinId);
  const rows = chooserRows(sections.favorites, sections.others, (key) => tf(`chooser.${key}`));
  const actions = useMobileTrackActions();
  // Plusieurs titres (sélection, tout un album) : UN geste groupé — ordre gardé, doublons au choix, une seule playlist créée.
  const bulk = useMobileBulkGestures();
  const many = request.tracks.length > 1 && !request.moveFrom;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (add: (track: ChooserRequest["tracks"][number]) => Promise<boolean>) => {
    if (busy || request.tracks.length === 0) return;
    setBusy(true);
    let added = false;
    for (const track of request.tracks) added = (await add(track)) || added;
    const [first] = request.tracks;
    if (added && request.moveFrom && first) await actions.removeFromPlaylist(first, request.moveFrom);
    setBusy(false);
    if (added) closePlaylistChooser();
  };
  const runMany = async (go: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    const added = await go();
    setBusy(false);
    if (added) closePlaylistChooser();
  };
  const pick = (playlist: MusicPlaylist) =>
    void (many ? runMany(() => bulk.addToPlaylist(request.tracks, playlist)) : run((track) => actions.addToPlaylist(track, playlist)));
  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void (many ? runMany(() => bulk.createPlaylistAndAdd(request.tracks, trimmed)) : run((track) => actions.createPlaylistAndAdd(track, trimmed)));
  };
  return (
    <View style={styles.body}>
      <View style={styles.newRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={create}
          placeholder={t("playlist.newPlaceholder")}
          placeholderTextColor={theme.colors.text.quaternary}
          maxLength={200}
          returnKeyType="done"
          accessibilityLabel={t("playlist.namePlaceholder")}
          style={[typography.body, styles.input, { color: theme.colors.text.primary, backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}
        />
        <Pressable
          onPress={create}
          disabled={!name.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel={t("playlist.create")}
          style={[styles.create, { opacity: !name.trim() || busy ? 0.5 : 1 }]}
        >
          <OctaveBrandFill radius={12} />
          <Plus size={18} color={theme.colors.cta.brandFg} />
        </Pressable>
      </View>
      {sections.pending ? <ActivityIndicator color={accentTextOf(theme)} style={{ marginTop: 24 }} /> : null}
      {!sections.pending && sections.empty ? <Text style={[typography.caption, styles.none, { color: theme.colors.text.tertiary }]}>{t("playlist.none")}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === "title" ? `title:${row.label}` : row.playlist.jellyfinId)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: row }) => {
          if (row.type === "title") {
            return (
              <Text accessibilityRole="header" style={[typography.caption, styles.section, { color: theme.colors.text.tertiary }]}>
                {row.label}
              </Text>
            );
          }
          const item = row.playlist;
          return (
            <Pressable
              onPress={() => pick(item)}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
            >
              <LibraryPlaylistArtwork playlist={item} size={44} radius={6} />
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
                  {item.name}
                </Text>
                <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("count.tracks", { count: item.trackCount })}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

export function PlaylistChooserSheet() {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const request = useSyncExternalStore(subscribeChooser, chooserSnapshot, chooserSnapshot);
  const [first] = request?.tracks ?? [];
  const title = !request
    ? ""
    : request.tracks.length > 1
      ? t("selection.chooseTitle", { count: request.tracks.length })
      : t(request.moveFrom ? "playlist.moveTitle" : "playlist.chooseTitle", { title: first?.title ?? "" });
  return (
    <BottomSheet
      visible={request !== null}
      onClose={closePlaylistChooser}
      snapPoints={[0.6, 0.92]}
      avoidKeyboard
      header={<Text style={[typography.subtitle, styles.title, { color: theme.colors.text.primary }]} numberOfLines={2}>{title}</Text>}
    >
      {request ? <Chooser request={request} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 20, paddingBottom: 12 },
  body: { flex: 1, paddingHorizontal: 12 },
  newRow: { flexDirection: "row", gap: 8, paddingHorizontal: 8, marginBottom: 8 },
  input: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  create: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  none: { paddingHorizontal: 12, paddingVertical: 12 },
  section: { paddingHorizontal: 8, paddingTop: 14, paddingBottom: 6, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, borderRadius: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});
