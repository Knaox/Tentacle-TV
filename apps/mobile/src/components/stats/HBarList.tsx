import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  /** La valeur écrite en bout de ligne (« 32 % », « 12 h 40 »). */
  display: string;
  /** Une précision en second (la durée quand `display` est une part). */
  secondary?: string;
  icon?: ReactNode;
  /** « Autres », « inconnue » : une barre neutre, un libellé en retrait — ce n'est pas une catégorie. */
  muted?: boolean;
}

interface HBarListProps {
  items: HBarItem[];
  /** Bout d'échelle ; par défaut la plus grande valeur. */
  max?: number;
}

/**
 * Barres horizontales d'une seule série (genres, pays, langues, décennies,
 * écrans) : UNE teinte, la marque, pour toutes — la longueur dit la
 * grandeur. Fines, arrondies au bout de la donnée, la valeur écrite en
 * toutes lettres : la liste se lit sans toucher et sans couleur. Chaque ligne
 * est un seul élément pour le lecteur d'écran (« Drame, 32 % »).
 */
export const HBarList = memo(function HBarList({ items, max }: HBarListProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <View style={st.list}>
      {items.map((item) => {
        const ratio = top > 0 ? Math.max(0.015, Math.min(1, item.value / top)) : 0;
        return (
          <View
            key={item.key}
            accessible
            accessibilityLabel={[item.label, item.display, item.secondary].filter(Boolean).join(", ")}
          >
            <View style={st.row}>
              <View style={st.labelBox}>
                {item.icon}
                <Text style={[st.label, item.muted && st.labelMuted]} numberOfLines={1}>{item.label}</Text>
              </View>
              <Text style={[st.value, item.muted && st.valueMuted]}>
                {item.display}
                {item.secondary ? <Text style={st.secondary}>{`  ${item.secondary}`}</Text> : null}
              </Text>
            </View>
            <View style={st.track}>
              <View
                style={[st.fill, { width: `${ratio * 100}%`, backgroundColor: item.muted ? theme.colors.fill.strong : theme.colors.brand.violet }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { gap: 14 },
    row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 },
    labelBox: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
    label: { flexShrink: 1, fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    labelMuted: { color: t.colors.text.tertiary },
    value: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, fontVariant: ["tabular-nums"] },
    valueMuted: { color: t.colors.text.secondary },
    secondary: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    track: { height: 6, borderTopRightRadius: 3, borderBottomRightRadius: 3, overflow: "hidden", backgroundColor: t.colors.fill.soft },
    fill: { height: "100%", borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  });
