import { View, Text } from "react-native";
import { Focusable } from "./focus/Focusable";

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
  return (
    <View style={{ width: 280, paddingRight: 24 }}>
      {/* Current query display */}
      <View style={{
        backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 12,
        marginBottom: 16, minHeight: 44, borderWidth: 1, borderColor: "#1e1e2e",
      }}>
        <Text style={{ color: "#fff", fontSize: 18 }}>
          {query || " "}
          <Text style={{ color: "#8b5cf6" }}>|</Text>
        </Text>
      </View>

      {/* Keyboard grid */}
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
          {row.map((key) => (
            <Focusable key={key} onPress={() => onKeyPress(key.toLowerCase())}>
              <View style={{
                width: 42, height: 42, borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.08)",
                justifyContent: "center", alignItems: "center",
              }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{key}</Text>
              </View>
            </Focusable>
          ))}
        </View>
      ))}

      {/* Special keys */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
        <Focusable onPress={() => onKeyPress(" ")}>
          <View style={{
            flex: 1, height: 42, borderRadius: 6,
            backgroundColor: "rgba(255,255,255,0.08)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: "#fff", fontSize: 14 }}>Espace</Text>
          </View>
        </Focusable>
        <Focusable onPress={onDelete}>
          <View style={{
            width: 65, height: 42, borderRadius: 6,
            backgroundColor: "rgba(255,255,255,0.08)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: "#fff", fontSize: 14 }}>⌫</Text>
          </View>
        </Focusable>
        <Focusable onPress={onClear}>
          <View style={{
            width: 65, height: 42, borderRadius: 6,
            backgroundColor: "rgba(239,68,68,0.15)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: "#ef4444", fontSize: 14 }}>Effacer</Text>
          </View>
        </Focusable>
      </View>
    </View>
  );
}
