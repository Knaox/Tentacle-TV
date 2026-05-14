import { useCallback, useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import {
  useCreateSharedWatchlist,
  useDeleteSharedWatchlist,
  type SharedWatchlistSummary,
} from "@tentacle-tv/api-client";
import {
  colors,
  spacing,
  typography,
  BRAND,
  BORDER,
  CTA,
  FONT_FAMILY,
  RADIUS,
  SHADOW_RN,
  STATUS,
  SURFACE,
} from "@/theme";

interface Props {
  lists: SharedWatchlistSummary[];
  onPressList: (id: string) => void;
}

/**
 * Section "Listes partagées" du WatchlistScreen. Pattern Inter ExtraBold pour
 * le titre, cards s2 avec halo subtle, accent violet sur les actions, badge
 * de rôle stylé. Création inline avec TextInput dans une glass row.
 */
export function SharedListsSection({ lists, onPressList }: Props) {
  const { t } = useTranslation("common");
  const createList = useCreateSharedWatchlist();
  const deleteList = useDeleteSharedWatchlist();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await createList.mutateAsync({ name: newName.trim() });
    setNewName("");
    setShowCreate(false);
  }, [newName, createList]);

  const handleDeleteList = useCallback(
    (list: SharedWatchlistSummary) => {
      Alert.alert(t("deleteList"), t("confirmDeleteList"), [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => {
            void deleteList.mutateAsync(list.id);
          },
        },
      ]);
    },
    [t, deleteList],
  );

  if (lists.length === 0 && !showCreate) {
    return (
      <View style={styles.wrap}>
        <View style={styles.divider} />
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{t("sharedLists")}</Text>
          <View style={styles.sectionAccent} />
        </View>
        <CreateButton onPress={() => setShowCreate(true)} label={t("createSharedList")} />
      </View>
    );
  }

  const roleColor = (role: string): string => {
    if (role === "creator") return BRAND.light;
    if (role === "contributor") return STATUS.rating;
    return colors.textMuted;
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.divider} />
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{t("sharedLists")}</Text>
        <View style={styles.sectionAccent} />
      </View>

      {lists.map((list) => {
        const color = roleColor(list.myRole);
        return (
          <Pressable
            key={list.id}
            onPress={() => onPressList(list.id)}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={list.name}
          >
            <View style={styles.iconBubble}>
              <Feather name="list" size={18} color={BRAND.light} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{list.name}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {list.itemCount} {list.itemCount === 1 ? "item" : "items"}
                {"  ·  "}
                {t("memberCount", { count: list.memberCount })}
              </Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: `${color}1A`, borderColor: `${color}33` }]}>
              <Text style={[styles.roleBadgeTxt, { color }]}>{t(list.myRole)}</Text>
            </View>
            {list.myRole === "creator" && (
              <Pressable
                onPress={() => handleDeleteList(list)}
                hitSlop={12}
                style={styles.iconAction}
                accessibilityRole="button"
                accessibilityLabel={t("deleteList")}
              >
                <Feather name="trash-2" size={16} color={colors.danger} />
              </Pressable>
            )}
          </Pressable>
        );
      })}

      {showCreate ? (
        <View style={styles.createRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder={t("listNamePlaceholder")}
            placeholderTextColor={colors.textDim}
            autoFocus
            style={styles.input}
          />
          <Pressable
            onPress={handleCreate}
            disabled={!newName.trim() || createList.isPending}
            style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel={t("createSharedList")}
          >
            {createList.isPending ? (
              <ActivityIndicator size="small" color={CTA.primaryFg} />
            ) : (
              <Feather name="check" size={20} color={newName.trim() ? CTA.primaryFg : "rgba(0,0,0,0.35)"} />
            )}
          </Pressable>
          <Pressable
            onPress={() => { setShowCreate(false); setNewName(""); }}
            style={styles.cancelBtn}
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
          >
            <Feather name="x" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <CreateButton onPress={() => setShowCreate(true)} label={t("createSharedList")} />
      )}
    </View>
  );
}

function CreateButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.createBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name="plus" size={16} color={BRAND.light} />
      <Text style={styles.createBtnTxt}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, paddingHorizontal: spacing.screenPadding },
  divider: { height: 1, backgroundColor: BORDER.subtle, marginBottom: spacing.lg, opacity: 0.7 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionAccent: { flex: 1, height: 1, backgroundColor: "rgba(139, 92, 246, 0.18)" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE.s1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: BORDER.subtle,
    ...SHADOW_RN.elev2,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND.soft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
  },
  rowTitle: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: colors.textPrimary, letterSpacing: -0.1 },
  rowMeta: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: colors.textMuted, marginTop: 2 },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: spacing.sm,
  },
  roleBadgeTxt: { ...typography.badge, fontFamily: FONT_FAMILY.bold, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" as const },
  iconAction: { marginLeft: spacing.xs, padding: 8, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: BRAND.soft,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    marginTop: spacing.xs,
    minHeight: 44,
  },
  createBtnTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: BRAND.light, letterSpacing: 0.2 },
  createRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  input: {
    flex: 1,
    ...typography.body,
    fontFamily: FONT_FAMILY.regular,
    color: colors.textPrimary,
    backgroundColor: SURFACE.s1,
    borderRadius: RADIUS.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  confirmBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CTA.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND.violet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SURFACE.s1,
    borderWidth: 1,
    borderColor: BORDER.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
});
