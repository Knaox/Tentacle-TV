import { View, Text, TextInput, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { MicIcon, SpaceIcon, BackspaceIcon, CloseIcon } from "./icons/TVIcons";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { Colors, Radius } from "../theme/colors";

// tvOS : Apple ne donne AUCUN accès micro programmatique aux apps tierces
// (erreur 'nohw' au runtime, AVAudioSession record indispo). La SEULE dictée
// possible passe par le clavier SYSTÈME : un TextInput natif focusé l'ouvre en
// plein écran, et l'utilisateur maintient le bouton micro de la Siri Remote pour
// dicter. Android TV, lui, autorise le micro → bouton inline (useSpeechRecognition).
const IS_TVOS = Platform.OS === "ios";

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
  /** Remplace toute la query (clavier système tvOS / dictée). */
  onSetQuery?: (text: string) => void;
}

export function TVSearchKeyboard({ query, onKeyPress, onDelete, onClear, onVoiceResult, onSetQuery }: TVSearchKeyboardProps) {
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
      {/* Query row */}
      {IS_TVOS ? (
        // tvOS : TextInput natif → sélectionner ouvre le clavier système plein
        // écran ; là, hold du bouton micro Siri Remote = dictée. La grille reste
        // dispo en dessous pour la saisie au pad. Champ contrôlé par `query`.
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
          backgroundColor: "rgba(255,255,255,0.06)", borderRadius: Radius.small,
          paddingHorizontal: 10, minHeight: 44,
          borderWidth: 1, borderColor: Colors.glassBorder,
        }}>
          <MicIcon size={18} color={Colors.accentPurpleLight} />
          <TextInput
            value={query}
            onChangeText={onSetQuery}
            placeholder={t("voiceOrType")}
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, color: Colors.textPrimary, fontSize: 20, fontWeight: "300", paddingVertical: 8 }}
          />
        </View>
      ) : (
        // Android TV : accès micro réel → bouton inline (useSpeechRecognition).
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Focusable variant="button" onPress={onDelete} style={{ flex: 1 }}>
            <View style={{
              backgroundColor: "rgba(255,255,255,0.06)", borderRadius: Radius.small,
              padding: 10, minHeight: 40,
              borderWidth: 1, borderColor: Colors.glassBorder,
            }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "300" }}>
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
      )}

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

      {/* Special keys — icônes seules (labels via accessibilité, pas de texte UI) */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
        <Focusable variant="button" onPress={() => onKeyPress(" ")} accessibilityLabel={t("space")}>
          <View style={{
            width: 78, height: 36, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
          }}>
            <SpaceIcon size={20} color={Colors.textPrimary} />
          </View>
        </Focusable>
        <Focusable variant="button" onPress={onDelete} accessibilityLabel={t("delete")}>
          <View style={{
            width: 78, height: 36, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
          }}>
            <BackspaceIcon size={20} color={Colors.textPrimary} />
          </View>
        </Focusable>
        <Focusable variant="button" onPress={onClear} accessibilityLabel={t("clear")}>
          <View style={{
            width: 78, height: 36, borderRadius: Radius.small,
            backgroundColor: "rgba(239,68,68,0.15)",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
            justifyContent: "center", alignItems: "center",
          }}>
            <CloseIcon size={18} color="#f87171" />
          </View>
        </Focusable>
      </View>
    </View>
  );
}
