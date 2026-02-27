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
    <View style={{ width: 300, paddingRight: 24 }}>
      {/* Query display */}
      <View style={{
        backgroundColor: "rgba(255,255,255,0.04)", borderRadius: Radius.small,
        padding: 14, marginBottom: 20, minHeight: 48,
        borderWidth: 1, borderColor: Colors.glassBorder,
      }}>
        <Text style={{ color: Colors.textPrimary, fontSize: 18 }}>
          {query || " "}
          <Text style={{ color: Colors.accentPurple }}>|</Text>
        </Text>
      </View>

      {/* Keyboard grid */}
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          {row.map((key) => (
            <Focusable key={key} onPress={() => onKeyPress(key.toLowerCase())}>
              <View style={{
                width: 44, height: 44, borderRadius: Radius.small,
                backgroundColor: "rgba(255,255,255,0.06)",
                justifyContent: "center", alignItems: "center",
              }}>
                <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: "600" }}>{key}</Text>
              </View>
            </Focusable>
          ))}
        </View>
      ))}

      {/* Special keys */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Focusable onPress={() => onKeyPress(" ")}>
          <View style={{
            flex: 1, height: 44, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
              {t("space", { defaultValue: "Space" })}
            </Text>
          </View>
        </Focusable>
        <Focusable onPress={onDelete}>
          <View style={{
            width: 65, height: 44, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 18 }}>⌫</Text>
          </View>
        </Focusable>
        <Focusable onPress={onClear}>
          <View style={{
            width: 72, height: 44, borderRadius: Radius.small,
            backgroundColor: "rgba(239,68,68,0.1)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: Colors.error, fontSize: 14, fontWeight: "600" }}>
              {t("clear", { defaultValue: "Clear" })}
            </Text>
          </View>
        </Focusable>
      </View>
    </View>
  );
}
