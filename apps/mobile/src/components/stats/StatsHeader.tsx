import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONT_FAMILY, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** La place du retour flottant, au-dessus du titre. */
const BACK_ROOM = 56;

/**
 * L'en-tête de « Vos statistiques » — celui du web : le surtitre et le titre,
 * aux couleurs de l'app. Aucune image : l'écran prenait la teinte de
 * l'affiche du titre le plus regardé (le vert d'une forêt chez qui regarde
 * « Dark ») ; l'ambiance de marque vient désormais du fond de l'écran
 * (`SubtleBackground ambient`), la même pour tout le monde.
 */
export const StatsHeader = memo(function StatsHeader({ title, kicker, topInset, inset, action }: {
  title: string;
  kicker: string;
  topInset: number;
  inset: number;
  /** Un geste secondaire sous le titre : « Partager ». */
  action?: ReactNode;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.header, { paddingTop: topInset + BACK_ROOM, paddingHorizontal: inset }]}>
      <View style={st.kickerRow}>
        <LinearGradient colors={[theme.colors.brand.light, theme.colors.brand.accent]} style={st.rail} />
        <Text style={st.kicker}>{kicker}</Text>
      </View>
      <Text style={st.title} accessibilityRole="header">{title}</Text>
      {action && <View style={st.action}>{action}</View>}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: { paddingBottom: spacing.xl },
    kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    rail: { width: 3, height: 14, borderRadius: 2 },
    kicker: { fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
    title: { marginTop: 6, fontSize: 34, lineHeight: 40, letterSpacing: -0.6, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    action: { marginTop: spacing.md },
  });
