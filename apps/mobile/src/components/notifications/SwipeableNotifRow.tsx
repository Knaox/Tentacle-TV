import { useRef, useCallback } from "react";
import { View, Text, Pressable, Animated, PanResponder, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { AppNotification } from "@tentacle-tv/api-client";
import { FONT_FAMILY, typography, useTheme, withAlpha } from "@/theme";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: Record<string, unknown> } | null = null;
try { Haptics = require("expo-haptics"); } catch {}

interface SwipeableNotifRowProps {
  notif: AppNotification;
  formattedTitle: string;
  /** Le corps à montrer sous le titre, déjà filtré (null = rien). */
  formattedBody: string | null;
  formattedAgo: string;
  onPress: () => void;
  onDelete: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
}

/** Au-delà de cette part de la largeur, lâcher supprime. */
const SWIPE_RATIO = 0.3;

export function SwipeableNotifRow({
  notif, formattedTitle, formattedBody, formattedAgo, onPress, onDelete,
  selectionMode, isSelected, onToggleSelect, onLongPress,
}: SwipeableNotifRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("notifications");
  const translateX = useRef(new Animated.Value(0)).current;
  // Le geste est créé UNE fois : il lit l'état courant par une référence.
  // Il figeait la largeur du chargement (fausse après une rotation d'iPad) et
  // le mode sélection du premier rendu (balayer supprimait en sélection).
  const { width } = useWindowDimensions();
  const live = useRef({ width, selectionMode, onDelete });
  live.current = { width, selectionMode, onDelete };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (live.current.selectionMode) return false;
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dx < 0) translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { width: w, onDelete: remove } = live.current;
        if (gestureState.dx < -w * SWIPE_RATIO) {
          Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.timing(translateX, { toValue: -w, duration: 200, useNativeDriver: true }).start(() => {
            remove();
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
          backgroundColor: colors.status.error, borderRadius: 12,
          justifyContent: "center", alignItems: "flex-end", paddingRight: 24,
        }}
      >
        <Feather name="trash-2" size={20} color={colors.cta.brandFg} />
      </View>

      {/* Swipeable row */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={500}
          accessibilityRole={selectionMode ? "checkbox" : "button"}
          accessibilityState={selectionMode ? { checked: isSelected } : undefined}
          // Le balayage n'existe pas pour VoiceOver : la suppression est une action.
          accessibilityActions={selectionMode ? undefined : [{ name: "delete", label: t("delete") }]}
          onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === "delete") onDelete(); }}
          style={({ pressed }) => ({
            backgroundColor: colors.surface.s2,
            borderRadius: 12, padding: 16,
            flexDirection: "row", gap: 10,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {selectionMode ? (
            <Pressable
              onPress={onToggleSelect}
              hitSlop={16}
              style={{
                width: 22, height: 22, borderRadius: 4, marginTop: 2,
                borderWidth: 2,
                borderColor: isSelected ? withAlpha(colors.brand.violet, 0.5, colors.brand.glow) : colors.fill.strong,
                backgroundColor: isSelected ? colors.brand.soft : "transparent",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {isSelected && <Feather name="check" size={14} color={colors.brand.light} />}
            </Pressable>
          ) : (
            !notif.read && (
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: colors.brand.ghost,
                borderWidth: 1, borderColor: withAlpha(colors.brand.violet, 0.5, colors.brand.glow),
                marginTop: 6,
              }} />
            )
          )}

          <View style={{ flex: 1, marginLeft: notif.read && !selectionMode ? 18 : 0 }}>
            <Text
              style={{
                ...typography.caption,
                fontSize: 14,
                // La police (Inter) ne suit pas `fontWeight` : la graisse passe par la famille.
                fontFamily: notif.read ? FONT_FAMILY.medium : FONT_FAMILY.bold,
                color: notif.read ? colors.text.secondary : colors.text.primary,
              }}
              numberOfLines={2}
            >
              {formattedTitle}
            </Text>
            {formattedBody && (
              <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text.tertiary, marginTop: 4 }} numberOfLines={2}>
                {formattedBody}
              </Text>
            )}
            <Text style={{ fontSize: 12, color: colors.text.quaternary, marginTop: 6 }}>
              {formattedAgo}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
