import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";

const COUNTDOWN_SEC = 10;

interface Props {
  nextEpisode: MediaItem;
  onPlay: () => void;
  onDismiss: () => void;
}

export function AutoPlayOverlay({ nextEpisode, onPlay, onDismiss }: Props) {
  const { t } = useTranslation("player");
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true,
      tension: 50, friction: 9,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onPlay();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onPlay]);

  const progress = countdown / COUNTDOWN_SEC;

  const episodeLabel = nextEpisode.SeriesName
    ? `S${nextEpisode.ParentIndexNumber}E${nextEpisode.IndexNumber}`
    : "";

  return (
    <Animated.View style={{
      position: "absolute", bottom: 80, right: 16,
      transform: [{ translateY: slideAnim }],
    }}>
      <View style={{
        backgroundColor: "rgba(18, 18, 26, 0.95)", borderRadius: 12,
        padding: 16, width: 260,
        borderWidth: 1, borderColor: "rgba(139, 92, 246, 0.2)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8,
      }}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", marginBottom: 4 }}>
          {t("upNext")}
        </Text>

        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 2 }}>
          {nextEpisode.Name}
        </Text>

        {episodeLabel && (
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>
            {episodeLabel}
          </Text>
        )}

        {/* Countdown progress bar */}
        <View style={{
          height: 3, backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 1.5, marginBottom: 12, overflow: "hidden",
        }}>
          <View style={{
            height: "100%", width: `${progress * 100}%`,
            backgroundColor: "#8b5cf6", borderRadius: 1.5,
          }} />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onPlay}
            style={{
              flex: 1, backgroundColor: "#8b5cf6", borderRadius: 8,
              paddingVertical: 8, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
              {t("playNow")} ({countdown}s)
            </Text>
          </Pressable>

          <Pressable
            onPress={onDismiss}
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center",
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
              {t("dismiss")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
