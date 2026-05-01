import { useEffect, useRef, useState, memo } from "react";
import { View, Image, AccessibilityInfo, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useAmbientFocus } from "../../contexts/AmbientFocusContext";
import { Colors, AmbientConfig } from "../../theme/colors";
import { Durations } from "../../theme/motion";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/**
 * Full-screen backdrop that fades to whatever item is currently focused.
 * The signature "ambient swap" feature: as the user navigates through cards
 * with the D-pad, the backdrop softly crossfades to the focused item's
 * Jellyfin Backdrop image.
 *
 * Disabled automatically when the user has Reduce Motion enabled in Android
 * accessibility settings.
 */
export const TVAmbientBackdrop = memo(function TVAmbientBackdrop() {
  const { focusedItem } = useAmbientFocus();
  const client = useJellyfinClient();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [layers, setLayers] = useState<{ a: MediaItem | null; b: MediaItem | null }>({
    a: null,
    b: null,
  });
  const aOpacity = useSharedValue(0);
  const bOpacity = useSharedValue(0);
  const activeLayerRef = useRef<"a" | "b">("a");

  // Detect reduce-motion preference + listen for changes.
  useEffect(() => {
    let unmounted = false;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!unmounted) setReduceMotion(rm);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (rm) => {
      if (!unmounted) setReduceMotion(rm);
    });
    return () => {
      unmounted = true;
      sub.remove();
    };
  }, []);

  // Crossfade when focusedItem changes.
  useEffect(() => {
    if (focusedItem == null) {
      // Fade everything out
      aOpacity.value = withTiming(0, { duration: AmbientConfig.crossfadeDuration });
      bOpacity.value = withTiming(0, { duration: AmbientConfig.crossfadeDuration });
      return;
    }

    const incomingLayer = activeLayerRef.current === "a" ? "b" : "a";
    setLayers((prev) => ({
      ...prev,
      [incomingLayer]: focusedItem,
    }));

    const dur = reduceMotion ? 0 : AmbientConfig.crossfadeDuration;
    if (incomingLayer === "a") {
      aOpacity.value = withTiming(AmbientConfig.imageOpacity, { duration: dur });
      bOpacity.value = withTiming(0, { duration: dur });
    } else {
      bOpacity.value = withTiming(AmbientConfig.imageOpacity, { duration: dur });
      aOpacity.value = withTiming(0, { duration: dur });
    }
    activeLayerRef.current = incomingLayer;
  }, [focusedItem, reduceMotion, aOpacity, bOpacity]);

  const aStyle = useAnimatedStyle(() => ({ opacity: aOpacity.value }));
  const bStyle = useAnimatedStyle(() => ({ opacity: bOpacity.value }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: SCREEN_W,
        height: SCREEN_H,
        zIndex: 0,
      }}
    >
      <Layer item={layers.a} client={client} style={aStyle} />
      <Layer item={layers.b} client={client} style={bStyle} />

      {/* Vertical scrim — keeps text content readable on top */}
      <LinearGradient
        colors={[
          `rgba(6, 6, 10, ${AmbientConfig.scrimOpacity})`,
          `rgba(6, 6, 10, ${AmbientConfig.scrimOpacity + 0.15})`,
          Colors.bgDeep,
        ]}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", inset: 0, width: SCREEN_W, height: SCREEN_H }}
      />
    </View>
  );
});

interface LayerProps {
  item: MediaItem | null;
  client: ReturnType<typeof useJellyfinClient>;
  style: ReturnType<typeof useAnimatedStyle>;
}

function Layer({ item, client, style }: LayerProps) {
  if (!item) return null;
  const backdropId = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  const uri = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 70 });

  return (
    <Animated.View style={[{ position: "absolute", inset: 0 }, style]}>
      <Image
        source={{ uri }}
        style={{ width: SCREEN_W, height: SCREEN_H }}
        resizeMode="cover"
        // Suppress error visuals — backdrop is decorative
        onError={() => {}}
      />
    </Animated.View>
  );
}
