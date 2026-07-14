import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_LIST = Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => String(CURRENT_YEAR - i));

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedYear: string | null;
  onSelect: (year: string | null) => void;
}

/** BottomSheet "Année" — liste verticale années, scrollable. */
export function YearSheet({ visible, onClose, selectedYear, onSelect }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const choose = (year: string | null) => { onSelect(year); onClose(); };
  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.5, 0.85]}>
      <View style={st.header}>
        <Feather name="calendar" size={18} color={colors.brand.light} />
        <Text style={st.title}>{t("sortYear")}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row label={t("allYears")} active={selectedYear === null} onPress={() => choose(null)} />
        {YEAR_LIST.map((year) => (
          <Row key={year} label={year} active={selectedYear === year} onPress={() => choose(year)} />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

function Row({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={st.row} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <Text style={[st.rowTxt, active && st.rowTxtActive]}>{label}</Text>
      {active && <Feather name="check" size={18} color={colors.brand.violet} />}
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.md },
  title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.md },
  rowTxt: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  rowTxtActive: { color: t.colors.brand.violet, fontFamily: FONT_FAMILY.semibold },
});
