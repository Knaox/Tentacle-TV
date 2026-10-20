import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NotificationFilter } from "@tentacle-tv/api-client";
import { IconButton, PlainButton } from "@/components/ui/buttons";
import { FONT_FAMILY, spacing, typography, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  filter: NotificationFilter;
  onFilter: (filter: NotificationFilter) => void;
  unread: number;
  total: number;
  selectionMode: boolean;
  selectedCount: number;
  onMarkAll: () => void;
  onMore: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onCancelSelection: () => void;
  onClose: () => void;
}

/**
 * L'en-tête du centre — fixe, il prend aussi le glissement de la feuille :
 * le titre et le nombre de non lues, « Tout marquer comme lu », un menu
 * (sélectionner, tout supprimer) et la croix ; dessous, les filtres « Tout »
 * et « Non lues ». En sélection : le compte, tout (dé)sélectionner,
 * supprimer, annuler. Boutons sobres du système de boutons.
 */
export const NotifCenterHeader = memo(function NotifCenterHeader(p: Props) {
  const { t } = useTranslation("notifications");
  const { t: tc } = useTranslation("common");
  const st = useThemedStyles(makeStyles);

  if (p.selectionMode) {
    return (
      <View style={st.wrap}>
        <View style={st.row}>
          <Text style={st.title} accessibilityRole="header" numberOfLines={1}>{t("selected", { count: p.selectedCount })}</Text>
          <PlainButton size="sm" label={t("cancel")} onPress={p.onCancelSelection} />
        </View>
        <View style={st.actions}>
          <PlainButton size="sm" icon="check-square" label={p.selectedCount === p.total ? t("deselectAll") : t("selectAll")} onPress={p.onSelectAll} />
          <PlainButton
            size="sm"
            tone="destructive"
            icon="trash-2"
            label={p.selectedCount > 0 ? `${t("delete")} (${p.selectedCount})` : t("delete")}
            disabled={p.selectedCount === 0}
            onPress={p.onDeleteSelected}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={st.wrap}>
      <View style={st.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.title} accessibilityRole="header" numberOfLines={1}>{t("title")}</Text>
          <Text style={st.subtitle} numberOfLines={1}>{p.unread > 0 ? t("unreadCount", { count: p.unread }) : t("emptyUnreadTitle")}</Text>
        </View>
        {p.total > 0 && <IconButton icon="more-horizontal" variant="plain" onPress={p.onMore} accessibilityLabel={t("moreActions")} />}
        <IconButton icon="x" variant="plain" onPress={p.onClose} accessibilityLabel={tc("close")} />
      </View>
      <View style={st.row}>
        <View style={st.segments} accessibilityRole="tablist" accessibilityLabel={t("filtersA11y")}>
          <Segment label={t("filterAll")} active={p.filter === "all"} onPress={() => p.onFilter("all")} />
          <Segment label={p.unread > 0 ? `${t("filterUnread")} · ${p.unread}` : t("filterUnread")} active={p.filter === "unread"} onPress={() => p.onFilter("unread")} />
        </View>
        {p.unread > 0 && <PlainButton size="sm" tone="accent" icon="check-circle" label={t("markAllReadFull")} onPress={p.onMarkAll} />}
      </View>
    </View>
  );
});

/** Un filtre : une pastille, appuyée quand elle est active (texte ET fond, jamais la couleur seule). */
function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [st.segment, active && st.segmentActive, pressed && { opacity: 0.75 }]}
    >
      <Text style={[st.segmentText, active && st.segmentTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: 10,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    subtitle: { ...typography.caption, color: t.colors.text.tertiary, marginTop: 1 },
    actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginLeft: -8 },
    segments: { flexDirection: "row", gap: 6, flex: 1 },
    segment: {
      minHeight: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center",
      backgroundColor: t.colors.fill.subtle, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
    },
    segmentActive: { backgroundColor: t.colors.brand.soft, borderColor: t.colors.brand.violet },
    segmentText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    segmentTextActive: { color: t.colors.text.primary },
  });
