import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { reactionBursts, type ReactionBurst, type ReactionLike } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER } from "@/theme";

/** Après la dernière réaction d'une rafale : tenue, puis fondu (avant l'expiration du chat, 2,6 s). */
const HOLD_MS = 1_700;
const FADE_MS = 600;
const RISE_PX = 60;
const GIF_SIZE = 120;

/**
 * Les réactions du groupe sur la vidéo, en bas à droite — FLUIDES MÊME EN
 * RAFALE : la règle partagée (`reactionBursts`) regroupe les réactions
 * identiques d'un même membre en UNE bulle « 🔥 ×10 », bornée aux plus
 * récentes, chacune dans sa voie. Une bulle monte un peu en entrant, pulse à
 * chaque nouvelle réaction, puis s'efface. Rien que des transformations et des
 * opacités (pilote natif) ; avec le mouvement réduit, des fondus seulement.
 * Ne capte aucun toucher.
 */
export const WtReactionLayer = memo(function WtReactionLayer({ reactions }: { reactions: readonly ReactionLike[] }) {
  const bursts = useMemo(() => reactionBursts(reactions), [reactions]);
  return (
    <View pointerEvents="none" style={st.layer}>
      {bursts.map((b) => <Bubble key={b.id} burst={b} />)}
    </View>
  );
});

const Bubble = memo(function Bubble({ burst }: { burst: ReactionBurst }) {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [enter]);

  // Chaque nouvelle réaction : une pulsation, et le fondu repart de zéro.
  useEffect(() => {
    fade.setValue(1);
    const seq = Animated.sequence([
      reduced
        ? Animated.delay(0)
        : Animated.sequence([
          Animated.timing(pulse, { toValue: 1.22, duration: 90, useNativeDriver: true }),
          Animated.spring(pulse, { toValue: 1, damping: 9, stiffness: 260, useNativeDriver: true }),
        ]),
      Animated.delay(HOLD_MS),
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]);
    seq.start();
    return () => seq.stop();
  }, [burst.lastKey, pulse, fade, reduced]);

  const translateY = reduced ? 0 : enter.interpolate({ inputRange: [0, 1], outputRange: [0, -RISE_PX] });
  const opacity = Animated.multiply(enter, fade);

  return (
    <Animated.View style={[st.item, { right: 16 + burst.lane * 64, opacity, transform: [{ translateY }, { scale: pulse }] }]}>
      {burst.gif
        ? <Image source={{ uri: burst.gif.url }} style={st.gif} contentFit="cover" accessible={false} />
        : <Text style={st.emoji}>{burst.emoji}</Text>}
      <Text style={st.name} numberOfLines={1}>
        {burst.username}{burst.count > 1 ? ` ×${burst.count}` : ""}
      </Text>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  item: { position: "absolute", bottom: 120, alignItems: "center" },
  emoji: { fontSize: 36 },
  gif: { width: GIF_SIZE, height: GIF_SIZE, borderRadius: 12 },
  name: {
    marginTop: 2, maxWidth: 110, color: PLAYER.text, fontSize: 11, fontFamily: FONT_FAMILY.semibold,
    textShadowColor: PLAYER.scrim, textShadowRadius: 4, fontVariant: ["tabular-nums"],
  },
});
