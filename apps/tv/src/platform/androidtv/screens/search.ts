import { useCallback, useEffect, useMemo, useRef } from "react";
import { Keyboard, type TextInput } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SearchSubmitAnswer } from "@tentacle-tv/tv-core";
import { useSpeechRecognition } from "../../../hooks/useSpeechRecognition";
import type { RootStackParamList } from "../../../navigation/types";
import type { FocusStore } from "../../tvos/focus/focusStore";
import { useSearchKeyboard as useSharedSearchKeyboard } from "../../tvos/screens/search";
import type { SearchDictation } from "../../shared/screens/searchDictation";

/**
 * L'applicateur Android TV de la RECHERCHE — le même écran que l'Apple TV, la
 * même règle (tv-core `search/` : le champ, la validation, la barre rendue au
 * retour d'une étagère, que l'applicateur commun déroule). Deux choses
 * changent, la SAISIE seulement :
 *
 * - le champ ouvre le clavier système d'Android (Gboard, clavier Leanback),
 *   comme il ouvre celui de tvOS. Mais un clavier d'Android qu'on referme par
 *   Retour ne retire PAS le focus du champ (tvOS, si) : le vrai champ, hors
 *   écran, le garderait, et la croix partirait de nulle part. À sa fermeture
 *   (`keyboardDidHide`), le champ est donc rendu (`blur`) : sa fin de saisie
 *   (`onEndEditing`) suit, et la règle commune rend le focus au clavier de
 *   l'écran (`SEARCH_KEYBOARD_CLOSED_KEY`), ou au premier résultat après une
 *   validation — comme sur Apple TV ;
 * - la dictée est celle de l'APP, par la touche micro du clavier à l'écran
 *   (`useSpeechRecognition`, le module natif `VoiceRecognition`) — tvOS
 *   refuse le micro aux apps, Android le permet : la phrase reconnue remplace
 *   la saisie, comme une suggestion choisie.
 */

export { useSearchGroups } from "../../tvos/screens/search";

/** Le clavier système : celui de l'Apple TV, plus le rendu du champ à sa fermeture. */
export function useSearchKeyboard(
  focus: FocusStore,
  answer: SearchSubmitAnswer,
  firstKey: string | null,
  navigation: NativeStackNavigationProp<RootStackParamList>,
) {
  const keyboard = useSharedSearchKeyboard(focus, answer, firstKey, navigation);
  useBlurOnKeyboardHide(keyboard.input.ref);
  return keyboard;
}

function useBlurOnKeyboardHide(ref: React.RefObject<TextInput | null>): void {
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      if (ref.current?.isFocused()) ref.current.blur();
    });
    return () => subscription.remove();
  }, [ref]);
}

export type { SearchDictation };

/** La dictée de l'app : la touche micro, qui écoute ou s'arrête ; la phrase reconnue devient la saisie. */
export function useSearchDictation(onResult: (text: string) => void): SearchDictation {
  const latest = useRef(onResult);
  latest.current = onResult;
  const speech = useSpeechRecognition({ onResult: (text) => latest.current(text) });
  const { isListening, isPending, isAvailable, startListening, stopListening } = speech;
  const listening = isListening || isPending;
  const onMic = useCallback(() => (listening ? stopListening() : startListening()), [listening, startListening, stopListening]);
  // Le micro n'existe pas sur cet appareil : le clavier système garde la saisie, et sa propre dictée.
  return useMemo(
    (): SearchDictation => (isAvailable ? { dictation: "systemAndKey", listening, onMic } : { dictation: "system" }),
    [isAvailable, listening, onMic],
  );
}
