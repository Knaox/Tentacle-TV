import { StyleSheet, Text } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { DISTANCE_THRESHOLD, STAMP_START } from "@tentacle-tv/api-client";

interface Props {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}

/** Intensité d'un tampon — copie en worklet de `stampStrength` (api-client) :
 *  nulle si l'axe du verdict ne domine pas, pleine au seuil de distance. */
function strength(along: number, dominant: boolean): number {
  "worklet";
  return dominant ? interpolate(along, [STAMP_START, DISTANCE_THRESHOLD], [0, 1], Extrapolation.CLAMP) : 0;
}

/**
 * Les tampons du glisser : leur opacité suit le doigt (UI thread, opacity
 * seule). Un seul s'allume, celui de l'axe qui domine, plein quand le lâcher
 * jugera. Une icône double chaque couleur — le sens n'y tient jamais seul.
 * « Passer » s'affiche en haut : la carte tirée vers le bas y reste visible.
 */
export function SwipeStampsNative({ tx, ty }: Props) {
  const { t } = useTranslation("swipe");
  const like = useAnimatedStyle(() => ({ opacity: strength(tx.value, Math.abs(tx.value) >= Math.abs(ty.value)) }));
  const nope = useAnimatedStyle(() => ({ opacity: strength(-tx.value, Math.abs(tx.value) >= Math.abs(ty.value)) }));
  const love = useAnimatedStyle(() => ({ opacity: strength(-ty.value, Math.abs(ty.value) > Math.abs(tx.value)) }));
  const skip = useAnimatedStyle(() => ({ opacity: strength(ty.value, Math.abs(ty.value) > Math.abs(tx.value)) }));
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
      <Animated.View pointerEvents="none" style={[st.stamp, st.skip, skip]}>
        <Feather name="skip-forward" size={18} color="#F1F5F9" />
        <Text style={[st.text, { color: "#F1F5F9" }]}>{t("stampSkip")}</Text>
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
  skip: { top: 28, alignSelf: "center", borderColor: "#CBD5E1" },
  text: { fontSize: 18, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
});
