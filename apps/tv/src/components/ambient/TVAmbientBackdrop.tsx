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

  // Couche en attente : le crossfade ne démarre qu'au CHARGEMENT de l'image
  // (sinon la couche devient visible avant l'image → le fond paraît « en
  // retard » sur la sélection).
  const pendingLayerRef = useRef<"a" | "b" | null>(null);
  const pendingItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusedItem == null) {
      pendingLayerRef.current = null;
      pendingItemIdRef.current = null;
      aOpacity.value = withTiming(0, { duration: AmbientConfig.crossfadeDuration });
      bOpacity.value = withTiming(0, { duration: AmbientConfig.crossfadeDuration });
      return;
    }
    const incomingLayer = activeLayerRef.current === "a" ? "b" : "a";
    pendingLayerRef.current = incomingLayer;
    pendingItemIdRef.current = focusedItem.Id;
    setLayers((prev) => ({ ...prev, [incomingLayer]: focusedItem }));
  }, [focusedItem, aOpacity, bOpacity]);

  const handleLayerLoaded = (layer: "a" | "b", itemId: string) => {
    // Ignore les onLoad obsolètes (la sélection a déjà changé)
    if (pendingLayerRef.current !== layer || pendingItemIdRef.current !== itemId) return;
    const dur = reduceMotion ? 0 : AmbientConfig.crossfadeDuration;
    if (layer === "a") {
      aOpacity.value = withTiming(AmbientConfig.imageOpacity, { duration: dur });
      bOpacity.value = withTiming(0, { duration: dur });
    } else {
      bOpacity.value = withTiming(AmbientConfig.imageOpacity, { duration: dur });
      aOpacity.value = withTiming(0, { duration: dur });
    }
    activeLayerRef.current = layer;
    pendingLayerRef.current = null;
  };

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
      <Layer item={layers.a} client={client} style={aStyle} onLoaded={(id) => handleLayerLoaded("a", id)} />
      <Layer item={layers.b} client={client} style={bStyle} onLoaded={(id) => handleLayerLoaded("b", id)} />

      {/* Vertical scrim — keeps text content readable on top */}
      <LinearGradient
        colors={[
          `rgba(0, 0, 0, ${AmbientConfig.scrimOpacity})`,
          `rgba(0, 0, 0, ${AmbientConfig.scrimOpacity + 0.15})`,
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
  /** Signale que l'image de CET item est chargée (déclenche le crossfade). */
  onLoaded: (itemId: string) => void;
}

function Layer({ item, client, style, onLoaded }: LayerProps) {
  if (!item) return null;
  const backdropId = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  const uri = client.getImageUrl(backdropId, "Backdrop", { width: 1280, quality: 70 });

  return (
    <Animated.View style={[{ position: "absolute", inset: 0 }, style]}>
      <Image
        source={{ uri }}
        style={{ width: SCREEN_W, height: SCREEN_H }}
        resizeMode="cover"
        onLoad={() => onLoaded(item.Id)}
        // Suppress error visuals — backdrop is decorative
        onError={() => {}}
      />
    </Animated.View>
  );
}
