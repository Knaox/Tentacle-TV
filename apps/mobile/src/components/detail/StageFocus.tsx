import { memo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * L'assise du bloc titre dans la scène : une ellipse sombre, centrée sous le
 * texte, en bas du décor. STATIQUE — dessinée une fois, jamais animée. Elle
 * garantit le contraste du texte blanc sur un décor clair sans assombrir le
 * reste de l'image (jumeau de `--detail-stage-focus` du web).
 */
export const StageFocus = memo(function StageFocus() {
  const theme = useTheme();
  const rgb = `rgb(${theme.colors.onMedia.scrimRgb})`;
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="stageFocus" cx="50" cy="100" rx="95" ry="48" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={rgb} stopOpacity={0.62} />
          <Stop offset="0.5" stopColor={rgb} stopOpacity={0.3} />
          <Stop offset="0.85" stopColor={rgb} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#stageFocus)" />
    </Svg>
  );
});
