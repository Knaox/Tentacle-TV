import { useEffect, useCallback } from "react";
import { View, Text, TVFocusGuideView, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { Colors } from "../theme/colors";
import { CryingTentacle } from "./CryingTentacle";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";

interface OfflineBannerProps {
  visible: boolean;
  onRetry: () => void;
}

export function OfflineBanner({ visible, onRetry }: OfflineBannerProps) {
  const { t } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const opacity = useSharedValue(0);

  useTVRemote({ onBack: onRetry });

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
  }, [visible, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleLogout = useCallback(() => {
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    queryClient.clear();
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "PairCode" as never }] }),
    );
  }, [storage, navigation, queryClient]);

  if (!visible) return null;

  return (
    <Animated.View
      // @ts-ignore — Android TV accessibility
      importantForAccessibility="yes"
      style={[styles.overlay, animStyle]}
    >
      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
      <TVFocusGuideView
        autoFocus
        trapFocusUp trapFocusDown trapFocusLeft trapFocusRight
        style={styles.content}
      >
        <CryingTentacle size={140} />
        <Text style={styles.title}>{t("offlineTitle")}</Text>
        <Text style={styles.message}>{t("offlineMessage")}</Text>
        <Focusable variant="button" onPress={onRetry} hasTVPreferredFocus>
          <View style={styles.retryButton}>
            <Text style={styles.retryButtonText}>{t("retryConnection")}</Text>
          </View>
        </Focusable>
        <Focusable variant="button" onPress={handleLogout}>
          <View style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>{t("offlineLogout")}</Text>
          </View>
        </Focusable>
      </TVFocusGuideView>
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
  retryButton: {
    backgroundColor: Colors.accentPurple,
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 16,
    marginTop: 32,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 40,
    paddingVertical: 16,
    marginTop: 12,
  },
  logoutButtonText: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "600",
  },
});
