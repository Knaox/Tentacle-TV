import { memo, useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { TV_BANNER_CARD } from "@tentacle-tv/theme";
import { Colors } from "../../theme/colors";

const GAUGE = TV_BANNER_CARD.gauge;

interface TVHeroIndicatorsProps {
  count: number;
  activeIndex: number;
}

/**
 * La jauge de mises en avant — pastilles en LECTURE SEULE au coin bas-droit de
 * la carte (parité `BannerGaugeTv` webOS) : elle dit combien de mises en avant
 * existent et où l'on en est, elle ne se pilote pas.
 *
 * La largeur s'anime en 500 ms. C'est une propriété de mise en page (pilote JS,
 * pas natif) — assumé : 44 px toutes les 8 secondes, pas un calque plein écran.
 */
export const TVHeroIndicators = memo(function TVHeroIndicators({
  count,
  activeIndex,
}: TVHeroIndicatorsProps) {
  if (count <= 1) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: GAUGE.inset,
        right: GAUGE.inset,
        flexDirection: "row",
        gap: GAUGE.gap,
        zIndex: 10,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <GaugePill key={i} active={i === activeIndex} />
      ))}
    </View>
  );
});

function GaugePill({ active }: { active: boolean }) {
  const width = useRef(
    new Animated.Value(active ? GAUGE.activeWidth : GAUGE.inactiveWidth),
  ).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: active ? GAUGE.activeWidth : GAUGE.inactiveWidth,
      duration: GAUGE.transitionMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [active, width]);

  return (
    <Animated.View
      style={{
        width,
        height: GAUGE.height,
        borderRadius: GAUGE.height / 2,
        overflow: "hidden",
        backgroundColor: active ? "transparent" : "rgba(255,255,255,0.28)",
        shadowColor: active ? Colors.accentPurple : "transparent",
        shadowOpacity: active ? 0.6 : 0,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      {active && (
        <LinearGradient
          colors={[Colors.accentPurple, Colors.accentPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      )}
    </Animated.View>
  );
}
