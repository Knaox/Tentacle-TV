import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  SEARCH_ENTRY_KEY,
  SEARCH_FIELD_KEY,
  cardPressOf,
  holdPanelOf,
  searchTopPress,
  type SearchCardKind,
} from "@tentacle-tv/tv-core";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import { useStableHandler } from "../../hooks/useStableHandler";
import type { RootStackParamList } from "../../navigation/types";
import { useSearchDictation, useSearchGroups, useSearchKeyboard } from "../../platform/searchInput";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { SearchView } from "../../redesign/screens/search/SearchView";
import type { SearchFacetModel, SearchPersonModel } from "../../redesign/screens/search/searchViewModel";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useAmbientStore } from "../screen/ambientStore";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { useTitleRequests } from "../vigie/useTitleRequests";
import { openSearchGap } from "../vigie/useSearchGaps";
import { HiddenSearchInput } from "./HiddenSearchInput";
import { searchInputLabels } from "./searchModels";
import { useSearchInput } from "./useSearchInput";
import { useSearchResults } from "./useSearchResults";
import { useSearchSources } from "./useSearchSources";

type Browse = RootStackParamList["SearchBrowse"];

/** Une clé de la saisie : la lumière revient à celle de la réponse. */
const isInputKey = (key: string) => key === SEARCH_FIELD_KEY || key.startsWith("key:") || key.startsWith("suggestion:");

/**
 * La recherche, refondue (Apple TV), façon Netflix : à gauche le champ, le
 * clavier en grille et les suggestions ; à droite les résultats en rangées,
 * sur le moteur de Tentacle — la bibliothèque, et, quand le serveur sait
 * demander des titres, la rangée « À demander » (`useSearchAbsent`). Dictée : celle du
 * clavier système, qu'ouvre le champ (`useSearchKeyboard`) — sur Apple TV,
 * jamais le micro, que tvOS refuse aux apps ; sur Android TV, la touche micro
 * de l'app en plus (`useSearchDictation`, `platform/searchInput`).
 *
 * Chaque colonne garde sa place (groupes `search:input` et `search:results`) :
 * aller aux résultats mène au meilleur, puis au dernier visité ; revenir au
 * clavier rend la dernière touche. Le focus, le clavier système et ce que fait
 * OK sont décidés par tv-core (`search/`) et posés par l'applicateur tvOS
 * (`platform/tvos/screens/search.ts`) ; OK et l'appui maintenu sur une carte
 * par les règles des cartes (`cardPressOf`, `holdPanelOf`).
 */

/** Le genre d'une carte de résultat, pour les règles des cartes. */
function searchCardKindOf(section: string, librarySeries: boolean): SearchCardKind {
  if (section === "absent") return librarySeries ? "librarySeries" : "absentTitle";
  return section === "episodes" ? "episode" : "title";
}
export function SearchRedesign() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const input = useSearchInput();
  const sources = useSearchSources(t);
  // Demander un titre hors bibliothèque — rien tant que la garde Vigie est fermée.
  const requests = useTitleRequests();
  const results = useSearchResults(sources, input, requests?.gate ?? null);
  const screen = useRedesignScreen({ railKey: "Search", entryKey: SEARCH_ENTRY_KEY });
  const { focus } = screen;
  useSearchGroups(focus);
  const keyboard = useSearchKeyboard(focus, results.submitAnswer, results.firstKey, navigation);
  // Apple TV : la dictée du clavier système ; Android TV : aussi le micro de l'app.
  const dictation = useSearchDictation(input.setQuery);
  const { openPoster, openLandscape, sheet } = useTVCardActions();
  const labels = useMemo(() => searchInputLabels(t), [t]);

  // La lumière du fond : la carte focalisée, sinon le meilleur résultat —
  // tenue hors du rendu (`ambient`) : un pas du focus ne redessine que le fond.
  const ambient = useAmbientStore();
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && (key === "top" || isInputKey(key))) ambient.set(null);
  }), [focus, ambient]);
  const onFocusCard = useCallback((_section: string, card: CardModel) => {
    if (card.palette) ambient.set(card.palette);
  }, [ambient]);

  const { remember, setQuery } = input;
  const { markBrowsing } = keyboard;
  // Une étagère : au retour, la barre (`markBrowsing`).
  const browse = useCallback((params: Browse) => {
    markBrowsing();
    navigation.navigate("SearchBrowse", params);
  }, [markBrowsing, navigation]);
  // Un RÉSULTAT choisi (personne, genre ou studio trouvés) : la requête est
  // mémorisée, comme sur Android TV.
  const openBrowse = useCallback((params: Browse) => {
    remember();
    browse(params);
  }, [remember, browse]);

  const content = results.content;
  const top = content.kind === "results" ? content.sections.find((section) => section.key === "top") : undefined;
  // Les gestes des résultats lisent la DERNIÈRE réponse mais gardent leur
  // identité (`useStableHandler`) : une frappe ne redessine pas les cartes.
  const onOpenTop = useStableHandler(() => {
    if (!top || top.key !== "top") return;
    if (searchTopPress(top.top.kind) === "browse") {
      if (top.top.kind === "person") openBrowse({ kind: "person", id: top.top.id, name: top.top.name });
      return;
    }
    remember();
    navigation.navigate("MediaDetail", { itemId: top.top.id });
  });

  // Une vignette d'épisode LIT, une affiche ouvre sa fiche (le modèle des
  // cartes) ; un titre « À demander » se demande — une série incomplète par
  // la feuille de ses saisons.
  const { itemOf, absentOf, gapOf } = results;
  const open = requests?.open;
  const hold = requests?.hold;
  const onPressCard = useStableHandler((section: string, card: CardModel) => {
    remember();
    const press = cardPressOf({ surface: "search", card: searchCardKindOf(section, false) });
    if (press === "request") {
      const gap = gapOf(card.id);
      if (gap && requests) return openSearchGap(requests, gap, t);
      const title = absentOf(card.id);
      if (title) open?.(title);
    } else if (press === "play") navigation.navigate("Player", { itemId: card.id });
    else navigation.navigate("MediaDetail", { itemId: card.id });
  });
  const onLongPressCard = useStableHandler((section: string, card: CardModel) => {
    // Une série incomplète est un titre de la bibliothèque : son panneau.
    const gap = section === "absent" ? gapOf(card.id) : undefined;
    const series = gap ? itemOf(gap.seriesId) : undefined;
    const panel = holdPanelOf({ surface: "search", card: searchCardKindOf(section, series !== undefined) });
    if (panel?.kind === "absent") {
      const title = absentOf(card.id);
      if (title) hold?.(title);
      return;
    }
    const item = series ?? (section === "absent" ? undefined : itemOf(card.id));
    if (!item || panel?.kind !== "media") return;
    if (panel.variant === "landscape") openLandscape(item);
    else openPoster(item);
  });

  const onOpenPerson = useCallback((person: SearchPersonModel) => openBrowse({ kind: "person", id: person.id, name: person.name }), [openBrowse]);
  const onOpenFacet = useCallback((facet: SearchFacetModel) => openBrowse({ kind: facet.kind, name: facet.name }), [openBrowse]);
  // Un genre de la page de découverte n'est pas un résultat : rien à mémoriser.
  const onPickGenre = useCallback((name: string) => browse({ kind: "genre", name }), [browse]);

  return (
    <RedesignScreen screen={screen}>
      <SearchView
        nav={screen.nav}
        query={input.query}
        completion={results.completion}
        suggestions={results.suggestions}
        content={content}
        labels={labels}
        dictation={dictation.dictation}
        listening={dictation.listening}
        onMic={dictation.onMic}
        palette={results.palette}
        ambient={ambient}
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
      {requests?.overlay}
    </RedesignScreen>
  );
}
