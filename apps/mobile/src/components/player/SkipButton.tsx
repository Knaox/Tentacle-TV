import { View, Pressable, Text, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { ChevronRight } from "lucide-react-native";

interface Props {
  label: string;
  onPress: () => void;
  bottom: number;
  right: number;
  showChevron?: boolean;
}

/**
 * Skip Intro / Next Episode / Skip Credits — design aligné desktop
 * (apps/web VideoPlayer L717-727) : bg black/60 + border white/20 +
 * backdrop-blur 24 + rounded 8 + px-5 py-2.5 + text-sm font-semibold.
 * Adapté mobile : safe-area aware, touch ≥44pt via minHeight.
 */
export function SkipButton({ label, onPress, bottom, right, showChevron }: Props) {
  return (
    <View style={{ position: "absolute", bottom, right, zIndex: 50 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [st.btn, pressed && { opacity: 0.82 }]}
        hitSlop={8}
      >
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.6)" }]} />
        <Text style={st.label} numberOfLines={1}>{label}</Text>
        {showChevron && <ChevronRight size={16} color="#fff" />}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    overflow: "hidden",
  },
  label: { color: "#fff", fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },
});
