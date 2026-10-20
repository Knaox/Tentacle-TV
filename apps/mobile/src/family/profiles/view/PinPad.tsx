import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FAMILY_PIN_LENGTH, type PinDigit } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { FamilyAvatar } from "../../FamilyAvatar";
import type { PickPin } from "../usePickFlow";
import { PlainButton } from "@/components/ui/buttons";

const ROWS: readonly (readonly (PinDigit | "erase" | null)[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [null, "0", "erase"],
];
const KEY = 72;

interface PinPadProps {
  pin: PickPin;
  onDigit: (digit: PinDigit) => void;
  onErase: () => void;
  onBack: () => void;
}

/**
 * Le pavé du code PIN d'un profil : quatre points, le pavé du téléphone, la
 * phrase du serveur (essais restants, blocage). Le quatrième chiffre part au
 * serveur (`usePickFlow`) : rien n'est comparé ici, rien n'est gardé.
 */
export const PinPad = memo(function PinPad({ pin, onDigit, onErase, onBack }: PinPadProps) {
  const { t } = useTranslation("profilePicker");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { entry, profile, message } = pin;
  const checking = entry.phase === "checking";
  const locked = entry.phase === "locked";
  const filled = entry.phase === "wrong" ? 0 : entry.digits.length;

  return (
    <View style={st.wrap}>
      <FamilyAvatar userId={profile.userId} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={72} />
      <Text style={st.title} accessibilityRole="header">{t("pin.title", { name: profile.name })}</Text>
      <Text style={st.prompt}>{t("pin.prompt")}</Text>

      <View style={st.dots} accessible accessibilityLabel={t("pin.progress", { count: filled })}>
        {Array.from({ length: FAMILY_PIN_LENGTH }, (_, index) => (
          <View key={index} style={[st.dot, index < filled && { backgroundColor: theme.colors.brand.light, borderColor: theme.colors.brand.light }]} />
        ))}
      </View>
      <View style={st.messageRow}>
        {checking ? <ActivityIndicator color={theme.colors.text.secondary} /> : null}
        <Text style={[st.message, (entry.phase === "wrong" || locked) && { color: theme.colors.status.error }]} accessibilityLiveRegion="polite">
          {checking ? t("pin.checking") : message ?? ""}
        </Text>
      </View>

      <View style={st.pad} accessibilityLabel={t("pin.keypad")}>
        {ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={st.row}>
            {row.map((key, keyIndex) => {
              if (key === null) return <View key={keyIndex} style={st.key} />;
              const disabled = checking || locked;
              if (key === "erase") {
                return (
                  <Pressable key={keyIndex} onPress={onErase} disabled={disabled} accessibilityRole="button" accessibilityLabel={t("pin.erase")}
                    style={({ pressed }) => [st.key, st.keyGhost, pressed && st.keyPressed, disabled && st.dim]}>
                    <Feather name="delete" size={24} color={theme.colors.text.primary} />
                  </Pressable>
                );
              }
              return (
                <Pressable key={keyIndex} onPress={() => onDigit(key)} disabled={disabled} accessibilityRole="button" accessibilityLabel={t("pin.digit", { digit: key })}
                  style={({ pressed }) => [st.key, pressed && st.keyPressed, disabled && st.dim]}>
                  <Text style={st.keyText}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <PlainButton icon="chevron-left" label={t("pin.back")} onPress={onBack} disabled={checking} style={st.back} />
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { alignItems: "center", width: "100%" },
    title: { ...typography.subtitle, color: t.colors.text.primary, textAlign: "center", marginTop: spacing.md },
    prompt: { ...typography.body, color: t.colors.text.secondary, textAlign: "center", marginTop: spacing.xs },
    dots: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: t.colors.text.tertiary },
    messageRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md },
    message: { ...typography.body, color: t.colors.text.secondary, textAlign: "center" },
    pad: { gap: spacing.md, marginTop: spacing.sm },
    row: { flexDirection: "row", gap: spacing.lg },
    key: {
      width: KEY,
      height: KEY,
      borderRadius: KEY / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    keyGhost: { backgroundColor: "transparent", borderColor: "transparent" },
    keyPressed: { backgroundColor: t.colors.fill.medium },
    keyText: { fontSize: 28, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    dim: { opacity: 0.45 },
    back: { marginTop: spacing.lg },
  });
