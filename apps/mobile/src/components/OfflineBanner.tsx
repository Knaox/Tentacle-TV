import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "./CryingTentacle";

interface OfflineBannerProps {
  visible: boolean;
  onRetry: () => void;
}

export function OfflineBanner({ visible, onRetry }: OfflineBannerProps) {
  const { t } = useTranslation("common");
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
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>{t("retryConnection")}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 15, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 24,
    textAlign: "center",
  },
  message: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 28,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
