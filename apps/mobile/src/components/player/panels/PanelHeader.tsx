import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/buttons";
import { PANEL, PANEL_TYPE } from "./panelTokens";

/** L'en-tête d'un panneau du lecteur : son titre, et le rond « fermer » des feuilles d'iOS. */
export function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useTranslation("player");
  return (
    <View style={st.header}>
      <Text accessibilityRole="header" numberOfLines={1} style={st.title}>{title}</Text>
      <IconButton
        icon="x"
        size={30}
        variant="plain"
        color={PANEL.secondary}
        bgColor={PANEL.closeFill}
        onPress={onClose}
        accessibilityLabel={t("close")}
      />
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 18, paddingRight: 12, paddingTop: 14, paddingBottom: 8 },
  title: { flex: 1, color: PANEL.label, fontSize: PANEL_TYPE.title, fontWeight: "600" },
});
