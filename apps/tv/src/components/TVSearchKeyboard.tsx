import { memo, useCallback } from "react";
import { View, Text, Platform } from "react-native";
import type { View as RNView } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { MicIcon, SpaceIcon, BackspaceIcon, CloseIcon } from "./icons/TVIcons";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { Colors, brandAlpha } from "../theme/colors";
import { Button } from "../theme/buttons";

const KEYS = [
  ["A", "B", "C", "D", "E", "F"],
  ["G", "H", "I", "J", "K", "L"],
  ["M", "N", "O", "P", "Q", "R"],
  ["S", "T", "U", "V", "W", "X"],
  ["Y", "Z", "1", "2", "3", "4"],
  ["5", "6", "7", "8", "9", "0"],
];

/** Une touche se lit à trois mètres : 56 pt, et 8 pt d'écart pour que
 *  l'anneau de focus ne touche pas la voisine. */
export const KEY_SIZE = 56;
export const KEY_GAP = 8;
/** Largeur du clavier — la colonne de gauche s'aligne dessus. */
export const KEYBOARD_WIDTH = KEY_SIZE * 6 + KEY_GAP * 5;

// tvOS : aucun micro pour les apps tierces — la dictée passe par le clavier
// SYSTÈME (la barre, cf. TVSearchBar). Android TV autorise le micro : une
// touche dédiée, dans la rangée spéciale.
const IS_TVOS = Platform.OS === "ios";

interface TVSearchKeyboardProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onVoiceResult?: (text: string) => void;
  /** Publie la 1ʳᵉ touche : entrée de l'écran (rail) et retour du clavier système. */
  entryRef?: (node: RNView | null) => void;
}

export const TVSearchKeyboard = memo(function TVSearchKeyboard({
  onKeyPress, onDelete, onClear, onVoiceResult, entryRef,
}: TVSearchKeyboardProps) {
  const { t } = useTranslation(["common", "search"]);
  const { isListening, isPending, isAvailable, startListening, stopListening } = useSpeechRecognition({
    onResult: (text) => onVoiceResult?.(text),
  });
  const showMic = !IS_TVOS && isAvailable;
  const specialWidth = (KEYBOARD_WIDTH - KEY_GAP * (showMic ? 3 : 2)) / (showMic ? 4 : 3);

  return (
    <View style={{ width: KEYBOARD_WIDTH }}>
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", gap: KEY_GAP, marginBottom: KEY_GAP }}>
          {row.map((key, keyIdx) => (
            <KeyCell
              key={key}
              label={key}
              first={rowIdx === 0 && keyIdx === 0}
              entryRef={entryRef}
              onKeyPress={onKeyPress}
            />
          ))}
        </View>
      ))}

      {/* Rangée spéciale — icônes seules, libellés pour l'accessibilité. */}
      <View style={{ flexDirection: "row", gap: KEY_GAP }}>
        <SpecialKey width={specialWidth} label={t("common:space")} onPress={() => onKeyPress(" ")}>
          <SpaceIcon size={24} color={Colors.textPrimary} />
        </SpecialKey>
        <SpecialKey width={specialWidth} label={t("common:delete")} onPress={onDelete}>
          <BackspaceIcon size={24} color={Colors.textPrimary} />
        </SpecialKey>
        <SpecialKey width={specialWidth} label={t("search:clear")} onPress={onClear} danger>
          <CloseIcon size={22} color="#f87171" />
        </SpecialKey>
        {showMic && (
          <SpecialKey
            width={specialWidth}
            label={t("common:voiceOrType")}
            onPress={isListening ? stopListening : startListening}
            active={isListening || isPending}
          >
            <MicIcon size={24} color={isListening || isPending ? "#fff" : Colors.textPrimary} />
          </SpecialKey>
        )}
      </View>
    </View>
  );
});

const KeyCell = memo(function KeyCell({ label, first, entryRef, onKeyPress }: {
  label: string;
  first: boolean;
  entryRef?: (node: RNView | null) => void;
  onKeyPress: (key: string) => void;
}) {
  const press = useCallback(() => onKeyPress(label.toLowerCase()), [label, onKeyPress]);
  return (
    <Focusable
      ref={first ? entryRef : undefined}
      variant="button"
      focusRadius={Button.small.borderRadius}
      onPress={press}
      hasTVPreferredFocus={first}
      accessibilityLabel={label}
    >
      <View style={{
        width: KEY_SIZE, height: KEY_SIZE, ...Button.small,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center", alignItems: "center",
      }}>
        <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: "600" }}>{label}</Text>
      </View>
    </Focusable>
  );
});

function SpecialKey({ width, label, onPress, danger, active, children }: {
  width: number;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Focusable variant="button" focusRadius={Button.small.borderRadius} onPress={onPress} accessibilityLabel={label}>
      <View style={{
        width, height: KEY_SIZE, ...Button.small,
        backgroundColor: active ? brandAlpha(0.6) : danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.10)",
        borderWidth: 1,
        borderColor: danger ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.12)",
        justifyContent: "center", alignItems: "center",
      }}>
        {children}
      </View>
    </Focusable>
  );
}
