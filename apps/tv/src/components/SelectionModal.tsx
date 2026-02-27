import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Focusable } from "./focus/Focusable";
import { CheckIcon } from "./icons/TVIcons";
import { Colors, Radius } from "../theme/colors";

interface SelectionOption {
  value: string;
  label: string;
}

interface SelectionModalProps {
  title: string;
  options: SelectionOption[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function SelectionModal({ title, options, selectedValue, onSelect, onClose }: SelectionModalProps) {
  const bgOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.9);
  const modalOpacity = useSharedValue(0);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    bgOpacity.value = withTiming(1, { duration: 200, easing });
    modalScale.value = withTiming(1, { duration: 250, easing });
    modalOpacity.value = withTiming(1, { duration: 250, easing });
  }, [bgOpacity, modalScale, modalOpacity]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  return (
    <Animated.View style={[{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center", alignItems: "center",
      zIndex: 200,
    }, bgStyle]}>
      <Animated.View style={[{
        width: 420, maxHeight: "70%",
        backgroundColor: Colors.glassBgHeavy,
        borderRadius: Radius.modal,
        borderWidth: 1, borderColor: Colors.glassBorder,
        overflow: "hidden",
      }, modalStyle]}>
        {/* Header */}
        <View style={{
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: 28, paddingVertical: 20,
          borderBottomWidth: 1, borderBottomColor: Colors.divider,
        }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "700" }}>
            {title}
          </Text>
          <Focusable onPress={onClose}>
            <View style={{
              paddingHorizontal: 16, paddingVertical: 8,
              borderRadius: Radius.small,
              backgroundColor: "rgba(255,255,255,0.06)",
            }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: "600" }}>
                Cancel
              </Text>
            </View>
          </Focusable>
        </View>

        {/* Options list */}
        <ScrollView
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {options.map((opt) => {
            const isSelected = opt.value === selectedValue;
            return (
              <Focusable
                key={opt.value}
                onPress={() => onSelect(opt.value)}
                hasTVPreferredFocus={isSelected}
              >
                <View style={{
                  flexDirection: "row", alignItems: "center",
                  paddingVertical: 14, paddingHorizontal: 16,
                  borderRadius: Radius.small, marginBottom: 2,
                  backgroundColor: isSelected ? "rgba(139, 92, 246, 0.15)" : "transparent",
                }}>
                  <View style={{ width: 28, alignItems: "center" }}>
                    {isSelected && <CheckIcon size={16} color={Colors.accentPurple} />}
                  </View>
                  <Text style={{
                    color: isSelected ? Colors.textPrimary : Colors.textSecondary,
                    fontSize: 16, fontWeight: isSelected ? "600" : "400",
                  }}>
                    {opt.label}
                  </Text>
                </View>
              </Focusable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}
