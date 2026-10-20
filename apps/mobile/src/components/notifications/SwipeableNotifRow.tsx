import { memo, useCallback, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { AppNotification } from "@tentacle-tv/api-client";
import { FONT_FAMILY, typography, useTheme, withAlpha } from "@/theme";
import { haptic } from "@/utils/haptics";
import { NotifStateBadgeMobile } from "./NotifStateBadgeMobile";
import { NotifIconTile } from "./NotifIconTile";
import { decideRowSwipe, ROW_SWIPE_SLOP } from "./rowSwipe";

interface SwipeableNotifRowProps {
  notif: AppNotification;
  title: string;
  /** Le corps à montrer sous le titre, déjà filtré (null = rien). */
  body: string | null;
  ago: string;
  /** Elle mène quelque part : un chevron le dit, comme sur le bureau. */
  hasRoute: boolean;
  onOpen: (n: AppNotification) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onLongPress: (id: string) => void;
}

/**
 * Une notification du centre : la ligne du bureau (tuile d'icône teintée par
 * l'état, titre appuyé et fond teinté si non lue, pastille d'état, date,
 * chevron), avec les deux glissements de Mail : vers la DROITE, marquer lue ;
 * vers la GAUCHE, supprimer. Chaque geste a son action accessible.
 */
export const SwipeableNotifRow = memo(function SwipeableNotifRow({
  notif, title, body, ago, hasRoute, onOpen, onMarkRead, onDelete, selectionMode, isSelected, onToggleSelect, onLongPress,
}: SwipeableNotifRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("notifications");
  const translateX = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  // Le geste est créé UNE fois : il lit l'état courant par une référence
  // (largeur après rotation, mode sélection, lue ou non).
  const live = useRef({ width, selectionMode, read: notif.read, id: notif.id, onMarkRead, onDelete });
  live.current = { width, selectionMode, read: notif.read, id: notif.id, onMarkRead, onDelete };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        !live.current.selectionMode && Math.abs(g.dx) > ROW_SWIPE_SLOP && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        // Vers la droite, seulement si elle n'est pas déjà lue ; et la ligne résiste.
        const dx = g.dx > 0 && live.current.read ? g.dx / 6 : g.dx;
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_e, g) => {
        const { width: w, read, id, onMarkRead: markRead, onDelete: remove } = live.current;
        const action = decideRowSwipe({ dx: g.dx, vx: g.vx, width: w, read });
        if (action === "delete") {
          haptic("commit");
          Animated.timing(translateX, { toValue: -w, duration: 180, useNativeDriver: true }).start(() => remove(id));
          return;
        }
        if (action === "markRead") {
          haptic("tap");
          markRead(id);
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const press = useCallback(() => (selectionMode ? onToggleSelect(notif.id) : onOpen(notif)), [selectionMode, onToggleSelect, onOpen, notif]);

  // Les fonds révélés : l'un ou l'autre selon le sens du doigt.
  const markOpacity = translateX.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });
  const deleteOpacity = translateX.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: "clamp" });
  const unreadBg = withAlpha(colors.brand.violet, 0.08, colors.brand.ghost);
  const actions = selectionMode ? undefined : [
    ...(notif.read ? [] : [{ name: "markRead", label: t("markRead") }]),
    { name: "delete", label: t("delete") },
  ];

  return (
    <View style={{ marginBottom: 6, borderRadius: 14, overflow: "hidden" }}>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: markOpacity, backgroundColor: colors.brand.violet, justifyContent: "center", paddingLeft: 22 }}>
        <Feather name="check" size={20} color={colors.cta.brandFg} />
      </Animated.View>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: deleteOpacity, backgroundColor: colors.status.error, justifyContent: "center", alignItems: "flex-end", paddingRight: 22 }}>
        <Feather name="trash-2" size={20} color={colors.cta.brandFg} />
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        <Pressable
          onPress={press}
          onLongPress={() => onLongPress(notif.id)}
          delayLongPress={450}
          accessibilityRole={selectionMode ? "checkbox" : "button"}
          accessibilityLabel={[!notif.read ? t("unreadA11y") : null, title, body, ago].filter(Boolean).join(", ")}
          accessibilityState={selectionMode ? { checked: isSelected } : undefined}
          // Le balayage n'existe pas pour VoiceOver : ses deux gestes sont des actions.
          accessibilityActions={actions}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "delete") onDelete(notif.id);
            if (e.nativeEvent.actionName === "markRead") onMarkRead(notif.id);
          }}
          // Un fond opaque sous la teinte : les couleurs des glissements ne transparaissent pas.
          style={({ pressed }) => ({ backgroundColor: colors.surface.s2, borderRadius: 14, opacity: pressed ? 0.8 : 1 })}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 10, borderRadius: 14, backgroundColor: notif.read ? "transparent" : unreadBg }}>
            {!notif.read && !selectionMode && (
              <View style={{ position: "absolute", left: 4, top: "50%", marginTop: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.violet }} />
            )}
            {selectionMode ? (
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6, marginTop: 7, marginHorizontal: 7, borderWidth: 2,
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
                  ...typography.caption, fontSize: 14, lineHeight: 19,
                  // La police (Inter) ne suit pas `fontWeight` : la graisse passe par la famille.
                  fontFamily: notif.read ? FONT_FAMILY.medium : FONT_FAMILY.semibold,
                  color: notif.read ? colors.text.secondary : colors.text.primary,
                }}
                numberOfLines={2}
              >
                {title}
              </Text>
              {body && <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text.tertiary, marginTop: 2 }} numberOfLines={2}>{body}</Text>}
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 }}>
                <NotifStateBadgeMobile state={notif.state} />
                <Text style={{ fontSize: 12, color: colors.text.quaternary }}>{ago}</Text>
              </View>
            </View>

            {hasRoute && !selectionMode && <Feather name="chevron-right" size={18} color={colors.text.quaternary} style={{ alignSelf: "center" }} />}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
});
