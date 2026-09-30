import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, fonts, scrim } from "../../theme/tokens";

/**
 * La bulle du plateau : ce que fera OK sur l'élément visé — « Ajouter à ma
 * liste », « Reprendre · 12:34 ». Le `title` des boutons du bureau, lisible à
 * trois mètres : un rond ne dit pas ce qu'il fait.
 *
 * Posée AU-DESSUS du groupe, sur le voile, dans la carte — jamais sous elle,
 * où elle mordrait sur la rangée suivante. Le voile noir des pastilles du repos
 * (0,72) ; trois lignes au plus pour les libellés des titres hors bibliothèque.
 */
export const TrayHint = memo(function TrayHint({ text, align }: { text: string; align: "center" | "end" }) {
  return (
    <Animated.View entering={FadeIn.duration(140)} style={[styles.pill, align === "end" ? styles.end : styles.center]}>
      <Text style={[styles.text, align === "end" && styles.textEnd]} numberOfLines={3}>
        {text}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pill: { maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: scrim(0.72) },
  center: { alignSelf: "center" },
  end: { alignSelf: "flex-end" },
  text: { ...fonts.semibold, fontSize: 22, lineHeight: 28, color: colors.text, textAlign: "center" },
  textEnd: { textAlign: "right" },
});
