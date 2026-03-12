import { useEffect } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { Colors, Radius } from "../theme/colors";

interface ContextMenuOption {
  label: string;
  onPress: () => void;
}

interface TVContextMenuProps {
  options: ContextMenuOption[];
  onClose: () => void;
}

export function TVContextMenu({ options, onClose }: TVContextMenuProps) {
  const slideY = useSharedValue(120);
  const dimOpacity = useSharedValue(0);

  useTVRemote({ onBack: onClose });

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    slideY.value = withTiming(0, { duration: 250, easing });
    dimOpacity.value = withTiming(1, { duration: 200, easing });
  }, [slideY, dimOpacity]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
    opacity: interpolate(slideY.value, [120, 0], [0, 1]),
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimOpacity.value,
  }));

  return (
    <View
      // @ts-ignore — Android TV accessibility
      importantForAccessibility="yes"
      style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200, justifyContent: "flex-end", alignItems: "center",
      }}
    >
      {/* Dim background */}
      <Animated.View
        style={[{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
        }, dimStyle]}
      />

      {/* Menu panel — focus trapped to prevent escape to background */}
      <Animated.View style={[{
        width: 400,
        marginBottom: 80,
        backgroundColor: Colors.glassBgHeavy,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        borderRadius: Radius.modal,
        paddingVertical: 12,
        paddingHorizontal: 8,
      }, panelStyle]}>
        {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
        <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight>
          {options.map((option, idx) => (
            <Focusable
              key={option.label}
              variant="row"
              onPress={() => { option.onPress(); onClose(); }}
              hasTVPreferredFocus={idx === 0}
            >
              <View style={{
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderRadius: Radius.small,
              }}>
                <Text style={{
                  color: Colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "500",
                  textAlign: "center",
                }}>
                  {option.label}
                </Text>
              </View>
            </Focusable>
          ))}
        </TVFocusGuideView>
      </Animated.View>
    </View>
  );
}
