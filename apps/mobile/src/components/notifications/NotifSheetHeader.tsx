import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

type Tone = "brand" | "danger" | "neutral";

/** Une action du panneau : pastille de 36 pt, icône et texte (les liens de 11 pt d'avant faisaient ~30 pt). */
function Action({ icon, label, tone, disabled, onPress }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  tone: Tone;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const color = disabled
    ? theme.colors.text.quaternary
    : tone === "brand" ? theme.colors.brand.light : tone === "danger" ? theme.colors.status.error : theme.colors.text.secondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [st.action, pressed && st.pressed]}
    >
      <Feather name={icon} size={14} color={color} />
      <Text style={[st.actionText, { color }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/**
 * L'en-tête du panneau des notifications : le titre (ou le compte
 * sélectionné) et, à sa droite comme dans Mail, « Sélectionner » — l'appui
 * long le faisait déjà, sans que rien ne le dise — ou « Annuler ». Dessous, en
 * pastilles, « Tout marquer lu » et « Tout supprimer », ou « Supprimer » en
 * sélection. Une ligne d'indice rappelle le balayage vers la gauche.
 */
export function NotifSheetHeader({ selectionMode, selectedCount, unread, total, onMarkAll, onSelect, onDeleteAll, onDeleteSelected, onCancel }: {
  selectionMode: boolean;
  selectedCount: number;
  unread: number;
  total: number;
  onMarkAll: () => void;
  onSelect: () => void;
  onDeleteAll: () => void;
  onDeleteSelected: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("notifications");
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.wrap}>
      <View style={st.titleRow}>
        <Text style={st.title} accessibilityRole="header" numberOfLines={1}>
          {selectionMode ? t("selected", { count: selectedCount }) : t("title")}
        </Text>
        {(selectionMode || total > 0) && (
          <Pressable onPress={selectionMode ? onCancel : onSelect} hitSlop={8} style={st.textButton} accessibilityRole="button">
            <Text style={st.textButtonLabel}>{selectionMode ? t("cancel") : t("select")}</Text>
          </Pressable>
        )}
      </View>
      {(selectionMode || total > 0) && (
        <View style={st.actions}>
          {selectionMode ? (
            <Action icon="trash-2" label={selectedCount > 0 ? `${t("delete")} (${selectedCount})` : t("delete")} tone="danger" disabled={selectedCount === 0} onPress={onDeleteSelected} />
          ) : (
            <>
              {unread > 0 && <Action icon="check-circle" label={t("markAllRead")} tone="brand" onPress={onMarkAll} />}
              <Action icon="trash-2" label={t("deleteAll")} tone="danger" onPress={onDeleteAll} />
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
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    titleRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: spacing.md },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, flexShrink: 1 },
    textButton: { minHeight: 40, justifyContent: "center" as const, paddingHorizontal: 4 },
    textButtonLabel: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.sm },
    action: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    pressed: { opacity: 0.75 },
    actionText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold },
    hint: { ...typography.badge, fontSize: 11.5, color: t.colors.text.quaternary },
  });
