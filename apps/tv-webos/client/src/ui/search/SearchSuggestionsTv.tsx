import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

export interface SearchSuggestion {
  /** Ce qui remplace la saisie quand on la choisit. */
  query: string;
  /** La complétion du meilleur résultat (mise en avant), ou une requête proposée. */
  kind: "complete" | "query";
}

/**
 * Les suggestions, sous la barre : quatre lettres tapées, et « Aube des
 * Titans » s'obtient d'un appui au lieu de douze — sur un clavier de
 * télécommande, chaque lettre en coûte trois ou quatre. D'abord la complétion
 * du meilleur résultat, puis ce que le moteur propose — franchise, personne,
 * collection (`suggestionsFrom`, commun aux trois téléviseurs). Une liste
 * courte et stable : au D-pad, chaque ligne coûte un appui.
 */
export const SearchSuggestionsTv = memo(function SearchSuggestionsTv({ suggestions, onPick }: {
  suggestions: SearchSuggestion[];
  onPick: (query: string) => void;
}) {
  const { t } = useTranslation("search");
  if (suggestions.length === 0) return null;

  return (
    <div className="tv-search-suggestions">
      <p className="tv-search-kicker">{t("suggestions")}</p>
      <ul className="tv-search-suggestion-list">
        {suggestions.map((suggestion) => (
          <li key={`${suggestion.kind}:${suggestion.query}`}>
            <button
              type="button"
              className="tv-search-suggestion"
              data-kind={suggestion.kind}
              onClick={() => onPick(suggestion.query)}
            >
              <Search className="tv-search-suggestion-icon" size={22} strokeWidth={2.2} aria-hidden />
              <span className="tv-search-suggestion-text">{suggestion.query}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});
