import { useEffect, useRef } from "react";
import { StyleSheet, Animated } from "react-native";
import { useTranslation } from "react-i18next";
import { motion } from "../../theme";
import { OverlayPill } from "./overlayPill";

interface Props {
  label: string;
  onPress: () => void;
  bottom: number;
  right: number;
  /** Durée totale du décompte (ms) ; `null` = bouton manuel, sans balayage. */
  countdownTotalMs?: number | null;
  /** Refuser le passage — la croix vit DANS la pilule (parité desktop). */
  onDismiss?: () => void;
}

/**
 * LE bouton de saut — intro, résumé, aperçu, générique : une seule pilule,
 * BLANCHE, comme sur le web et le bureau. Ce fichier ne fait plus que le
 * POSITIONNEMENT (coin bas-droit) et l'entrée en scène ; le dessin — voile,
 * balayage, croix intégrée — vit dans `OverlayPill`.
 */
export function SkipButton({
  label, onPress, bottom, right, countdownTotalMs, onDismiss,
}: Props) {
  const { t } = useTranslation("player");
  // Entrée « Rising » du desktop : huit points de montée + fondu, 200 ms.
  const enter = useRef(new Animated.Value(motion.isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (motion.isReducedMotion()) return;
    const animation = Animated.timing(enter, {
      toValue: 1, duration: 200, useNativeDriver: true,
    });
    animation.start();
    return () => { animation.stop(); };
  }, [enter]);

  return (
    <Animated.View
      style={[
        st.wrap,
        { bottom, right, opacity: enter },
        { transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <OverlayPill
        label={label}
        onPress={onPress}
        countdownMs={countdownTotalMs}
        onDismiss={onDismiss}
        dismissAccessibilityLabel={t("dismiss")}
      />
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 50,
    alignItems: "flex-end",
  },
});
