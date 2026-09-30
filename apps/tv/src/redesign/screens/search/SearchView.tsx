import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { FocusGroup } from "../../focus/FocusGroup";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { SearchDiscover } from "./SearchDiscover";
import { SearchField } from "./SearchField";
import { SearchKeyboard } from "./SearchKeyboard";
import { SearchLoading } from "./SearchLoading";
import { SearchResults } from "./SearchResults";
import { SearchSuggestions } from "./SearchSuggestions";
import {
  INPUT_LEFT,
  KEYBOARD_WIDTH,
  RESULTS_CLIP,
  RESULTS_LEFT,
  type SearchContentModel,
  type SearchFacetModel,
  type SearchInputLabels,
  type SearchPersonModel,
  type SearchSuggestionModel,
} from "./searchViewModel";

/**
 * La recherche, façon Netflix : à gauche la saisie — le champ en haut, le
 * clavier en grille, les suggestions ; à droite les résultats en rangées,
 * qui bordent l'écran. La navigation flotte à gauche (« Rechercher » actif),
 * le fond prend la lumière du meilleur résultat ou de la carte focalisée.
 *
 * Contrat — tout arrive résolu, la vue ne fait que dessiner et rappeler :
 * - `query`, `completion`, `suggestions` : la saisie de l'écran, débattue
 *   (150 ms) ; `useTentacleSearch(debounced)` + `suggestionsFrom` /
 *   `completionFor` / `inlineCompletion` (shared) — cinq au plus ;
 * - `content` : `idle` (rien de tapé : `readRecentSearches` et
 *   `useSearchDiscover().genres`), `loading` (première réponse attendue),
 *   `results` (`tvSearchSections(useTentacleSearch().data,
 *   useSearchEpisodes().episodes)` et `tvSearchNotice`, tv-core ; `stale`
 *   quand `foldForSearch(data.query) !== foldForSearch(debounced)`), `empty`
 *   (`tvSearchIsEmpty`) ; cartes par `resolveCardMarkers`, lignes par
 *   `itemMeta` / `matchReason` / `personMeta` ;
 * - `dictation` : `system` sur tvOS (le champ ouvre le clavier système, sa
 *   dictée ; aucun micro), `key` sur Android TV (`useSpeechRecognition`) ;
 * - `palette` : `paletteFromBlurHash` du meilleur résultat ou de la carte
 *   focalisée.
 * Callbacks : la saisie (`onKey`, `onSpace`, `onDelete`, `onClear`,
 * `onMic`, `onPressField`), le choix d'une suggestion ou d'une recherche
 * récente (remplace la saisie), l'ouverture d'un résultat — la
 * mémorisation (`pushRecentSearch`) et la navigation restent à l'écran.
 *
 * Clés de groupe : `search:input` (champ, clavier, suggestions) et
 * `search:results` (la colonne de droite) — chacune peut garder le dernier
 * élément visité, pour qu'aller et venir de l'une à l'autre ne perde pas sa
 * place.
 */

export interface SearchViewProps {
  nav: NavRailProps;
  query: string;
  completion: string | null;
  suggestions: SearchSuggestionModel[];
  content: SearchContentModel;
  labels: SearchInputLabels;
  dictation: "system" | "key";
  /** Android TV : le micro écoute. */
  listening?: boolean;
  palette: ArtworkPalette;
  onPressField?: () => void;
  onKey?: (char: string) => void;
  onSpace?: () => void;
  onDelete?: () => void;
  onClear?: () => void;
  onMic?: () => void;
  onPickSuggestion?: (query: string) => void;
  onPickRecent?: (query: string) => void;
  onPickGenre?: (name: string) => void;
  onOpenTop?: () => void;
  onFocusTop?: (focused: boolean) => void;
  onPressCard?: (sectionKey: string, card: CardModel) => void;
  onLongPressCard?: (sectionKey: string, card: CardModel) => void;
  onFocusCard?: (sectionKey: string, card: CardModel) => void;
  onOpenPerson?: (person: SearchPersonModel) => void;
  onOpenFacet?: (facet: SearchFacetModel) => void;
}

export const SearchView = memo(function SearchView(props: SearchViewProps) {
  const { nav, query, completion, suggestions, content, labels, dictation, listening, palette } = props;
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      <FocusGroup focusKey="search:input" style={styles.input}>
        <SearchField
          query={query}
          completion={completion}
          placeholder={labels.placeholder}
          systemInput={dictation === "system"}
          dictationHint={labels.dictationHint}
          onPress={props.onPressField}
        />
        <View style={styles.keyboard}>
          <SearchKeyboard
            labels={labels}
            withMic={dictation === "key"}
            listening={listening}
            onKey={props.onKey}
            onSpace={props.onSpace}
            onDelete={props.onDelete}
            onClear={props.onClear}
            onMic={props.onMic}
          />
        </View>
        <SearchSuggestions title={labels.suggestions} typed={query} suggestions={suggestions} onPick={props.onPickSuggestion} />
      </FocusGroup>
      <FocusGroup focusKey="search:results" style={styles.results}>
        {content.kind === "results" ? (
          <SearchResults
            notice={content.notice}
            stale={content.stale}
            sections={content.sections}
            onOpenTop={props.onOpenTop}
            onFocusTop={props.onFocusTop}
            onPressCard={props.onPressCard}
            onLongPressCard={props.onLongPressCard}
            onFocusCard={props.onFocusCard}
            onOpenPerson={props.onOpenPerson}
            onOpenFacet={props.onOpenFacet}
          />
        ) : content.kind === "loading" ? (
          <SearchLoading label={content.label} />
        ) : (
          <SearchDiscover
            discover={content.discover}
            empty={content.kind === "empty"}
            onPickRecent={props.onPickRecent}
            onPickGenre={props.onPickGenre}
          />
        )}
      </FocusGroup>
      <NavRail {...nav} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  input: { position: "absolute", left: INPUT_LEFT, top: TV_STAGE.safe.y, width: KEYBOARD_WIDTH },
  keyboard: { marginVertical: 24 },
  // Rognée un peu avant sa première carte : une rangée qui défile ne passe
  // jamais sous le clavier.
  results: { position: "absolute", left: RESULTS_LEFT - RESULTS_CLIP, top: 0, right: 0, bottom: 0, overflow: "hidden" },
});
