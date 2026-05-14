import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { SharedWatchlistMember, SharedWatchlistSummary } from "@tentacle-tv/api-client";
import {
  colors,
  spacing,
  typography,
  BRAND,
  BORDER,
  FONT_FAMILY,
  STATUS,
  SURFACE,
} from "@/theme";

interface Props {
  list: SharedWatchlistSummary | undefined;
  members: SharedWatchlistMember[] | undefined;
  itemCount: number;
  /** Hôte courant (sélection multiple actif) — masque les actions secondaires. */
  selectionActive: boolean;
  showSelectionToggle: boolean;
  onBack: () => void;
  onEnterSelection: () => void;
  onOpenMembers: () => void;
  onDeleteList: () => void;
}

const AVATAR_COLORS = [
  "rgba(139, 92, 246, 0.55)",
  "rgba(236, 72, 153, 0.55)",
  "rgba(59, 130, 246, 0.55)",
  "rgba(245, 158, 11, 0.55)",
  "rgba(16, 185, 129, 0.55)",
];

function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Header polished pour SharedWatchlistDetailScreen :
 *  - back + titre Inter ExtraBold + role badge subtle
 *  - actions icon buttons (sélection / membres / delete) — pill 44pt
 *  - row members horizontal scroll : avatars circulaires + count item/membres
 */
export function SharedHeader({
  list,
  members,
  itemCount,
  selectionActive,
  showSelectionToggle,
  onBack,
  onEnterSelection,
  onOpenMembers,
  onDeleteList,
}: Props) {
  const { t } = useTranslation("common");
  const isCreator = list?.myRole === "creator";

  const roleColor = list
    ? list.myRole === "creator"
      ? BRAND.light
      : list.myRole === "contributor"
      ? STATUS.rating
      : colors.textMuted
    : colors.textMuted;

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          hitSlop={6}
        >
          <Feather name="chevron-left" size={22} color="#fff" />
        </Pressable>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {list?.name ?? "..."}
          </Text>
          {list && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {t("memberCount", { count: list.memberCount })}
              {"  ·  "}
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </Text>
          )}
        </View>

        <View style={styles.actionsRow}>
          {showSelectionToggle && !selectionActive && (
            <Pressable
              onPress={onEnterSelection}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t("selectAll")}
              hitSlop={6}
            >
              <Feather name="check-square" size={18} color={BRAND.light} />
            </Pressable>
          )}
          {isCreator && (
            <Pressable
              onPress={onOpenMembers}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t("manageMembers")}
              hitSlop={6}
            >
              <Feather name="users" size={18} color={BRAND.light} />
            </Pressable>
          )}
          {isCreator && (
            <Pressable
              onPress={onDeleteList}
              style={[styles.iconBtn, styles.iconBtnDanger]}
              accessibilityRole="button"
              accessibilityLabel={t("deleteList")}
              hitSlop={6}
            >
              <Feather name="trash-2" size={18} color={colors.danger} />
            </Pressable>
          )}
        </View>
      </View>

      {list && (
        <View style={styles.metaRow}>
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}1A`, borderColor: `${roleColor}33` }]}>
            <Text style={[styles.roleBadgeTxt, { color: roleColor }]}>{t(list.myRole)}</Text>
          </View>
          {members && members.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersRow}
            >
              {members.slice(0, 8).map((m, idx) => (
                <View
                  key={m.id}
                  style={[
                    styles.avatar,
                    { backgroundColor: avatarColorFor(m.username), marginLeft: idx === 0 ? 0 : -10 },
                  ]}
                  accessibilityLabel={m.username}
                >
                  <Text style={styles.avatarTxt}>{m.username.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
              {members.length > 8 && (
                <View style={[styles.avatar, styles.avatarMore]}>
                  <Text style={styles.avatarMoreTxt}>+{members.length - 8}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.md },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SURFACE.s1,
    borderWidth: 1,
    borderColor: BORDER.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: { borderColor: "rgba(239,68,68,0.25)" },
  titleBlock: { flex: 1, marginHorizontal: spacing.xs },
  title: { fontSize: 24, fontFamily: FONT_FAMILY.extrabold, color: colors.textPrimary, letterSpacing: -0.6 },
  subtitle: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: BRAND.light, marginTop: 2, letterSpacing: 0.2 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.md },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeTxt: { fontFamily: FONT_FAMILY.bold, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" as const },
  membersRow: { flexDirection: "row", alignItems: "center", paddingRight: spacing.md },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: SURFACE.s0,
  },
  avatarTxt: { fontFamily: FONT_FAMILY.bold, fontSize: 12, color: "#fff", letterSpacing: -0.2 },
  avatarMore: { backgroundColor: SURFACE.s2, borderColor: BORDER.subtle, marginLeft: -10 },
  avatarMoreTxt: { fontFamily: FONT_FAMILY.bold, fontSize: 10, color: colors.textMuted },
});
