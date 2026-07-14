import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "./CryingTentacle";
import { useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface OfflineBannerProps {
  visible: boolean;
  onRetry: () => void;
  onLogout?: () => void;
  onChangeServer?: () => void;
}

export function OfflineBanner({ visible, onRetry, onLogout, onChangeServer }: OfflineBannerProps) {
  const { t } = useTranslation("common");
  const styles = useThemedStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.content}>
        <CryingTentacle size={120} />
        <Text style={styles.title}>{t("offlineTitle")}</Text>
        <Text style={styles.message}>{t("offlineMessage")}</Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>{t("retryConnection")}</Text>
        </Pressable>
        {onLogout && (
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>{t("offlineLogout")}</Text>
          </Pressable>
        )}
        {onChangeServer && (
          <Pressable style={styles.changeServerButton} onPress={onChangeServer}>
            <Text style={styles.changeServerButtonText}>{t("changeServer")}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(t.colors.surface.s0, 0.95, t.colors.overlay.scrimHeavy),
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
    },
    content: {
      alignItems: "center",
      paddingHorizontal: 32,
      width: "100%",
      maxWidth: 420,
    },
    title: {
      color: t.colors.text.primary,
      fontSize: 22,
      fontWeight: "700",
      marginTop: 24,
      textAlign: "center",
    },
    message: {
      color: t.colors.text.tertiary,
      fontSize: 14,
      marginTop: 12,
      textAlign: "center",
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: t.colors.brand.violet,
      borderRadius: 12,
      paddingHorizontal: 32,
      paddingVertical: 14,
      marginTop: 28,
    },
    retryButtonText: {
      color: t.colors.cta.brandFg,
      fontSize: 15,
      fontWeight: "600",
    },
    logoutButton: {
      backgroundColor: t.colors.statusPairs.error.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.status.error, 0.3, t.colors.danger.border),
      paddingHorizontal: 32,
      paddingVertical: 14,
      marginTop: 12,
    },
    logoutButtonText: {
      color: t.colors.status.error,
      fontSize: 15,
      fontWeight: "600",
    },
    changeServerButton: {
      backgroundColor: t.colors.fill.subtle,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      paddingHorizontal: 32,
      paddingVertical: 14,
      marginTop: 12,
    },
    changeServerButtonText: {
      color: t.colors.text.secondary,
      fontSize: 15,
      fontWeight: "600",
    },
  });
