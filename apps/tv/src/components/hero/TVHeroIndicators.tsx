import { memo } from "react";
import { View } from "react-native";
import { BRAND } from "@tentacle-tv/shared";
import { Colors } from "../../theme/colors";

interface TVHeroIndicatorsProps {
  count: number;
  activeIndex: number;
}

/**
 * Bottom-center pill indicators for the hero billboard.
 * Active pill uses brand violet gradient (matches the web indicator style).
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
        bottom: 20,
        alignSelf: "center",
        flexDirection: "row",
        gap: 6,
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const active = i === activeIndex;
        return (
          <View
            key={i}
            style={{
              width: active ? 28 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: active ? BRAND.violet : Colors.textTertiary,
              shadowColor: active ? BRAND.violet : "transparent",
              shadowOpacity: active ? 0.6 : 0,
              shadowRadius: active ? 8 : 0,
            }}
          />
        );
      })}
    </View>
  );
});
