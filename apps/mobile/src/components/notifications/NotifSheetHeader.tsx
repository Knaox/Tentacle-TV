import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PlainButton } from "@/components/ui/buttons";
import { FONT_FAMILY, spacing, typography, useThemedStyles, type AppTheme } from "@/theme";

/**
 * L'en-tête du centre des notifications : le titre (ou le compte
 * sélectionné) et le nombre de non lues ; à sa droite, comme dans Mail,
 * « Sélectionner » — l'appui long le faisait déjà, sans que rien ne le dise —
 * ou « Annuler ». Dessous, des boutons texte (système de boutons du mobile) :
 * « Tout marquer lu » et « Tout supprimer », ou « Tout sélectionner » et
 * « Supprimer » en sélection. Le danger n'est jamais un pavé rouge : un
 * libellé rouge. Une ligne d'indice rappelle le balayage vers la gauche.
 */
export function NotifSheetHeader({ selectionMode, selectedCount, unread, total, onMarkAll, onSelect, onSelectAll, onDeleteAll, onDeleteSelected, onCancel }: {
  selectionMode: boolean;
  selectedCount: number;
  unread: number;
  total: number;
  onMarkAll: () => void;
  onSelect: () => void;
  /** Tout cocher, ou tout décocher quand tout l'est déjà (comme le bureau). */
  onSelectAll: () => void;
  onDeleteAll: () => void;
  onDeleteSelected: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("notifications");
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.wrap}>
      <View style={st.titleRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={st.title} accessibilityRole="header" numberOfLines={1}>
            {selectionMode ? t("selected", { count: selectedCount }) : t("title")}
          </Text>
          {!selectionMode && unread > 0 && <Text style={st.subtitle}>{t("unreadCount", { count: unread })}</Text>}
        </View>
        {(selectionMode || total > 0) && (
          <PlainButton size="sm" tone="accent" label={selectionMode ? t("cancel") : t("select")} onPress={selectionMode ? onCancel : onSelect} />
        )}
      </View>
      {(selectionMode || total > 0) && (
        <View style={st.actions}>
          {selectionMode ? (
            <>
              <PlainButton
                size="sm"
                icon="check-square"
                label={selectedCount === total ? t("deselectAll") : t("selectAll")}
                onPress={onSelectAll}
              />
              <PlainButton
                size="sm"
                tone="destructive"
                icon="trash-2"
                label={selectedCount > 0 ? `${t("delete")} (${selectedCount})` : t("delete")}
                disabled={selectedCount === 0}
                onPress={onDeleteSelected}
              />
            </>
          ) : (
            <>
              {unread > 0 && <PlainButton size="sm" tone="accent" icon="check-circle" label={t("markAllRead")} onPress={onMarkAll} />}
              <PlainButton size="sm" tone="destructive" icon="trash-2" label={t("deleteAll")} onPress={onDeleteAll} />
            </>
          )}
        </View>
      )}
      {!selectionMode && total > 0 && <Text style={st.hint}>{t("swipeHint")}</Text>}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.screenPadding,
      paddingTop: 4,
      paddingBottom: 12,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    titleRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: spacing.md },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, flexShrink: 1 },
    subtitle: { ...typography.caption, color: t.colors.text.tertiary, marginTop: 1 },
    actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: spacing.sm, marginLeft: -8 },
    hint: { ...typography.badge, fontSize: 11.5, color: t.colors.text.quaternary },
  });
