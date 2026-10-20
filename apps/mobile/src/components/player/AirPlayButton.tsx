import { Pressable, NativeModules, Platform, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { PLAYER } from "@/theme";

const { AirPlayModule } = NativeModules;

/**
 * AirPlay route picker button — iOS only.
 * Tapping opens the native AVRoutePickerView via AirPlayModule.showPicker().
 * Le pictogramme seul, blanc, comme les autres outils du lecteur (plus de boîte).
 */
export function AirPlaySection({ size = 20 }: { size?: number }) {
  if (Platform.OS !== "ios" || !AirPlayModule) return null;

  return (
    <Pressable
      onPress={() => AirPlayModule.showPicker()}
      hitSlop={8}
      style={styles.button}
      accessibilityLabel="AirPlay"
      accessibilityRole="button"
    >
      <Feather name="airplay" size={size} color={PLAYER.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 8 },
});
