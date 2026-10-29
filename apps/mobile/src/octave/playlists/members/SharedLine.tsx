/**
 * Octave mobile — sous le titre d'une playlist partagée : la pile d'avatars et, en mots, « Partagée par X · vous
 * pouvez y ajouter des titres » (un membre) ou « Partagée avec A, B » (le propriétaire). Un appui ouvre la feuille
 * des personnes. Rien sans partage ni capacité. Le pendant de `SharedPlaylistLine` du bureau.
 */

import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react-native";
import { usePlaylistSharingRules } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { openPlaylistSheet } from "../sheets/playlistSheetStore";
import { PeopleStack } from "./SharedMark";

export function SharedLine({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const theme = useTheme();
  const rules = usePlaylistSharingRules(playlist);
  const sharing = rules.sharing;
  if (!rules.isShared || !sharing) return null;
  const text =
    sharing.role === "member"
      ? `${t("sharedBy", { name: sharing.owner.name })} · ${t(`yourRight.${sharing.right === "owner" ? "remove" : sharing.right}`)}`
      : t("sharedWith", { names: rules.people.map((p) => p.name).join(", ") });
  return (
    <Pressable
      onPress={() => openPlaylistSheet({ kind: "members", playlist })}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={({ pressed }) => [styles.line, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Users size={16} color={theme.colors.brand.accentLight} />
      <PeopleStack people={rules.people} size={22} max={4} />
      <Text numberOfLines={1} style={[typography.caption, styles.text, { color: theme.colors.text.secondary }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20 },
  text: { flexShrink: 1 },
});
