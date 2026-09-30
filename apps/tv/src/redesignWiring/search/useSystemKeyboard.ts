import { useCallback, useEffect, useMemo, useRef } from "react";
import type { TextInput, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SearchSubmitAnswer } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { registerSearchBar } from "../../components/search/searchBarReturn";
import { useSearchSubmit } from "../../components/search/useSearchSubmit";
import type { FocusStore } from "../focus/focusStore";

/** Le champ (un bouton sur tvOS) et la première touche du clavier à l'écran. */
export const FIELD_KEY = "search:field";
export const FIRST_KEY = "key:A";

/** tvOS rend d'abord à l'écran sa dernière cible quand le focus est dans la
 *  navigation : une seconde réclamation atteint la barre. */
const SECOND_CLAIM_MS = 400;

/**
 * Le champ de la recherche sur tvOS : un BOUTON (`search:field`), dont l'appui
 * fait monter le clavier système — et avec lui la dictée de la Siri Remote,
 * la seule que l'Apple TV permet (aucun micro pour l'app). Le vrai champ, hors
 * écran, est `HiddenSearchInput`.
 *
 * Ce que l'écran d'avant faisait, gardé tel quel :
 * - « Rechercher » au clavier système mène au premier résultat quand la
 *   réponse à ce qui est tapé est là (`useSearchSubmit`, `searchSubmitAnswer`) ;
 * - Menu, qui referme le clavier sans valider, rend la première touche ;
 * - revenir d'une étagère (Parcourir) rend la barre, À LA FIN de la
 *   transition — tvOS restaure lui-même la carte quittée une fois le fondu
 *   fini, et défaisait une réclamation partie avant ;
 * - « Rechercher » à la navigation, depuis la recherche, rend la barre
 *   (`registerSearchBar`).
 */
export function useSystemKeyboard(focus: FocusStore, answer: SearchSubmitAnswer, firstKey: string | null, navigation: NativeStackNavigationProp<RootStackParamList>) {
  const inputRef = useRef<TextInput>(null);
  const onPressField = useCallback(() => inputRef.current?.focus(), []);

  const refocusKeyboard = useCallback(() => {
    focus.claim(FIRST_KEY);
  }, [focus]);
  const submit = useSearchSubmit(answer, refocusKeyboard);
  const { setFirstResult, onBarFocus } = submit;

  // Le premier résultat change avec la réponse : relu à chaque écriture.
  const firstKeyRef = useRef(firstKey);
  firstKeyRef.current = firstKey;
  const firstResult = useMemo(
    () => ({
      setNativeProps: (props: object) => {
        const key = firstKeyRef.current;
        const node = key ? (focus.node(key) as { setNativeProps?: (p: object) => void } | null) : null;
        node?.setNativeProps?.(props);
      },
    }),
    [focus],
  );
  useEffect(() => setFirstResult(firstResult as unknown as View), [setFirstResult, firstResult]);

  // La barre reprend le focus : tvOS le lui rend quand son clavier est parti.
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && key === FIELD_KEY) onBarFocus();
  }), [focus, onBarFocus]);

  const focusBar = useCallback(() => {
    const first = focus.claim(FIELD_KEY);
    const timer = setTimeout(() => focus.claim(FIELD_KEY), SECOND_CLAIM_MS);
    return () => {
      first();
      clearTimeout(timer);
    };
  }, [focus]);
  useEffect(() => registerSearchBar(focusBar), [focusBar]);

  const browsing = useRef(false);
  useEffect(() => navigation.addListener("transitionEnd", (event) => {
    if (event.data.closing || !browsing.current) return;
    browsing.current = false;
    focusBar();
  }), [navigation, focusBar]);
  /** On part vers une étagère : au retour, la barre. */
  const markBrowsing = useCallback(() => {
    browsing.current = true;
  }, []);

  return {
    onPressField,
    markBrowsing,
    input: { ref: inputRef, onSubmitEditing: submit.onSubmit, onEndEditing: submit.onKeyboardClosed },
  };
}
