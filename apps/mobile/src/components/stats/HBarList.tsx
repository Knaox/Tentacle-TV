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
}

interface HBarListProps {
  items: HBarItem[];
  /** Couleur de remplissage : la marque par défaut (une seule série). */
  color?: string;
  /** Bout d'échelle ; par défaut la plus grande valeur. */
  max?: number;
}

/**
 * Barres horizontales d'une seule série (genres, langues, décennies,
 * écrans) : fines, arrondies au bout de la donnée, la valeur écrite en
 * toutes lettres — la liste se lit sans toucher et sans couleur. Chaque
 * ligne est un seul élément pour le lecteur d'écran (« Drame, 32 % »).
 */
export const HBarList = memo(function HBarList({ items, color, max }: HBarListProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const fill = color ?? theme.colors.brand.violet;
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <View style={st.list}>
      {items.map((item) => {
        const ratio = top > 0 ? Math.max(0.02, Math.min(1, item.value / top)) : 0;
        return (
          <View
            key={item.key}
            accessible
            accessibilityLabel={[item.label, item.display, item.secondary].filter(Boolean).join(", ")}
          >
            <View style={st.row}>
              <View style={st.labelBox}>
                {item.icon}
                <Text style={st.label} numberOfLines={1}>{item.label}</Text>
              </View>
              <Text style={st.value}>
                {item.display}
                {item.secondary ? <Text style={st.secondary}>{`  ${item.secondary}`}</Text> : null}
              </Text>
            </View>
            <View style={st.track}>
              <View style={[st.fill, { width: `${ratio * 100}%`, backgroundColor: fill }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { gap: 12 },
    row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 },
    labelBox: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
    label: { flexShrink: 1, fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    value: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, fontVariant: ["tabular-nums"] },
    secondary: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    track: { height: 8, borderTopRightRadius: 4, borderBottomRightRadius: 4, overflow: "hidden", backgroundColor: t.colors.fill.soft },
    fill: { height: "100%", borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  });
