import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { BOOT_MASCOT_DELAY_MS } from "@tentacle-tv/tv-core/boot";
import { PLATFORM_TRAITS } from "../platform/traits";
import { BOOT_INK } from "../redesign/boot/BootIntroView";
import { BootView } from "../redesign/screens/overlays/BootView";

/**
 * Le démarrage — le temps de relire le stockage, les réglages et la langue :
 * la mascotte de la refonte (aucun texte, la langue n'est pas encore connue).
 *
 * Là où l'OUVERTURE existe (trait `brandIntro`, Apple TV), l'écran de
 * lancement est l'encre seule : tant que la décision n'est pas prise
 * (`waiting`), rien que l'encre ; sans ouverture (jumelage, « Qui regarde ? »,
 * mouvement réduit…), la mascotte n'y paraît, en fondu, que si le démarrage
 * traîne — sinon elle clignoterait une image avant l'écran suivant.
 * Android TV : la mascotte tout de suite, comme avant.
 */
export function BootScreen({ waiting = false }: { waiting?: boolean }) {
  if (!PLATFORM_TRAITS.brandIntro) return <BootView />;
  return <View style={styles.ink}>{waiting ? null : <LateBootView />}</View>;
}

function LateBootView() {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(BOOT_MASCOT_DELAY_MS, withTiming(1, { duration: 280 }));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <BootView />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ink: { flex: 1, backgroundColor: BOOT_INK },
});
