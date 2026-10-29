/**
 * Octave mobile — le LOGO d'une playlist partagée entre comptes : le pictogramme « personnes » dans une pastille
 * de marque et la pile des avatars de qui y a accès (propriétaire en tête, « +N » au-delà). Le nom de chacun est
 * dans le libellé d'accessibilité, et en clair dans la feuille « Personnes » (un appui). Rien sans partage ni
 * capacité. Le même rendu que le bureau (`SharedPlaylistBadge`).
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react-native";
import { usePlaylistSharingRules } from "@tentacle-tv/api-client";
import type { MusicPlaylist, MusicPlaylistPerson } from "@tentacle-tv/shared/music";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { useTheme } from "@/theme";

export const PeopleStack = memo(function PeopleStack({ people, size = 22, max = 3 }: { people: readonly MusicPlaylistPerson[]; size?: number; max?: number }) {
  const theme = useTheme();
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  const ring = { borderWidth: 2, borderColor: theme.colors.surface.s0, borderRadius: size / 2 + 2 };
  return (
    <View style={styles.stack} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {shown.map((p, i) => (
        <View key={p.userId} style={[ring, { marginLeft: i === 0 ? 0 : -Math.round(size / 3), zIndex: max - i }]}>
          <UserAvatar userId={p.userId} name={p.name} hasAvatar={p.imageTag !== null} imageTag={p.imageTag || null} size={size} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[ring, styles.more, { width: size + 4, height: size + 4, marginLeft: -Math.round(size / 3), backgroundColor: theme.colors.fill.medium }]}>
          <Text style={{ fontSize: Math.max(10, Math.round(size * 0.42)), fontWeight: "600", color: theme.colors.text.secondary }}>+{more}</Text>
        </View>
      ) : null}
    </View>
  );
});

/** La pastille posée sur une jaquette (cartes) ou au bout d'une rangée (liste). */
export const SharedMark = memo(function SharedMark({ playlist, overlay = false }: { playlist: MusicPlaylist; overlay?: boolean }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const theme = useTheme();
  const rules = usePlaylistSharingRules(playlist);
  if (!rules.isShared) return null;
  const label = t("sharedWith", { names: rules.people.map((p) => p.name).join(", ") });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      // Une encre opaque, aucun flou : lisible sur toute pochette, rien à recomposer.
      style={[styles.mark, overlay && styles.overlay, overlay && { backgroundColor: "rgba(13,11,19,0.88)" }]}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.brand.soft }]}>
        <Users size={12} color={theme.colors.brand.accentLight} />
      </View>
      <PeopleStack people={rules.people} size={20} max={3} />
    </View>
  );
});

const styles = StyleSheet.create({
  stack: { flexDirection: "row", alignItems: "center" },
  more: { alignItems: "center", justifyContent: "center" },
  mark: { flexDirection: "row", alignItems: "center", gap: 6 },
  overlay: { position: "absolute", left: 8, bottom: 8, borderRadius: 16, paddingVertical: 3, paddingLeft: 4, paddingRight: 4 },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
