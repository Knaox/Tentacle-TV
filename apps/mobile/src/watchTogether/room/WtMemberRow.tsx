import { memo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Hourglass, UserMinus } from "lucide-react-native";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { WtMemberRowModel, WtMemberStatus } from "@tentacle-tv/shared";

const AVATAR = 40;

/** La couleur du point d'état — toujours doublée du mot qui le dit. */
function stateColor(theme: AppTheme, state: WtMemberStatus): string {
  switch (state) {
    case "error": return theme.colors.status.error;
    case "buffering": return theme.colors.status.warning;
    case "watching": return theme.colors.status.success;
    case "none": return theme.colors.brand.light;
    default: return theme.colors.text.quaternary;
  }
}

/**
 * Une ligne de la feuille du groupe : avatar cerclé de son état, nom,
 * « Hôte » / « Vous », l'état en mots ; l'hôte expulse par le bouton de bout
 * de ligne (44 pt). Même gabarit que les lignes du web (`RoomMemberRow`).
 */
export const WtMemberRow = memo(function WtMemberRow({ row, onKick }: {
  row: WtMemberRowModel;
  onKick: (userId: string) => Promise<void>;
}) {
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const [kicking, setKicking] = useState(false);
  const { member, isSelf, status: state, labelKey, canKick } = row;
  const label = t(labelKey);

  const kick = (): void => {
    setKicking(true);
    onKick(member.userId).catch(() => setKicking(false));
  };

  return (
    <View
      style={s.row}
      accessible
      accessibilityLabel={`${member.username}${isSelf ? `, ${t("you")}` : ""}${member.isHost ? `, ${t("host")}` : ""}, ${label}`}
      testID={`wt-member-${member.userId}`}
    >
      <View style={[s.ring, { borderColor: stateColor(theme, state) }]}>
        <UserAvatar userId={member.userId} name={member.username} hasAvatar={member.hasAvatar} size={AVATAR} />
      </View>
      <View style={s.text}>
        <View style={s.nameLine}>
          <Text style={s.name} numberOfLines={1}>{member.username}</Text>
          {isSelf && <Text style={s.chip}>{t("you")}</Text>}
          {member.isHost && <Text style={[s.chip, s.hostChip]}>{t("host")}</Text>}
        </View>
        <View style={s.stateLine}>
          <View style={[s.dot, { backgroundColor: stateColor(theme, state) }]} />
          <Text style={s.state} numberOfLines={1}>{label}</Text>
        </View>
      </View>
      {canKick && (
        <Pressable
          onPress={kick}
          disabled={kicking}
          accessibilityRole="button"
          accessibilityLabel={`${t("kick")} — ${member.username}`}
          style={({ pressed }) => [s.kick, pressed && s.kickPressed]}
          testID={`wt-kick-${member.userId}`}
        >
          {kicking
            ? <ActivityIndicator size="small" color={theme.colors.text.tertiary} />
            : <UserMinus size={20} color={theme.colors.text.tertiary} />}
        </Pressable>
      )}
    </View>
  );
});

/** Une personne invitée qui n'a pas répondu : en retrait, un sablier IMMOBILE. */
export const WtPendingInviteRow = memo(function WtPendingInviteRow({ userId, username, hasAvatar }: {
  userId: string;
  username: string;
  hasAvatar: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.row} accessible accessibilityLabel={`${username}, ${t("invitePending")}`}>
      <View style={[s.ring, s.pending]}>
        <UserAvatar userId={userId} name={username} hasAvatar={hasAvatar} size={AVATAR} />
      </View>
      <View style={s.text}>
        <Text style={[s.name, s.pendingName]} numberOfLines={1}>{username}</Text>
        <View style={s.stateLine}>
          <Hourglass size={12} color={theme.colors.brand.light} />
          <Text style={s.state} numberOfLines={1}>{t("invitePending")}</Text>
        </View>
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8 },
  ring: { borderWidth: 2, borderRadius: (AVATAR + 6) / 2, padding: 1 },
  pending: { borderColor: "transparent", opacity: 0.6 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, color: t.colors.text.primary, fontSize: 16, fontFamily: FONT_FAMILY.semibold },
  pendingName: { color: t.colors.text.secondary },
  chip: {
    overflow: "hidden", paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill,
    backgroundColor: t.colors.fill.soft, color: t.colors.text.secondary, fontSize: 11, fontFamily: FONT_FAMILY.semibold,
  },
  hostChip: { backgroundColor: t.colors.brand.ghost, color: t.colors.brand.light },
  stateLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  state: { color: t.colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular },
  kick: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  kickPressed: { backgroundColor: t.colors.danger.surface },
});
