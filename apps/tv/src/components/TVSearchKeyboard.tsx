import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { MicIcon } from "./icons/TVIcons";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
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
  onVoiceResult?: (text: string) => void;
}

export function TVSearchKeyboard({ query, onKeyPress, onDelete, onClear, onVoiceResult }: TVSearchKeyboardProps) {
  const { t } = useTranslation("common");

  const { isListening, isPending, isAvailable, startListening, stopListening } = useSpeechRecognition({
    onResult: (text) => onVoiceResult?.(text),
  });

  const micBg = isListening
    ? Colors.accentPurple
    : isPending
      ? "rgba(139,92,246,0.3)"
      : "rgba(255,255,255,0.08)";

  return (
    <View style={{ width: 260 }}>
      {/* Query row with mic icon */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Focusable variant="button" onPress={onDelete} style={{ flex: 1 }}>
          <View style={{
            backgroundColor: "rgba(255,255,255,0.06)", borderRadius: Radius.small,
            padding: 10, minHeight: 40,
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 14 }}>
              {query || " "}
              <Text style={{ color: Colors.accentPurple }}>|</Text>
            </Text>
          </View>
        </Focusable>

        {isAvailable && (
          <Focusable variant="button" onPress={isListening ? stopListening : startListening}>
            <View style={{
              width: 40, height: 40, borderRadius: Radius.small,
              backgroundColor: micBg,
              justifyContent: "center", alignItems: "center",
            }}>
              <MicIcon size={20} color={isListening || isPending ? "#fff" : Colors.textPrimary} />
            </View>
          </Focusable>
        )}
      </View>

      {/* Keyboard grid */}
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
          {row.map((key, keyIdx) => (
            <Focusable key={key} variant="button" onPress={() => onKeyPress(key.toLowerCase())} hasTVPreferredFocus={rowIdx === 0 && keyIdx === 0}>
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

      {/* Special keys */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
        <Focusable variant="button" onPress={() => onKeyPress(" ")}>
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
        <Focusable variant="button" onPress={onDelete}>
          <View style={{
            width: 78, height: 36, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
            flexDirection: "row", gap: 4,
          }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 14 }}>&#x232B;</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: "500" }}>
              {t("delete", { defaultValue: "Delete" })}
            </Text>
          </View>
        </Focusable>
        <Focusable variant="button" onPress={onClear}>
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
