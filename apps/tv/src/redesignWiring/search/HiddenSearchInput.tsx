import type { RefObject } from "react";
import { StyleSheet, TextInput, type NativeSyntheticEvent, type TextInputEndEditingEventData, type TextInputSubmitEditingEventData } from "react-native";

/**
 * Le VRAI champ de la recherche sur tvOS : hors écran, jamais candidat du
 * moteur de focus géométrique. Le bouton `search:field` de la vue le
 * focalise, ce qui fait monter le clavier système (et sa dictée) ; ce qu'on
 * y tape, dicte ou valide revient à l'écran.
 */
export function HiddenSearchInput({ inputRef, value, onChangeText, onSubmitEditing, onEndEditing }: {
  inputRef: RefObject<TextInput | null>;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
  onEndEditing: (event: NativeSyntheticEvent<TextInputEndEditingEventData>) => void;
}) {
  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      onEndEditing={onEndEditing}
      returnKeyType="search"
      autoCorrect={false}
      style={styles.offscreen}
    />
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -1000, top: 0, width: 1, height: 1, opacity: 0 },
});
