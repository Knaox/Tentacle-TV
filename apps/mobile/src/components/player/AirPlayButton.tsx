import { Pressable, NativeModules, Platform, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

const { AirPlayModule } = NativeModules;

/**
 * AirPlay route picker button — iOS only.
 * Tapping opens the native AVRoutePickerView via AirPlayModule.showPicker().
 * Renders a Feather "airplay" icon styled like other player controls.
 */
export function AirPlaySection() {
  if (Platform.OS !== "ios" || !AirPlayModule) return null;

  return (
    <Pressable
      onPress={() => AirPlayModule.showPicker()}
      style={styles.button}
      accessibilityLabel="AirPlay"
      accessibilityRole="button"
    >
      <Feather name="airplay" size={18} color="rgba(255,255,255,0.8)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
  },
});
