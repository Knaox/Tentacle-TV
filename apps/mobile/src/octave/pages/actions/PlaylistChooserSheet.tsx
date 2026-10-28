/**
 * Octave mobile — choisir une playlist pour un titre, ou en CRÉER une (« Nouvelle
 * playlist… » : un nom, puis le titre y entre aussitôt). La demande vient du
 * magasin commun (`openPlaylistChooser`, api-client : la feuille d'un titre,
 * « Changer » d'un avis) ; les gestes sont ceux du bureau. Seules les playlists
 * modifiables se proposent.
 */

import { useState, useSyncExternalStore } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react-native";
import { chooserSnapshot, closePlaylistChooser, subscribeChooser, useMusicPlaylists, type ChooserRequest } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useMobileTrackActions } from "../env/useMobileActionsUi";
import { Artwork } from "../ui/Artwork";
import { accentTextOf } from "../ui/pageStyle";
import { OctaveBrandFill } from "../../layout/OctaveBrandFill";

function Chooser({ request }: { request: ChooserRequest }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const playlists = useMusicPlaylists();
  const actions = useMobileTrackActions();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = (playlists.data ?? []).filter((p) => p.editable && p.jellyfinId !== request.moveFrom?.jellyfinId);
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
  const pick = (playlist: MusicPlaylist) => void run((track) => actions.addToPlaylist(track, playlist));
  const create = () => {
    const trimmed = name.trim();
    if (trimmed) void run((track) => actions.createPlaylistAndAdd(track, trimmed));
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
      {playlists.isPending ? <ActivityIndicator color={accentTextOf(theme)} style={{ marginTop: 24 }} /> : null}
      {!playlists.isPending && editable.length === 0 ? <Text style={[typography.caption, styles.none, { color: theme.colors.text.tertiary }]}>{t("playlist.none")}</Text> : null}
      <FlatList
        data={editable}
        keyExtractor={(p) => p.jellyfinId}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => pick(item)}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
          >
            <Artwork url={item.artworkUrl} size={44} radius={6} />
            <View style={styles.rowText}>
              <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
                {item.name}
              </Text>
              <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("count.tracks", { count: item.trackCount })}</Text>
            </View>
          </Pressable>
        )}
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
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, borderRadius: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});
