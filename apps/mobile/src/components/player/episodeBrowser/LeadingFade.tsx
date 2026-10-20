import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Le bord de tête d'une rangée qui défile : la carte passée s'y efface dans le
 * noir au lieu d'y laisser une lisière (sous l'îlot, le long d'un coin). Il
 * s'arrête où la première carte se pose au repos : il ne la touche jamais.
 */
export function LeadingFade({ width }: { width: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(0, 0, 0, 0.96)", "rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0)"]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[st.fade, { width }]}
    />
  );
}

const st = StyleSheet.create({
  fade: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
