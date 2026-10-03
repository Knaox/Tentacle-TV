import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  SEARCH_ENTRY_KEY,
  SEARCH_FIELD_KEY,
  holdPanelOf,
  searchCardPress,
  searchTopPress,
  type SearchCardKind,
} from "@tentacle-tv/tv-core";
import { useTVCardActions } from "../../components/cards/actions/useTVCardActions";
import type { RootStackParamList } from "../../navigation/types";
import { useSearchGroups, useSearchKeyboard } from "../../platform/tvos/screens/search";
import type { CardModel } from "../../redesign/cards/cardTypes";
import type { ArtworkPalette } from "../../redesign/color/artworkPalette";
import { SearchView } from "../../redesign/screens/search/SearchView";
import type { SearchFacetModel, SearchPersonModel } from "../../redesign/screens/search/searchViewModel";
import { RedesignScreen } from "../screen/RedesignScreen";
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
 * clavier système, qu'ouvre le champ (`useSearchKeyboard`) — jamais le micro,
 * que tvOS refuse aux apps.
 *
 * Chaque colonne garde sa place (groupes `search:input` et `search:results`) :
 * aller aux résultats mène au meilleur, puis au dernier visité ; revenir au
 * clavier rend la dernière touche. Le focus, le clavier système et ce que fait
 * OK sont décidés par tv-core (`search/`) et posés par l'applicateur tvOS
 * (`platform/tvos/screens/search.ts`) ; l'appui maintenu par la règle de T6
 * (`holdPanelOf`).
 */

/** Le genre d'une carte de résultat, pour l'appui maintenu. */
function holdCardOf(section: string, librarySeries: boolean): SearchCardKind {
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
  const onOpenTop = useCallback(() => {
    if (!top || top.key !== "top") return;
    if (searchTopPress(top.top.kind) === "browse") {
      if (top.top.kind === "person") openBrowse({ kind: "person", id: top.top.id, name: top.top.name });
      return;
    }
    remember();
    navigation.navigate("MediaDetail", { itemId: top.top.id });
  }, [top, openBrowse, remember, navigation]);

  // Une vignette d'épisode LIT, une affiche ouvre sa fiche (le modèle des
  // cartes) ; un titre « À demander » se demande — une série incomplète par
  // la feuille de ses saisons.
  const { itemOf, absentOf, gapOf } = results;
  const open = requests?.open;
  const hold = requests?.hold;
  const onPressCard = useCallback((section: string, card: CardModel) => {
    remember();
    const press = searchCardPress(section);
    if (press === "request") {
      const gap = gapOf(card.id);
      if (gap && requests) return openSearchGap(requests, gap, t);
      const title = absentOf(card.id);
      if (title) open?.(title);
    } else if (press === "play") navigation.navigate("Player", { itemId: card.id });
    else navigation.navigate("MediaDetail", { itemId: card.id });
  }, [remember, navigation, absentOf, gapOf, open, requests, t]);
  const onLongPressCard = useCallback((section: string, card: CardModel) => {
    // Une série incomplète est un titre de la bibliothèque : son panneau.
    const gap = section === "absent" ? gapOf(card.id) : undefined;
    const series = gap ? itemOf(gap.seriesId) : undefined;
    const panel = holdPanelOf({ surface: "search", card: holdCardOf(section, series !== undefined) });
    if (panel?.kind === "absent") {
      const title = absentOf(card.id);
      if (title) hold?.(title);
      return;
    }
    const item = series ?? (section === "absent" ? undefined : itemOf(card.id));
    if (!item || panel?.kind !== "media") return;
    if (panel.variant === "landscape") openLandscape(item);
    else openPoster(item);
  }, [itemOf, absentOf, gapOf, hold, openLandscape, openPoster]);

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
      {requests?.overlay}
    </RedesignScreen>
  );
}
