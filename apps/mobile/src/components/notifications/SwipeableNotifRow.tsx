import { useRef, useCallback } from "react";
import { View, Text, Pressable, Animated, PanResponder, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { AppNotification } from "@tentacle-tv/api-client";
import { colors, typography } from "@/theme";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: Record<string, unknown> } | null = null;
try { Haptics = require("expo-haptics"); } catch {}

interface SwipeableNotifRowProps {
  notif: AppNotification;
  formattedTitle: string;
  formattedAgo: string;
  onPress: () => void;
  onDelete: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export function SwipeableNotifRow({
  notif, formattedTitle, formattedAgo, onPress, onDelete,
  selectionMode, isSelected, onToggleSelect, onLongPress,
}: SwipeableNotifRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (selectionMode) return false;
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dx < 0) translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 200, useNativeDriver: true }).start(() => {
            onDelete();
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const handlePress = useCallback(() => {
    if (selectionMode) {
      onToggleSelect();
    } else {
      onPress();
    }
  }, [selectionMode, onToggleSelect, onPress]);

  return (
    <View style={{ position: "relative", marginBottom: 8, overflow: "hidden" }}>
      {/* Red delete background */}
      <View
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: "100%",
          backgroundColor: colors.danger, borderRadius: 12,
          justifyContent: "center", alignItems: "flex-end", paddingRight: 24,
        }}
      >
        <Feather name="trash-2" size={20} color="#fff" />
      </View>

      {/* Swipeable row */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={500}
          style={({ pressed }) => ({
            backgroundColor: "#1a1a2e",
            borderRadius: 12, padding: 16,
            flexDirection: "row", gap: 10,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {selectionMode ? (
            <Pressable
              onPress={onToggleSelect}
              hitSlop={8}
              style={{
                width: 22, height: 22, borderRadius: 4, marginTop: 2,
                borderWidth: 2,
                borderColor: isSelected ? colors.accent : "rgba(255,255,255,0.3)",
                backgroundColor: isSelected ? colors.accent : "transparent",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {isSelected && <Feather name="check" size={14} color="#fff" />}
            </Pressable>
          ) : (
            !notif.read && (
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: colors.accent, marginTop: 6,
              }} />
            )
          )}

          <View style={{ flex: 1, marginLeft: notif.read && !selectionMode ? 18 : 0 }}>
            <Text
              style={{
                ...typography.small,
                fontWeight: notif.read ? "400" : "700",
                color: notif.read ? colors.textMuted : colors.textPrimary,
              }}
              numberOfLines={1}
            >
              {formattedTitle}
            </Text>
            {notif.body && notif.type !== "ticket_status" && (
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>
                {notif.body}
              </Text>
            )}
            <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
              {formattedAgo}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
