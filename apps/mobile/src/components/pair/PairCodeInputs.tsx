import { forwardRef, useImperativeHandle, useRef } from "react";
import { View, TextInput, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, useTheme } from "../../theme";

interface Props {
  chars: string[];
  onChange: (next: string[]) => void;
  status: "idle" | "pairing" | "success" | "error";
  /** Le clavier s'ouvre sur la première case (défaut) ; non quand l'écran a d'autres usages. */
  autoFocus?: boolean;
}

export interface PairCodeInputsHandle {
  focusFirst: () => void;
}

/**
 * 4 cases de saisie pour le code de pairing TV. Géré comme un controlled
 * input array, focus auto avance, retour sur backspace.
 */
export const PairCodeInputs = forwardRef<PairCodeInputsHandle, Props>(function PairCodeInputs(
  { chars, onChange, status, autoFocus = true }: Props,
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation("pairing");
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useImperativeHandle(ref, () => ({
    focusFirst: () => inputRefs.current[0]?.focus(),
  }));

  const handleChange = (index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const next = [...chars];
    next[index] = char;
    onChange(next);
    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !chars[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={{
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
      marginBottom: 20,
    }}>
      {chars.map((char, i) => {
        const stateStyle: TextStyle =
          status === "error"
            ? {
                backgroundColor: colors.danger.surface,
                borderWidth: 2,
                borderColor: colors.status.error,
              }
            : char
            ? {
                backgroundColor: colors.brand.soft,
                borderWidth: 2,
                borderColor: colors.brand.violet,
              }
            : {
                backgroundColor: colors.fill.subtle,
                borderWidth: 1,
                borderColor: colors.border.subtle,
              };

        return (
          <TextInput
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            value={char}
            onChangeText={(v) => handleChange(i, v)}
            onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
            maxLength={1}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={status !== "pairing"}
            autoFocus={autoFocus && i === 0}
            accessibilityLabel={t("codeCharacter", { index: i + 1 })}
            style={[
              {
                width: 60,
                height: 72,
                borderRadius: RADIUS.lg,
                textAlign: "center",
                fontSize: 28,
                fontFamily: FONT_FAMILY.extrabold,
                fontWeight: "800",
                color: colors.text.primary,
                letterSpacing: 0,
              },
              stateStyle,
            ]}
          />
        );
      })}
    </View>
  );
});
