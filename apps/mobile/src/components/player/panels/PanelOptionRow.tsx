import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { PANEL, PANEL_ROW_MIN, PANEL_TYPE } from "./panelTokens";

export interface PanelOption {
  key: string | number;
  title: string;
  /** La ligne de détail sous le titre (langue, format, résolution). */
  detail?: string;
  /** Les étiquettes du format (Dolby Vision, HDR, Atmos), cerclées comme dans l'app TV d'Apple. */
  tags?: readonly string[];
  /** Le texte gris en bout de ligne (débit, « Auto »). */
  trailing?: string;
  selected: boolean;
}

interface Props {
  option: PanelOption;
  onPress: () => void;
  /** Le séparateur d'un cheveu au-dessus (jamais sur la première ligne d'une section). */
  separated: boolean;
}

/**
 * Une ligne de menu d'iOS : la coche EN TÊTE dans sa colonne réservée (rien
 * ne bouge quand le choix change), le titre en blanc, le détail en gris
 * dessous. Le choix courant se lit par la coche et la graisse, jamais par une
 * couleur seule.
 */
export const PanelOptionRow = memo(function PanelOptionRow({ option, onPress, separated }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: option.selected }}
      accessibilityLabel={[option.title, option.detail, option.trailing].filter(Boolean).join(", ")}
      style={({ pressed }) => [st.row, pressed && st.pressed]}
    >
      {separated && <View style={st.separator} />}
      <View style={st.check}>
        {option.selected && <Check size={18} strokeWidth={2.6} color={PANEL.label} />}
      </View>
      <View style={st.body}>
        <View style={st.titleLine}>
          <Text numberOfLines={1} style={[st.title, option.selected && st.titleSelected]}>{option.title}</Text>
          {option.tags?.map((tag) => (
            <Text key={tag} style={st.tag}>{tag}</Text>
          ))}
        </View>
        {option.detail ? <Text numberOfLines={1} style={st.detail}>{option.detail}</Text> : null}
      </View>
      {option.trailing ? <Text style={st.trailing}>{option.trailing}</Text> : null}
    </Pressable>
  );
});

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: PANEL_ROW_MIN, paddingVertical: 9, paddingRight: 18 },
  pressed: { backgroundColor: PANEL.pressed },
  separator: { position: "absolute", top: 0, left: 46, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: PANEL.separator },
  check: { width: 46, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flexShrink: 1, color: PANEL.label, fontSize: PANEL_TYPE.body },
  titleSelected: { fontWeight: "600" },
  detail: { color: PANEL.secondary, fontSize: PANEL_TYPE.detail },
  tag: {
    color: PANEL.secondary, fontSize: 10, fontWeight: "700", letterSpacing: 0.3,
    borderWidth: 1, borderColor: PANEL.tertiary, borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 0.5, overflow: "hidden",
  },
  trailing: { color: PANEL.secondary, fontSize: PANEL_TYPE.detail, fontVariant: ["tabular-nums"], marginLeft: 12 },
});
