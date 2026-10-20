import { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { FONT_FAMILY, PLAYER } from "@/theme";

/** Une réaction flottante (forme de `WtFloatingReaction`, chat partagé). */
export interface WtReactionView {
  key: string;
  username: string;
  emoji?: string;
  gif?: { url: string; w?: number; h?: number };
}

/** Durée de la montée — l'expiration (TTL) est tenue par le chat partagé. */
const RISE_MS = 2_400;
const RISE_PX = 220;
const GIF_SIZE = 120;

/**
 * Les réactions du groupe, qui montent sur la vidéo en bas à droite et
 * s'effacent. Rien que des transformations et des opacités (pilote natif) ;
 * avec le mouvement réduit, un simple fondu sur place. Ne capte aucun toucher.
 */
export const WtReactionLayer = memo(function WtReactionLayer({ reactions }: { reactions: readonly WtReactionView[] }) {
  return (
    <View pointerEvents="none" style={st.layer}>
      {reactions.map((r, i) => <FloatingReaction key={r.key} reaction={r} lane={i % 3} />)}
    </View>
  );
});

const FloatingReaction = memo(function FloatingReaction({ reaction, lane }: { reaction: WtReactionView; lane: number }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1, duration: RISE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const opacity = progress.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const translateY = reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [0, -RISE_PX] });

  return (
    <Animated.View style={[st.item, { right: 16 + lane * 40, opacity, transform: [{ translateY }] }]}>
      {reaction.gif
        ? <Image source={{ uri: reaction.gif.url }} style={st.gif} contentFit="cover" accessible={false} />
        : <Text style={st.emoji}>{reaction.emoji}</Text>}
      <Text style={st.name} numberOfLines={1}>{reaction.username}</Text>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  item: { position: "absolute", bottom: 120, alignItems: "center" },
  emoji: { fontSize: 36 },
  gif: { width: GIF_SIZE, height: GIF_SIZE, borderRadius: 12 },
  name: {
    marginTop: 2, maxWidth: 96, color: PLAYER.text, fontSize: 11, fontFamily: FONT_FAMILY.semibold,
    textShadowColor: PLAYER.scrim, textShadowRadius: 4,
  },
});
