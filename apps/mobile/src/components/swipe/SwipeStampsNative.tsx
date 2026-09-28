import { StyleSheet, Text } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

interface Props {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}

/**
 * Les tampons du glisser : leur opacité suit le doigt (UI thread, opacity
 * seule). Une icône double chaque couleur — le sens n'y tient jamais seul.
 */
export function SwipeStampsNative({ tx, ty }: Props) {
  const { t } = useTranslation("swipe");
  const like = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [24, 110], [0, 1], Extrapolation.CLAMP) }));
  const nope = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-110, -24], [1, 0], Extrapolation.CLAMP) }));
  const love = useAnimatedStyle(() => ({
    // Le coup de cœur ne s'allume que si le haut domine (cf. verdictFromDrag).
    opacity: Math.abs(tx.value) > 80 ? 0 : interpolate(ty.value, [-120, -30], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[st.stamp, st.like, like]}>
        <Feather name="heart" size={18} color="#6EE7B7" />
        <Text style={[st.text, { color: "#6EE7B7" }]}>{t("stampLike")}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[st.stamp, st.nope, nope]}>
        <Feather name="x" size={18} color="#FDA4AF" />
        <Text style={[st.text, { color: "#FDA4AF" }]}>{t("stampNope")}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[st.stamp, st.love, love]}>
        <Feather name="star" size={18} color="#F5D0FE" />
        <Text style={[st.text, { color: "#F5D0FE" }]}>{t("stampSuper")}</Text>
      </Animated.View>
    </>
  );
}

const st = StyleSheet.create({
  stamp: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  like: { top: 28, left: 20, borderColor: "#34D399", transform: [{ rotate: "-12deg" }] },
  nope: { top: 28, right: 20, borderColor: "#FB7185", transform: [{ rotate: "12deg" }] },
  love: { bottom: "42%", alignSelf: "center", borderColor: "#E879F9" },
  text: { fontSize: 18, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
});
