import { memo, useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Icon } from "../../icons/Icon";
import { colors, fonts } from "../../theme/tokens";
import { FIELD } from "./PairingField";

/**
 * L'erreur d'une étape du jumelage, sous ses champs : le pictogramme d'alerte
 * et la phrase qui dit quoi faire — rouge, mais jamais par la couleur seule.
 * Elle entre en fondu et VoiceOver la lit à son arrivée : elle n'est pas
 * focalisable, rien ne la désigne autrement.
 */
export const PairingError = memo(function PairingError({ message }: { message: string }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.error} accessibilityRole="alert">
      <Icon name="alert" size={30} color={colors.errorFg} strokeWidth={2.4} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  error: {
    width: FIELD.width,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 28,
    paddingVertical: 22,
    paddingHorizontal: 30,
    borderRadius: 26,
    backgroundColor: "rgba(239, 68, 68, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.42)",
  },
  text: { ...fonts.medium, flex: 1, fontSize: 26, lineHeight: 36, color: colors.text },
});
