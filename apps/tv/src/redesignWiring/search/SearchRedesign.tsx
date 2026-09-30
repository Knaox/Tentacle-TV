import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import type { RootStackParamList } from "../../navigation/types";
import type { CardModel } from "../../redesign/cards/cardTypes";
import type { ArtworkPalette } from "../../redesign/color/artworkPalette";
import { SearchView } from "../../redesign/screens/search/SearchView";
import type { SearchFacetModel, SearchPersonModel } from "../../redesign/screens/search/searchViewModel";
import { AutoFocusGuide } from "../focus/focusGuides";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { HiddenSearchInput } from "./HiddenSearchInput";
import { searchInputLabels } from "./searchModels";
import { useSearchInput } from "./useSearchInput";
import { useSearchResults } from "./useSearchResults";
import { useSearchSources } from "./useSearchSources";
import { FIELD_KEY, FIRST_KEY, useSystemKeyboard } from "./useSystemKeyboard";

type Browse = RootStackParamList["SearchBrowse"];

/** Une clé de la saisie : la lumière revient à celle de la réponse. */
const isInputKey = (key: string) => key === FIELD_KEY || key.startsWith("key:") || key.startsWith("suggestion:");

/**
 * La recherche, refondue (Apple TV), façon Netflix : à gauche le champ, le
 * clavier en grille et les suggestions ; à droite les résultats en rangées,
 * sur le moteur de Tentacle — la bibliothèque seule. Dictée : celle du
 * clavier système, qu'ouvre le champ (`useSystemKeyboard`) — jamais le micro,
 * que tvOS refuse aux apps.
 *
 * Chaque colonne garde sa place (groupes `search:input` et `search:results`) :
 * aller aux résultats mène au meilleur, puis au dernier visité ; revenir au
 * clavier rend la dernière touche.
 */
export function SearchRedesign() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const input = useSearchInput();
  const sources = useSearchSources(t);
  const results = useSearchResults(sources, input);
  const screen = useRedesignScreen({ railKey: "Search", entryKey: FIRST_KEY });
  const { focus } = screen;
  // Liés dès le premier rendu, avant que la vue ne monte ses groupes.
  const bound = useRef(false);
  if (!bound.current) {
    focus.bind("search:input", { container: AutoFocusGuide });
    focus.bind("search:results", { container: AutoFocusGuide });
    bound.current = true;
  }
  const keyboard = useSystemKeyboard(focus, results.submitAnswer, results.firstKey, navigation);
  const { openPoster, openLandscape, sheet } = useTVCardActions();
  const labels = useMemo(() => searchInputLabels(t), [t]);

  // La lumière du fond : la carte focalisée, sinon le meilleur résultat.
  const [focusedPalette, setFocusedPalette] = useState<ArtworkPalette | null>(null);
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && (key === "top" || isInputKey(key))) setFocusedPalette(null);
  }), [focus]);
  const onFocusCard = useCallback((_section: string, card: CardModel) => {
    if (card.palette) setFocusedPalette(card.palette);
  }, []);

  const { remember, setQuery } = input;
  const { markBrowsing } = keyboard;
  const openBrowse = useCallback((params: Browse) => {
    remember();
    markBrowsing();
    navigation.navigate("SearchBrowse", params);
  }, [remember, markBrowsing, navigation]);

  const content = results.content;
  const top = content.kind === "results" ? content.sections.find((section) => section.key === "top") : undefined;
  const onOpenTop = useCallback(() => {
    if (!top || top.key !== "top") return;
    if (top.top.kind === "person") {
      openBrowse({ kind: "person", id: top.top.id, name: top.top.name });
      return;
    }
    remember();
    navigation.navigate("MediaDetail", { itemId: top.top.id });
  }, [top, openBrowse, remember, navigation]);

  // Une vignette d'épisode LIT, une affiche ouvre sa fiche (le modèle des cartes).
  const onPressCard = useCallback((section: string, card: CardModel) => {
    remember();
    if (section === "episodes") navigation.navigate("Player", { itemId: card.id });
    else navigation.navigate("MediaDetail", { itemId: card.id });
  }, [remember, navigation]);
  const { itemOf } = results;
  const onLongPressCard = useCallback((section: string, card: CardModel) => {
    const item = itemOf(card.id);
    if (!item) return;
    if (section === "episodes") openLandscape(item);
    else openPoster(item);
  }, [itemOf, openLandscape, openPoster]);

  const onOpenPerson = useCallback((person: SearchPersonModel) => openBrowse({ kind: "person", id: person.id, name: person.name }), [openBrowse]);
  const onOpenFacet = useCallback((facet: SearchFacetModel) => openBrowse({ kind: facet.kind, name: facet.name }), [openBrowse]);
  const onPickGenre = useCallback((name: string) => openBrowse({ kind: "genre", name }), [openBrowse]);

  return (
    <RedesignScreen screen={screen}>
      <SearchView
        nav={screen.nav}
        query={input.query}
        completion={results.completion}
        suggestions={results.suggestions}
        content={content}
        labels={labels}
        dictation="system"
        palette={focusedPalette ?? results.palette}
        onPressField={keyboard.onPressField}
        onKey={input.onKey}
        onSpace={input.onSpace}
        onDelete={input.onDelete}
        onClear={input.onClear}
        onPickSuggestion={setQuery}
        onPickRecent={setQuery}
        onPickGenre={onPickGenre}
        onOpenTop={onOpenTop}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={onFocusCard}
        onOpenPerson={onOpenPerson}
        onOpenFacet={onOpenFacet}
      />
      <HiddenSearchInput
        inputRef={keyboard.input.ref}
        value={input.query}
        onChangeText={setQuery}
        onSubmitEditing={keyboard.input.onSubmitEditing}
        onEndEditing={keyboard.input.onEndEditing}
      />
      {sheet}
    </RedesignScreen>
  );
}
