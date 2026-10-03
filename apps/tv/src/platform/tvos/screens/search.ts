import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TextInput, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  SEARCH_BAR_CLAIMS_MS,
  SEARCH_FIELD_KEY,
  SEARCH_INPUT_GROUP,
  SEARCH_KEYBOARD_CLOSED_KEY,
  SEARCH_RESULTS_GROUP,
  SEARCH_SUBMIT_IDLE,
  SHELF_RETURN_IDLE,
  searchSubmitStep,
  shelfReturnStep,
  type SearchSubmitAnswer,
  type SearchSubmitEvent,
  type ShelfReturnEvent,
} from "@tentacle-tv/tv-core";
import { registerSearchBar } from "../../../components/search/searchBarReturn";
import { claimTvFocus } from "../../../hooks/useTvFocusClaim";
import type { RootStackParamList } from "../../../navigation/types";
import { AutoFocusGuide } from "../focus/focusGuides";
import type { FocusStore } from "../focus/focusStore";
import { useRemoteIntents } from "../input";

/**
 * L'applicateur tvOS de la RECHERCHE — les décisions sont celles de tv-core
 * (`search/searchFocus.ts`, `searchSubmitFlow.ts`, `searchShelfReturn.ts` ;
 * relevé `docs/tv-navigation/ecrans.md`, RE-1 à RE-8). Il ne fait que :
 * - lier les deux colonnes (des groupes qui mémorisent, `AutoFocusGuide`) ;
 * - ouvrir le clavier système : le champ est un bouton qui focalise le VRAI
 *   champ, hors écran (`HiddenSearchInput`) — sa dictée vient avec (aucun
 *   micro pour l'app sur tvOS) ;
 * - dérouler la validation (`searchSubmitStep`) : les minuteries, la pose du
 *   focus sur le premier résultat, la première touche après Menu ; « une
 *   touche pressée » = une flèche ou OK, lus par l'entrée unique (T1) ;
 * - rendre la barre au retour d'une étagère (`shelfReturnStep`, à la fin de
 *   la transition) et quand « Rechercher » est rechoisi dans la navigation.
 */

/** Les deux colonnes, liées dès le premier rendu, avant que la vue ne monte ses groupes. */
export function useSearchGroups(focus: FocusStore): void {
  useState(() => {
    focus.bind(SEARCH_INPUT_GROUP, { container: AutoFocusGuide });
    focus.bind(SEARCH_RESULTS_GROUP, { container: AutoFocusGuide });
    return true;
  });
}

type Settable = { setNativeProps?: (props: object) => void };

/** La validation au clavier système : la règle de tv-core, ses effets posés ici. */
function useSearchSubmit(focus: FocusStore, answer: SearchSubmitAnswer, firstKey: string | null) {
  const state = useRef(SEARCH_SUBMIT_IDLE);
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const firstKeyRef = useRef(firstKey);
  firstKeyRef.current = firstKey;
  const goneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelClaim = useRef<() => void>(() => {});
  // Le premier résultat change avec la réponse : relu à chaque écriture de la pose.
  const firstResult = useMemo(
    () => ({
      setNativeProps: (props: object) => {
        const key = firstKeyRef.current;
        (key ? (focus.node(key) as Settable | null) : null)?.setNativeProps?.(props);
      },
    }),
    [focus],
  );

  const dispatch = useRef<(event: SearchSubmitEvent) => void>(() => {});
  dispatch.current = (event) => {
    const step = searchSubmitStep(state.current, event);
    state.current = step.state;
    for (const effect of step.effects) {
      if (effect.type === "keyboardClosedWithoutSubmit") focus.claim(SEARCH_KEYBOARD_CLOSED_KEY);
      else if (effect.type === "cancelGoneTimer") clearTimeout(goneTimer.current);
      else if (effect.type === "armGoneTimer") {
        clearTimeout(goneTimer.current);
        goneTimer.current = setTimeout(() => dispatch.current({ type: "gone", at: Date.now(), answer: answerRef.current }), effect.ms);
      } else {
        cancelClaim.current();
        cancelClaim.current = claimTvFocus(firstResult as unknown as View);
      }
    }
  };

  useEffect(() => dispatch.current({ type: "answer", at: Date.now(), answer }), [answer]);
  // Une flèche ou OK après le départ du clavier : l'utilisateur a pris la main.
  useRemoteIntents((event) => {
    if (event.intent.type === "move" || event.intent.type === "select") dispatch.current({ type: "press" });
  });
  useEffect(() => () => {
    clearTimeout(goneTimer.current);
    cancelClaim.current();
  }, []);
  // La barre reprend le focus : le clavier est parti.
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && key === SEARCH_FIELD_KEY) dispatch.current({ type: "gone", at: Date.now(), answer: answerRef.current });
  }), [focus]);

  const onSubmit = useCallback(() => dispatch.current({ type: "submit", at: Date.now() }), []);
  const onKeyboardClosed = useCallback(() => dispatch.current({ type: "closed", at: Date.now() }), []);
  return { onSubmit, onKeyboardClosed };
}

/** La barre rendue : au retour d'une étagère, et quand « Rechercher » est rechoisi. */
function useShelfReturn(focus: FocusStore, navigation: NativeStackNavigationProp<RootStackParamList>) {
  const focusBar = useCallback(() => {
    const cancels: Array<() => void> = [];
    for (const delay of SEARCH_BAR_CLAIMS_MS) {
      if (delay === 0) cancels.push(focus.claim(SEARCH_FIELD_KEY));
      else {
        const timer = setTimeout(() => focus.claim(SEARCH_FIELD_KEY), delay);
        cancels.push(() => clearTimeout(timer));
      }
    }
    return () => {
      for (const cancel of cancels) cancel();
    };
  }, [focus]);
  useEffect(() => registerSearchBar(focusBar), [focusBar]);

  const shelf = useRef(SHELF_RETURN_IDLE);
  useEffect(() => {
    let settle: ReturnType<typeof setTimeout> | null = null;
    const run = (event: ShelfReturnEvent) => {
      const step = shelfReturnStep(shelf.current, event);
      shelf.current = step.state;
      for (const effect of step.effects) {
        if (effect.type === "focusBar") focusBar();
        else {
          if (settle) clearTimeout(settle);
          settle = setTimeout(() => {
            settle = null;
            shelf.current = shelfReturnStep(shelf.current, { type: "settle" }).state;
          }, effect.ms);
        }
      }
    };
    const unsubscribe = navigation.addListener("transitionEnd", (event) => run({ type: "arrive", closing: event.data.closing }));
    return () => {
      unsubscribe();
      if (settle) clearTimeout(settle);
    };
  }, [navigation, focusBar]);

  /** On part vers une étagère : au retour, la barre. */
  const markBrowsing = useCallback(() => {
    shelf.current = shelfReturnStep(shelf.current, { type: "leave" }).state;
  }, []);
  return { markBrowsing };
}

/**
 * Le clavier système de la recherche : le champ qui l'ouvre, sa validation,
 * sa fermeture, et la barre rendue au retour d'une étagère.
 */
export function useSearchKeyboard(
  focus: FocusStore,
  answer: SearchSubmitAnswer,
  firstKey: string | null,
  navigation: NativeStackNavigationProp<RootStackParamList>,
) {
  const inputRef = useRef<TextInput>(null);
  const onPressField = useCallback(() => inputRef.current?.focus(), []);
  const submit = useSearchSubmit(focus, answer, firstKey);
  const { markBrowsing } = useShelfReturn(focus, navigation);
  return {
    onPressField,
    markBrowsing,
    input: { ref: inputRef, onSubmitEditing: submit.onSubmit, onEndEditing: submit.onKeyboardClosed },
  };
}
