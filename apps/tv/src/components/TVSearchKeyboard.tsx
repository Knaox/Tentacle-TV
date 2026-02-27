import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { Colors, Radius } from "../theme/colors";

const KEYS = [
  ["A", "B", "C", "D", "E", "F"],
  ["G", "H", "I", "J", "K", "L"],
  ["M", "N", "O", "P", "Q", "R"],
  ["S", "T", "U", "V", "W", "X"],
  ["Y", "Z", "1", "2", "3", "4"],
  ["5", "6", "7", "8", "9", "0"],
];

interface TVSearchKeyboardProps {
  query: string;
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

export function TVSearchKeyboard({ query, onKeyPress, onDelete, onClear }: TVSearchKeyboardProps) {
  const { t } = useTranslation("common");

  return (
    <View style={{ width: 272, paddingRight: 16 }}>
      {/* Query display — focusable so D-pad UP from keyboard reaches it, then RIGHT → results */}
      <Focusable onPress={onDelete} style={{ marginBottom: 16 }}>
        <View style={{
          backgroundColor: "rgba(255,255,255,0.06)", borderRadius: Radius.small,
          padding: 12, minHeight: 40,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>
            {query || " "}
            <Text style={{ color: Colors.accentPurple }}>|</Text>
          </Text>
        </View>
      </Focusable>

      {/* Keyboard grid */}
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
          {row.map((key) => (
            <Focusable key={key} onPress={() => onKeyPress(key.toLowerCase())}>
              <View style={{
                width: 36, height: 36, borderRadius: Radius.small,
                backgroundColor: "rgba(255,255,255,0.08)",
                justifyContent: "center", alignItems: "center",
              }}>
                <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: "600" }}>{key}</Text>
              </View>
            </Focusable>
          ))}
        </View>
      ))}

      {/* Special keys — more visible */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
        <Focusable onPress={() => onKeyPress(" ")}>
          <View style={{
            width: 78, height: 36, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: "500" }}>
              {t("space", { defaultValue: "Space" })}
            </Text>
          </View>
        </Focusable>
        <Focusable onPress={onDelete}>
          <View style={{
            width: 78, height: 36, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
            flexDirection: "row", gap: 4,
          }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>⌫</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 11, fontWeight: "500" }}>
              {t("delete", { defaultValue: "Delete" })}
            </Text>
          </View>
        </Focusable>
        <Focusable onPress={onClear}>
          <View style={{
            width: 78, height: 36, borderRadius: Radius.small,
            backgroundColor: "rgba(239,68,68,0.15)",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "600" }}>
              {t("clear", { defaultValue: "Clear" })}
            </Text>
          </View>
        </Focusable>
      </View>
    </View>
  );
}
