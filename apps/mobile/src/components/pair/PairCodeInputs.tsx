import { forwardRef, useImperativeHandle, useRef } from "react";
import { View, TextInput, type TextStyle } from "react-native";
import { BRAND, FONT_FAMILY, RADIUS, STATUS } from "../../theme";

interface Props {
  chars: string[];
  onChange: (next: string[]) => void;
  status: "idle" | "pairing" | "success" | "error";
}

export interface PairCodeInputsHandle {
  focusFirst: () => void;
}

/**
 * 4 cases de saisie pour le code de pairing TV. Géré comme un controlled
 * input array, focus auto avance, retour sur backspace.
 */
export const PairCodeInputs = forwardRef<PairCodeInputsHandle, Props>(function PairCodeInputs(
  { chars, onChange, status }: Props,
  ref,
) {
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
                backgroundColor: "rgba(239,68,68,0.08)",
                borderWidth: 2,
                borderColor: STATUS.error,
              }
            : char
            ? {
                backgroundColor: BRAND.soft,
                borderWidth: 2,
                borderColor: BRAND.violet,
              }
            : {
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
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
            autoFocus={i === 0}
            accessibilityLabel={`Code digit ${i + 1}`}
            style={[
              {
                width: 60,
                height: 72,
                borderRadius: RADIUS.lg,
                textAlign: "center",
                fontSize: 28,
                fontFamily: FONT_FAMILY.extrabold,
                fontWeight: "800",
                color: "#FFFFFF",
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
