import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FadeIn } from "@/components/ui";
import { useTheme, withAlpha } from "@/theme";

/** Le médaillon de l'écran de jumelage : une TV dans un halo de la marque. */
export function PairTvMedallion() {
  const theme = useTheme();
  return (
    <FadeIn delay={0} translateY={10} style={{ alignItems: "center", marginTop: 8, marginBottom: 16 }}>
      <View style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: theme.colors.brand.soft,
        borderWidth: 1,
        borderColor: withAlpha(theme.colors.brand.violet, 0.4, theme.colors.brand.glow),
        justifyContent: "center",
        alignItems: "center",
        shadowColor: theme.colors.brand.violet,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
      }}>
        <Feather name="tv" size={48} color={theme.colors.brand.light} />
      </View>
    </FadeIn>
  );
}
