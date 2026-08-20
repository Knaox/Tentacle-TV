import { useCallback, useRef } from "react";
import { View, Text, TextInput, Platform } from "react-native";
import type { View as RNView } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { MicIcon, SpaceIcon, BackspaceIcon, CloseIcon } from "./icons/TVIcons";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { Colors, brandAlpha } from "../theme/colors";
import { Bouton } from "../theme/boutons";

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
  /** Publie la 1ʳᵉ touche de la grille comme focusable d'entrée du contenu
   *  (sortie rail + auto-collapse — useTVContentEntry côté écran). */
  entryRef?: (node: RNView | null) => void;
}

export function TVSearchKeyboard({ query, onKeyPress, onDelete, onClear, onVoiceResult, onSetQuery, entryRef }: TVSearchKeyboardProps) {
  const { t } = useTranslation("common");

  const { isListening, isPending, isAvailable, startListening, stopListening } = useSpeechRecognition({
    onResult: (text) => onVoiceResult?.(text),
  });

  // tvOS — champ réel + retour de focus. La 1ʳᵉ touche de la grille sert de
  // point de retour quand le clavier système se ferme : le moteur de focus ne
  // restaure pas toujours seul, et la touche portant déjà
  // `hasTVPreferredFocus` en prop, seule une re-saisie cycle false→true agit
  // (react-native-tvos #849).
  const inputRef = useRef<TextInput>(null);
  const firstKeyNode = useRef<RNView | null>(null);
  const setFirstKeyRef = useCallback((node: RNView | null) => {
    firstKeyNode.current = node;
    entryRef?.(node);
  }, [entryRef]);
  const refocusGrid = useCallback(() => {
    const node = firstKeyNode.current as { setNativeProps?: (p: object) => void } | null;
    node?.setNativeProps?.({ hasTVPreferredFocus: false });
    setTimeout(() => node?.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
  }, []);

  const micBg = isListening
    ? Colors.accentPurple
    : isPending
      ? brandAlpha(0.3)
      : "rgba(255,255,255,0.08)";

  return (
    <View style={{ width: 260 }}>
      {/* Query row */}
      {IS_TVOS ? (
        // tvOS — parité LG (`SearchScreenTv`) : « la barre est un BOUTON, le
        // champ réel est masqué ». Un TextInput focusable au D-pad ouvrait le
        // clavier système plein écran au simple passage du focus ; ici seule
        // la SÉLECTION de la barre le fait monter (focus programmatique), et
        // la dictée Siri Remote y reste accessible. Fermeture → retour du
        // focus à la grille.
        <>
          <Focusable
            variant="button"
            focusRadius={Bouton.petit.borderRadius}
            onPress={() => inputRef.current?.focus()}
            accessibilityLabel={t("voiceOrType")}
          >
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
              backgroundColor: "rgba(255,255,255,0.06)", ...Bouton.petit,
              paddingHorizontal: 10, minHeight: 44,
              borderWidth: 1, borderColor: Colors.glassBorder,
            }}>
              <MicIcon size={18} color={Colors.accentPurpleLight} />
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontSize: 20, fontWeight: "300", paddingVertical: 8, color: query ? Colors.textPrimary : Colors.textTertiary }}
              >
                {query || t("voiceOrType")}
              </Text>
            </View>
          </Focusable>
          {/* Champ RÉEL : hors écran, jamais candidat du moteur géométrique. */}
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={onSetQuery}
            onEndEditing={refocusGrid}
            returnKeyType="search"
            autoCorrect={false}
            style={{ position: "absolute", left: -1000, top: 0, width: 1, height: 1, opacity: 0 }}
          />
        </>
      ) : (
        // Android TV : accès micro réel → bouton inline (useSpeechRecognition).
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Focusable variant="button" focusRadius={Bouton.petit.borderRadius} onPress={onDelete} style={{ flex: 1 }}>
            <View style={{
              backgroundColor: "rgba(255,255,255,0.06)", ...Bouton.petit,
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
            <Focusable variant="button" focusRadius={Bouton.petit.borderRadius} onPress={isListening ? stopListening : startListening}>
              <View style={{
                width: 40, height: 40, ...Bouton.petit,
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
            <Focusable
              key={key}
              ref={rowIdx === 0 && keyIdx === 0 ? setFirstKeyRef : undefined}
              variant="button"
            focusRadius={Bouton.petit.borderRadius}
              onPress={() => onKeyPress(key.toLowerCase())}
              hasTVPreferredFocus={rowIdx === 0 && keyIdx === 0}
            >
              <View style={{
                width: 36, height: 36, ...Bouton.petit,
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
        <Focusable variant="button" focusRadius={Bouton.petit.borderRadius} onPress={() => onKeyPress(" ")} accessibilityLabel={t("space")}>
          <View style={{
            width: 78, height: 36, ...Bouton.petit,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
          }}>
            <SpaceIcon size={20} color={Colors.textPrimary} />
          </View>
        </Focusable>
        <Focusable variant="button" focusRadius={Bouton.petit.borderRadius} onPress={onDelete} accessibilityLabel={t("delete")}>
          <View style={{
            width: 78, height: 36, ...Bouton.petit,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            justifyContent: "center", alignItems: "center",
          }}>
            <BackspaceIcon size={20} color={Colors.textPrimary} />
          </View>
        </Focusable>
        <Focusable variant="button" focusRadius={Bouton.petit.borderRadius} onPress={onClear} accessibilityLabel={t("clear")}>
          <View style={{
            width: 78, height: 36, ...Bouton.petit,
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
