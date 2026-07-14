import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  show: boolean;
  /** Présent seulement sur le premier champ : bascule show/hide global. */
  onToggleShow?: () => void;
  toggleLabel?: string;
  autoComplete: "current-password" | "new-password";
}

/**
 * Champ mot de passe thémé : label + TextInput sécurisé + bouton œil optionnel.
 * `keyboardAppearance` suit le scheme pour que le clavier natif s'accorde.
 */
export function PasswordField({
  label,
  value,
  onChangeText,
  show,
  onToggleShow,
  toggleLabel,
  autoComplete,
}: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  return (
    <View>
      <Text style={st.label}>{label}</Text>
      <View style={st.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete={autoComplete}
          textContentType={autoComplete === "current-password" ? "password" : "newPassword"}
          keyboardAppearance={theme.scheme}
          placeholderTextColor={theme.colors.text.quaternary}
          style={st.input}
        />
        {onToggleShow ? (
          <Pressable
            onPress={onToggleShow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
            style={st.eye}
          >
            <Feather name={show ? "eye-off" : "eye"} size={18} color={theme.colors.text.tertiary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    label: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.medium,
      color: t.colors.text.tertiary,
      marginBottom: spacing.xs,
    },
    inputWrap: { position: "relative", justifyContent: "center" },
    input: {
      height: 46,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
      paddingHorizontal: spacing.md,
      paddingRight: 46,
      color: t.colors.text.primary,
      fontFamily: FONT_FAMILY.regular,
      fontSize: 15,
    },
    eye: {
      position: "absolute",
      right: 6,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
  });
