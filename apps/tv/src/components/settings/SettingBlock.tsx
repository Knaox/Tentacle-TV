import { Text, View } from "react-native";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

export interface Choice {
  value: string;
  label: string;
}

/**
 * Un réglage à choix : un titre, une phrase d'explication, une rangée de
 * boutons dont l'actif se cerne de la teinte de marque.
 *
 * Pas d'interrupteur à glissière : il n'en existe aucun dans l'application, et
 * un pouce qui coulisse ne veut rien dire sans doigt pour le pousser. Des
 * boutons, comme la langue d'interface.
 */
export function SettingBlock({ title, hint, value, choices, onChoose }: {
  title: string;
  hint: string;
  value: string;
  choices: Choice[];
  onChoose: (value: string) => void;
}) {
  return (
    <View style={{ marginBottom: 36 }}>
      <Text style={{
        color: Colors.textTertiary, fontSize: 13, fontWeight: "600",
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
      }}>
        {title}
      </Text>
      <Text style={{
        color: Colors.textTertiary, fontSize: 15, lineHeight: 22,
        maxWidth: 900, marginBottom: 14,
      }}>
        {hint}
      </Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {choices.map((c) => {
          const selected = value === c.value;
          return (
            <Focusable
              key={c.value}
              variant="button"
              focusRadius={Button.medium.borderRadius}
              scaleOverride={1.04}
              onPress={() => { onChoose(c.value); }}
              accessibilityLabel={c.label}
            >
              <View style={{
                minWidth: 160,
                alignItems: "center",
                ...Button.medium,
                borderWidth: 1,
                borderColor: selected ? brandAlpha(0.6) : Colors.glassBorder,
                backgroundColor: selected ? brandAlpha(0.18) : "transparent",
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}>
                <Text style={{
                  color: selected ? Colors.accentPurpleLight : Colors.textPrimary,
                  fontSize: 17,
                  fontWeight: "600",
                }}>
                  {c.label}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}
