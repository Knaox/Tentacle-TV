import { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, Animated, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { parseTrackLabel } from "../../lib/playerUtils";

export interface PopupSection {
  title: string;
  options: { key: string | number; label: string; active: boolean }[];
  onSelect: (key: string | number) => void;
  showDisabled?: { label: string; active: boolean; onSelect: () => void };
}

interface Props {
  visible: boolean;
  title: string;
  sections: PopupSection[];
  onClose: () => void;
}

export function PlayerPopupMenu({ visible, title, sections, onClose }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(10);
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      {/* Backdrop */}
      <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* Popup */}
      <Animated.View style={{
        position: "absolute", bottom: 80, right: Math.min(12, screenW * 0.03),
        width: Math.min(280, screenW - 32), borderRadius: 12, padding: 14,
        backgroundColor: "rgba(0,0,0,0.9)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
        overflow: "hidden",
        opacity, transform: [{ translateY }],
      }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 2 }}>
            <X size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Math.min(300, screenH * 0.5) }}>
          {sections.map((section) => (
            <View key={section.title} style={{ paddingTop: 12, marginBottom: 10 }}>
              <Text style={{
                fontSize: 10, fontWeight: "600", textTransform: "uppercase",
                letterSpacing: 1, color: "rgba(255,255,255,0.4)", marginBottom: 6,
              }}>
                {section.title}
              </Text>

              {section.showDisabled && (
                <OptionRow
                  label={section.showDisabled.label}
                  active={section.showDisabled.active}
                  onPress={section.showDisabled.onSelect}
                />
              )}

              {section.options.map((opt) => (
                <OptionRow
                  key={opt.key}
                  label={opt.label}
                  active={opt.active}
                  onPress={() => section.onSelect(opt.key)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function OptionRow({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { title, lang, codec } = parseTrackLabel(label);

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
        backgroundColor: active ? "rgba(139,92,246,0.2)" : "transparent",
      }}
    >
      <View style={{
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: active ? "#8b5cf6" : "transparent",
      }} />
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontSize: 13, color: active ? "#a78bfa" : "rgba(255,255,255,0.7)" }}
      >
        {title}
      </Text>
      {lang && (
        <Text style={{
          backgroundColor: "rgba(139,92,246,0.2)", color: "#c4b5fd",
          fontSize: 10, fontWeight: "600",
          paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3,
          overflow: "hidden",
        }}>
          {lang}
        </Text>
      )}
      {codec && (
        <Text style={{
          backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)",
          fontSize: 10, fontWeight: "600",
          paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3,
          overflow: "hidden",
        }}>
          {codec}
        </Text>
      )}
    </Pressable>
  );
}
