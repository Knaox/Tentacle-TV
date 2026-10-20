import { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useNotificationsLive, useTentacleConfig } from "@tentacle-tv/api-client";
import { useUnreadCountMobile } from "@/hooks/useNotificationsMobile";
import { BottomSheet } from "./ui";
import { NotificationCenter } from "./notifications/NotificationCenter";
import { NotificationPanelTablet } from "./notifications/NotificationPanelTablet";
import { useResponsive, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";

/**
 * La cloche de l'en-tête et son centre : une feuille à crans sur le téléphone
 * (moitié, puis plein écran), un panneau latéral à droite sur la tablette.
 * Le contenu est le même (`NotificationCenter`) ; la pastille dit les non
 * lues, rafraîchies à l'instant où une notification s'écrit (socket partagé).
 */
export function NotificationBell() {
  const { t } = useTranslation("notifications");
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const [visible, setVisible] = useState(false);

  const { data: unread } = useUnreadCountMobile();
  const { storage } = useTentacleConfig();
  useNotificationsLive({ token: storage.getItem("tentacle_token") });

  const count = unread?.count ?? 0;
  const openCenter = useCallback(() => {
    haptic("tap");
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <>
      <Pressable onPress={openCenter} hitSlop={12} style={{ position: "relative" }} accessibilityRole="button" accessibilityLabel={count > 0 ? `${t("title")}, ${t("unreadCount", { count })}` : t("title")}>
        <Feather name="bell" size={21} color={colors.text.primary} />
        {count > 0 && (
          <View style={{ position: "absolute", top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.brand.violet, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
            <Text style={{ color: colors.cta.brandFg, fontSize: 10, fontWeight: "800" }}>{count > 9 ? "9+" : count}</Text>
          </View>
        )}
      </Pressable>

      <NotificationCenter
        open={visible}
        onClose={close}
        frame={(header, body) => (isTablet ? (
          <NotificationPanelTablet visible={visible} onClose={close} header={header}>{body}</NotificationPanelTablet>
        ) : (
          // Moitié de l'écran, puis plein écran en la tirant vers le haut.
          <BottomSheet visible={visible} onClose={close} snapPoints={[0.55, 1.0]} header={header}>{body}</BottomSheet>
        ))}
      />
    </>
  );
}
