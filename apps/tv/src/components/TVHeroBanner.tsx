import { useState, useEffect, useRef } from "react";
import { View, Text, Image, Animated, Dimensions } from "react-native";
import { useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { Focusable } from "./focus/Focusable";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TVHeroBannerProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onDetail: (item: MediaItem) => void;
}

export function TVHeroBanner({ items, onPlay, onDetail }: TVHeroBannerProps) {
  const client = useJellyfinClient();
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % items.length);
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [items.length, opacity]);

  if (items.length === 0) return null;
  const item = items[index];
  const backdrop = client.getImageUrl(item.Id, "Backdrop", { width: 1920, quality: 80 });

  return (
    <Animated.View style={{ width: SCREEN_WIDTH, height: 500, opacity }}>
      <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />
      {/* Gradient overlay */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 300,
        backgroundColor: "transparent",
      }}>
        <View style={{ flex: 1, background: "linear-gradient(transparent, #0a0a0f)" }} />
      </View>
      {/* Content */}
      <View style={{ position: "absolute", bottom: 48, left: 48, right: 200 }}>
        <Text style={{ color: "#fff", fontSize: 38, fontWeight: "800" }} numberOfLines={1}>
          {item.Name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
          {item.ProductionYear && (
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>{item.ProductionYear}</Text>
          )}
          {item.Genres?.slice(0, 3).map((g) => (
            <Text key={g} style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{g}</Text>
          ))}
        </View>
        {item.Overview && (
          <Text numberOfLines={3} style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, marginTop: 12, lineHeight: 24 }}>
            {item.Overview}
          </Text>
        )}
        <View style={{ flexDirection: "row", gap: 16, marginTop: 20 }}>
          <Focusable onPress={() => onPlay(item)} hasTVPreferredFocus>
            <View style={{ backgroundColor: "#8b5cf6", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Lecture</Text>
            </View>
          </Focusable>
          <Focusable onPress={() => onDetail(item)}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>Plus d'infos</Text>
            </View>
          </Focusable>
        </View>
      </View>
    </Animated.View>
  );
}
