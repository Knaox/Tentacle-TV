import { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Colors } from "../theme/colors";
import { CryingTentacle } from "./CryingTentacle";
import { Focusable } from "./focus/Focusable";

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
        <CryingTentacle size={140} />
        <Text style={styles.title}>{t("offlineTitle")}</Text>
        <Text style={styles.message}>{t("offlineMessage")}</Text>
        <Focusable variant="button" onPress={onRetry} hasTVPreferredFocus>
          <View style={styles.button}>
            <Text style={styles.buttonText}>{t("retryConnection")}</Text>
          </View>
        </Focusable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 6, 10, 0.97)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 48,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 28,
    textAlign: "center",
  },
  message: {
    color: Colors.textMuted,
    fontSize: 18,
    marginTop: 14,
    textAlign: "center",
    lineHeight: 26,
  },
  button: {
    backgroundColor: Colors.accentPurple,
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 16,
    marginTop: 32,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
});
