/**
 * Octave mobile — gérer une playlist au doigt : la feuille « Gérer » (renommer, dupliquer, partager si le
 * serveur le sait et que le compte en a le droit, supprimer — en rouge, à part, confirmée) et la feuille d'un
 * NOM (créer une playlist, la renommer) : un champ libellé, « Créer » / « Enregistrer » au clavier aussi.
 * Créée, la playlist s'ouvre.
 */

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Copy, Link2, Pencil, Trash2 } from "lucide-react-native";
import { useCreateMusicPlaylist, useMusicPlaylistShareAvailable } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { showNotice } from "../../pages";
import { SheetAction } from "../../pages/actions/SheetAction";
import { handOffSheet } from "../../pages/actions/sheetHandoff";
import { closePlaylistSheet, openPlaylistSheet } from "./playlistSheetStore";
import { useMobilePlaylistManage } from "./useMobilePlaylistManage";
import { OctavePlayButton } from "../../layout/OctavePlayButton";

const NAME_MAX = 200;

export function ManageSheet({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("musicLists");
  const { t: tm } = useTranslation("music");
  const { t: ts } = useTranslation("musicShare");
  const theme = useTheme();
  const shareable = useMusicPlaylistShareAvailable();
  const manage = useMobilePlaylistManage();
  // La suivante (feuille, confirmation) une fois celle-ci retirée : `handOffSheet`.
  const then = (next: () => void) => () => handOffSheet(closePlaylistSheet, next);
  return (
    <BottomSheet
      visible
      onClose={closePlaylistSheet}
      snapPoints={[0.46, 0.7]}
      header={<Text numberOfLines={2} style={[typography.subtitle, styles.title, { color: theme.colors.text.primary }]}>{playlist.name}</Text>}
    >
      <View style={styles.body}>
        <SheetAction icon={Pencil} label={t("rename")} onPress={then(() => openPlaylistSheet({ kind: "rename", playlist }))} />
        <SheetAction icon={Copy} label={tm("playlistManage.duplicate")} onPress={then(() => void manage.duplicate(playlist))} />
        {shareable ? <SheetAction icon={Link2} label={ts("action")} onPress={then(() => openPlaylistSheet({ kind: "share", playlist }))} /> : null}
        <View style={[styles.separator, { backgroundColor: theme.colors.border.subtle }]} />
        <Pressable
          onPress={then(() => manage.confirmDelete(playlist))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.danger, { backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
        >
          <Trash2 size={20} color={theme.colors.status.error} />
          <Text style={[typography.body, { color: theme.colors.status.error }]}>{tm("playlistManage.delete")}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export function NameSheet({ playlist }: { playlist?: MusicPlaylist }) {
  const { t } = useTranslation("musicLists");
  const { t: tm } = useTranslation("music");
  const theme = useTheme();
  const router = useRouter();
  const manage = useMobilePlaylistManage();
  const { mutateAsync: create } = useCreateMusicPlaylist();
  const [name, setName] = useState(playlist?.name ?? "");
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const changed = trimmed.length > 0 && trimmed !== playlist?.name;
  const submit = async () => {
    if (!changed || busy) return;
    setBusy(true);
    if (playlist) {
      const ok = await manage.saveDetails(playlist, { name: trimmed });
      setBusy(false);
      if (ok) closePlaylistSheet();
      return;
    }
    try {
      const created = await create({ name: trimmed });
      haptic("success");
      closePlaylistSheet();
      router.push(octavePaths.playlist(created.jellyfinId) as never);
    } catch {
      showNotice("error", tm("refusal.failed"), { title: tm("refusal.title") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      visible
      onClose={closePlaylistSheet}
      snapPoints={[0.5, 0.75]}
      header={<Text style={[typography.subtitle, styles.title, { color: theme.colors.text.primary }]}>{playlist ? t("renameTitle") : t("newTitle")}</Text>}
    >
      <View style={styles.form}>
        {!playlist ? <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{t("newHint")}</Text> : null}
        <Text style={[typography.small, { color: theme.colors.text.secondary }]}>{tm("playlistManage.nameLabel")}</Text>
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => void submit()}
          maxLength={NAME_MAX}
          returnKeyType="done"
          placeholder={tm("playlist.namePlaceholder")}
          placeholderTextColor={theme.colors.text.quaternary}
          accessibilityLabel={tm("playlistManage.nameLabel")}
          style={[typography.body, styles.input, { color: theme.colors.text.primary, backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}
        />
        <OctavePlayButton label={playlist ? tm("playlistManage.save") : tm("playlist.create")} Icon={null} onPress={() => void submit()} disabled={!changed || busy} style={styles.primary} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 20, paddingBottom: 8 },
  body: { paddingHorizontal: 8, paddingBottom: 24 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginVertical: 6 },
  danger: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, borderRadius: 12 },
  form: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  primary: { marginTop: 6 },
});
