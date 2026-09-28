import { forwardRef, useState, type ComponentProps } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, useTheme } from "@/theme";

type FeatherName = ComponentProps<typeof Feather>["name"];

interface AuthTextFieldProps extends Omit<TextInputProps, "style" | "secureTextEntry"> {
  label: string;
  /** Pictogramme Feather à gauche — décoratif, le libellé porte le sens. */
  icon?: FeatherName;
  hint?: string;
  error?: string | null;
  /** Mot de passe : saisie masquée + bouton afficher / masquer. */
  password?: boolean;
  monospace?: boolean;
}

const MONOSPACE = "Menlo";

/**
 * Le champ des écrans d'avant connexion : libellé TOUJOURS visible au-dessus
 * (le placeholder seul disparaît dès la première lettre), bordure de marque au
 * focus, erreur sous le champ avec icône — jamais la couleur seule.
 */
export const AuthTextField = forwardRef<TextInput, AuthTextFieldProps>(function AuthTextField(
  { label, icon, hint, error, password = false, monospace = false, onFocus, onBlur, ...input },
  ref,
) {
  const { t } = useTranslation("auth");
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? colors.status.error : focused ? colors.brand.violet : colors.border.subtle;

  return (
    <View>
      <Text
        style={{ color: colors.text.secondary, fontSize: 13, fontFamily: FONT_FAMILY.medium, marginBottom: 6 }}
        accessible={false}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 50,
          borderRadius: RADIUS.lg,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: colors.fill.subtle,
        }}
      >
        {icon && (
          <Feather name={icon} size={18} color={focused ? colors.brand.light : colors.text.quaternary} style={{ marginLeft: 14 }} />
        )}
        <TextInput
          ref={ref}
          {...input}
          secureTextEntry={password && !revealed}
          placeholderTextColor={colors.text.quaternary}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={{
            flex: 1,
            minHeight: 48,
            paddingLeft: icon ? 10 : 16,
            paddingRight: password ? 4 : 16,
            color: colors.text.primary,
            fontSize: 16,
            fontFamily: monospace ? MONOSPACE : FONT_FAMILY.regular,
            letterSpacing: monospace ? 0.5 : 0,
          }}
        />
        {password && (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t("hidePassword") : t("showPassword")}
            accessibilityState={{ selected: revealed }}
            hitSlop={4}
            style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name={revealed ? "eye-off" : "eye"} size={18} color={colors.text.tertiary} />
          </Pressable>
        )}
      </View>
      {!!error && (
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 6, gap: 6 }}>
          <Feather name="alert-circle" size={14} color={colors.statusPairs.error.fg} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: colors.statusPairs.error.fg, fontSize: 13, fontFamily: FONT_FAMILY.medium }}>{error}</Text>
        </View>
      )}
      {!!hint && (
        <Text style={{ color: colors.text.tertiary, fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.regular, marginTop: 6 }}>
          {hint}
        </Text>
      )}
    </View>
  );
});
