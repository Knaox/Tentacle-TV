import { View } from "react-native";
import { BRAND } from "@tentacle-tv/shared";
import { TV_CARD_PROGRESS_HEIGHT } from "./cardSizes";

interface TVCardProgressBarProps {
  /** 0–100 inclusive. Returns null below 1 to avoid visual noise. */
  percent: number | null | undefined;
}

/**
 * Bottom progress bar overlaid on TV cards.
 * Brand violet (matches web) instead of the legacy orange.
 */
export function TVCardProgressBar({ percent }: TVCardProgressBarProps) {
  if (percent == null || percent < 1) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: TV_CARD_PROGRESS_HEIGHT,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
      }}
    >
      <View
        style={{
          height: TV_CARD_PROGRESS_HEIGHT,
          width: `${Math.min(100, Math.max(0, percent))}%`,
          backgroundColor: BRAND.violet,
        }}
      />
    </View>
  );
}
