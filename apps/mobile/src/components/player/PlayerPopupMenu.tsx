import { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, Animated, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { PLAYER } from "@/theme";
import { parseTrackLabel } from "../../lib/playerUtils";

export interface PopupBadge {
  label: string;
  tone?: "purple" | "amber" | "zinc";
}

export interface PopupOption {
  key: string | number;
  label: string;
  active: boolean;
  /** Suffixe gris affiché à droite du label (ex. "— 4K"). */
  suffix?: string;
  /** Chips colorés affichés inline (HDR, DV, Atmos). */
  badges?: PopupBadge[];
  /** Chip aligné à droite (typiquement le débit "30 Mbps"). */
  rightChip?: { label: string; tone?: "purple" | "amber" | "zinc" };
}

export interface PopupSection {
  title: string;
  options: PopupOption[];
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
        backgroundColor: PLAYER.controlBgHeavy,
        borderWidth: 1, borderColor: PLAYER.borderSubtle,
        overflow: "hidden",
        opacity, transform: [{ translateY }],
      }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: PLAYER.text }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 2 }}>
            <X size={16} color={PLAYER.textDim} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Math.min(300, screenH * 0.5) }}>
          {sections.map((section) => (
            <View key={section.title} style={{ paddingTop: 12, marginBottom: 10 }}>
              <Text style={{
                fontSize: 10, fontWeight: "600", textTransform: "uppercase",
                letterSpacing: 1, color: PLAYER.textDim, marginBottom: 6,
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
                  suffix={opt.suffix}
                  badges={opt.badges}
                  rightChip={opt.rightChip}
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

function OptionRow({
  label, active, suffix, badges, rightChip, onPress,
}: {
  label: string;
  active: boolean;
  suffix?: string;
  badges?: PopupBadge[];
  rightChip?: { label: string; tone?: "purple" | "amber" | "zinc" };
  onPress: () => void;
}) {
  const { title, lang, codec } = parseTrackLabel(label);

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
        backgroundColor: active ? PLAYER.accentSoft : "transparent",
      }}
    >
      <View style={{
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: active ? PLAYER.accent : "transparent",
      }} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, color: active ? PLAYER.accentLight : PLAYER.textSecondary }}
        >
          {title}
        </Text>
        {suffix && (
          <Text numberOfLines={1} style={{ fontSize: 13, color: PLAYER.textDim }}>
            {suffix}
          </Text>
        )}
        {badges?.map((b, i) => <Chip key={`${b.label}-${i}`} label={b.label} tone={b.tone ?? "purple"} />)}
      </View>
      {lang && <Chip label={lang} tone="purple" />}
      {codec && <Chip label={codec} tone="zinc" />}
      {rightChip && <Chip label={rightChip.label} tone={rightChip.tone ?? "zinc"} />}
    </Pressable>
  );
}

function Chip({ label, tone }: { label: string; tone: "purple" | "amber" | "zinc" }) {
  const palette = tone === "purple"
    ? { bg: PLAYER.accentSoft, fg: PLAYER.accentChip }
    : tone === "amber"
      ? { bg: PLAYER.warningSoft, fg: PLAYER.warning }
      : { bg: PLAYER.borderSubtle, fg: PLAYER.textTertiary };
  return (
    <Text style={{
      backgroundColor: palette.bg, color: palette.fg,
      fontSize: 10, fontWeight: "600",
      paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, overflow: "hidden",
    }}>
      {label}
    </Text>
  );
}
