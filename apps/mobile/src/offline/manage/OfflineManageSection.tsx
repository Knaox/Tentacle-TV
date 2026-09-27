import { Children, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, LETTER_SPACING, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  title: string;
  /** « 12 ép. · 18,4 Gio » — l'appelant compose. */
  summary?: string;
  /** Deux colonnes : tablette assez large pour deux lignes côte à côte. */
  columns?: 1 | 2;
  children: ReactNode;
}

/**
 * Une section de « Sur cet appareil » (En cours, Films, une série) : titre,
 * compte et espace occupé, et un repli au toucher de l'en-tête.
 *
 * Replier, parce qu'une série de trois saisons empilait soixante lignes entre
 * les films et la série suivante. L'état replié ne vit que le temps de la
 * visite. Sur tablette, les lignes passent sur deux colonnes : une ligne
 * étirée sur 1 000 pt laissait un trou entre le titre et ses actions.
 */
export function OfflineManageSection({ title, summary, columns = 1, children }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(true);
  const items = Children.toArray(children);

  return (
    <View style={st.section}>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t(open ? "sectionCollapse" : "sectionExpand", { title })}
        hitSlop={6}
        style={st.header}
      >
        <Text style={st.title} numberOfLines={1}>{title}</Text>
        {summary ? <Text style={st.summary} numberOfLines={1}>{summary}</Text> : null}
        <View style={st.rule} />
        <Feather
          name="chevron-down"
          size={16}
          color={colors.text.quaternary}
          style={open ? undefined : st.chevronClosed}
        />
      </Pressable>
      {open && (
        <View style={columns === 2 ? st.grid : st.list}>
          {columns === 2 ? items.map((child, index) => <View key={index} style={st.cell}>{child}</View>) : items}
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: { marginBottom: spacing.xl },
    header: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32, marginBottom: spacing.sm, marginHorizontal: spacing.xs },
    title: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: LETTER_SPACING.wide,
      color: t.colors.text.tertiary,
      textTransform: "uppercase",
      flexShrink: 1,
    },
    summary: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"] },
    rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border.subtle },
    chevronClosed: { transform: [{ rotate: "-90deg" }] },
    list: { gap: 8 },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
    cell: { width: "49.2%" },
  });
