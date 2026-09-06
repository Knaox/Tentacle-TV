import { memo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { FONT_FAMILY, RADIUS, useThemedStyles, type AppTheme } from "@/theme";

const TMDB_LOGO = "https://image.tmdb.org/t/p/w92";
const SIZE = 28;

interface Props {
  logoPath: string | null;
  label: string;
}

/** Le logo TMDB d'une plateforme ; sans logo ou image cassée, un monogramme
 *  (initiale) — jamais d'icône cassée, jamais de case vide. */
export const PlatformLogo = memo(function PlatformLogo({ logoPath, label }: Props) {
  const st = useThemedStyles(makeStyles);
  const [broken, setBroken] = useState(false);
  if (logoPath && !broken) {
    return (
      <Image
        source={{ uri: `${TMDB_LOGO}${logoPath}` }}
        style={st.logo}
        contentFit="cover"
        transition={150}
        onError={() => setBroken(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[st.logo, st.mono]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={st.monoTxt}>{label.charAt(0)}</Text>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  logo: { width: SIZE, height: SIZE, borderRadius: RADIUS.sm, backgroundColor: t.colors.fill.soft },
  mono: { alignItems: "center" as const, justifyContent: "center" as const },
  monoTxt: { fontSize: 12, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
});
