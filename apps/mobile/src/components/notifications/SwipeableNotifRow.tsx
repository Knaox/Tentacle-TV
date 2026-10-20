import { useRef, useCallback } from "react";
import { View, Text, Pressable, Animated, PanResponder, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { AppNotification } from "@tentacle-tv/api-client";
import { FONT_FAMILY, typography, useTheme, withAlpha } from "@/theme";
import { haptic } from "@/utils/haptics";
import { NotifStateBadgeMobile } from "./NotifStateBadgeMobile";
import { NotifIconTile } from "./NotifIconTile";


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
  /** Elle mène quelque part : un chevron le dit, comme sur le bureau. */
  hasRoute: boolean;
}

/** Au-delà de cette part de la largeur, lâcher supprime. */
const SWIPE_RATIO = 0.3;

export function SwipeableNotifRow({
  notif, formattedTitle, formattedBody, formattedAgo, onPress, onDelete,
  selectionMode, isSelected, onToggleSelect, onLongPress, hasRoute,
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
          haptic("commit");
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

  // Non lue : un fond teinté de la marque et un point, comme sur le bureau.
  const unreadBg = withAlpha(colors.brand.violet, 0.08, colors.brand.ghost);
  return (
    <View style={{ position: "relative", marginBottom: 6, overflow: "hidden", borderRadius: 14 }}>
      {/* Le fond rouge révélé par le balayage */}
      <View
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: "100%",
          backgroundColor: colors.status.error, borderRadius: 14,
          justifyContent: "center", alignItems: "flex-end", paddingRight: 24,
        }}
      >
        <Feather name="trash-2" size={20} color={colors.cta.brandFg} />
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={500}
          accessibilityRole={selectionMode ? "checkbox" : "button"}
          accessibilityLabel={[!notif.read ? t("unreadA11y") : null, formattedTitle, formattedBody, formattedAgo].filter(Boolean).join(", ")}
          accessibilityState={selectionMode ? { checked: isSelected } : undefined}
          // Le balayage n'existe pas pour VoiceOver : la suppression est une action.
          accessibilityActions={selectionMode ? undefined : [{ name: "delete", label: t("delete") }]}
          onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === "delete") onDelete(); }}
          style={({ pressed }) => ({
            // Un fond opaque sous la teinte : le rouge du balayage ne transparaît pas.
            backgroundColor: colors.surface.s2,
            borderRadius: 14,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 10, borderRadius: 14, backgroundColor: notif.read ? "transparent" : unreadBg }}>
            {!notif.read && !selectionMode && (
              <View style={{ position: "absolute", left: 4, top: "50%", marginTop: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.violet }} />
            )}
            {selectionMode ? (
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6, marginTop: 7, marginHorizontal: 7,
                  borderWidth: 2,
                  borderColor: isSelected ? withAlpha(colors.brand.violet, 0.5, colors.brand.glow) : colors.fill.strong,
                  backgroundColor: isSelected ? colors.brand.soft : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {isSelected && <Feather name="check" size={14} color={colors.brand.light} />}
              </View>
            ) : (
              <NotifIconTile notif={notif} />
            )}

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  ...typography.caption,
                  fontSize: 14,
                  lineHeight: 19,
                  // La police (Inter) ne suit pas `fontWeight` : la graisse passe par la famille.
                  fontFamily: notif.read ? FONT_FAMILY.medium : FONT_FAMILY.semibold,
                  color: notif.read ? colors.text.secondary : colors.text.primary,
                }}
                numberOfLines={2}
              >
                {formattedTitle}
              </Text>
              {formattedBody && (
                <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text.tertiary, marginTop: 2 }} numberOfLines={2}>
                  {formattedBody}
                </Text>
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 }}>
                <NotifStateBadgeMobile state={notif.state} />
                <Text style={{ fontSize: 12, color: colors.text.quaternary }}>{formattedAgo}</Text>
              </View>
            </View>

            {hasRoute && !selectionMode && (
              <Feather name="chevron-right" size={18} color={colors.text.quaternary} style={{ alignSelf: "center" }} />
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
