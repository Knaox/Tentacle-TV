import { useEffect, useRef } from "react";
import { View, Pressable, Text, StyleSheet, Animated } from "react-native";
import { X } from "lucide-react-native";
import { PLAYER, useResponsive } from "../../theme";

interface Props {
  label: string;
  onPress: () => void;
  bottom: number;
  right: number;
  /** Durée totale du décompte (ms) ; `null` = bouton manuel, sans glissière. */
  countdownTotalMs?: number | null;
  /** Refuser le saut automatique — la croix n'existe que pendant un décompte. */
  onDismiss?: () => void;
}

/**
 * LE bouton de saut — intro, résumé, aperçu, générique : une seule pilule,
 * BLANCHE, comme sur le web et le bureau. Le langage est le même partout : même
 * place, même poids, et le décompte n'ajoute que trois choses — le libellé qui
 * compte, une glissière qui court, une croix pour s'y opposer.
 *
 * La glissière anime `scaleX` et RIEN d'autre, pilote natif à l'appui : animer
 * une largeur repasserait par le fil JavaScript à chaque image, au-dessus d'un
 * décodeur vidéo. `transformOrigin` la fait courir depuis la gauche (RN ≥ 0.74).
 */
export function SkipButton({
  label, onPress, bottom, right, countdownTotalMs, onDismiss,
}: Props) {
  const { isTablet } = useResponsive();
  const armed = typeof countdownTotalMs === "number" && countdownTotalMs > 0;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!armed) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: countdownTotalMs ?? 0,
      useNativeDriver: true,
    });
    animation.start();
    return () => { animation.stop(); };
  }, [armed, countdownTotalMs, progress]);

  return (
    <View style={[st.row, { bottom, right }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [st.btn, isTablet && st.btnTablet, pressed && { opacity: 0.82 }]}
        hitSlop={8}
      >
        <Text style={[st.label, isTablet && { fontSize: 17 }]} numberOfLines={1}>{label}</Text>
        {armed && (
          <Animated.View
            pointerEvents="none"
            style={[st.progressBar, { transform: [{ scaleX: progress }] }]}
          />
        )}
      </Pressable>
      {armed && onDismiss && (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          hitSlop={10}
          style={({ pressed }) => [st.dismissBtn, pressed && { opacity: 0.7 }]}
        >
          <X size={isTablet ? 20 : 16} color={PLAYER.text} />
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 50,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PLAYER.text,
    backgroundColor: PLAYER.text,
    paddingHorizontal: 20,
    paddingVertical: 10,
    overflow: "hidden",
  },
  btnTablet: {
    minHeight: 54,
    borderRadius: 10,
    gap: 9,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  // Sur fond blanc, la glissière est sombre — un blanc translucide y serait
  // invisible (même arbitrage que sur le web).
  progressBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: PLAYER.fillInverse,
    transformOrigin: "left",
  },
  dismissBtn: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PLAYER.controlBg,
  },
  label: { color: PLAYER.textInverse, fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },
});
