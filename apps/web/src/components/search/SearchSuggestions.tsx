import { useTranslation } from "react-i18next";
import { useResumeItems, useNextUp } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { clearRecentSearches } from "./recentSearches";

interface SearchSuggestionsProps {
  recent: string[];
  onRecentChange: (next: string[]) => void;
  onPickQuery: (query: string) => void;
  /**
   * Rendu d'une grille d'items — celui de `SearchOverlay`, pour que résultats et
   * suggestions n'aient qu'un seul style de vignette. C'est aussi lui qui porte
   * la sélection, d'où l'absence d'un `onPickItem` ici.
   */
  renderItems: (items: MediaItem[]) => React.ReactNode;
}

/**
 * Ce que montre la recherche tant qu'on n'a rien tapé.
 *
 * Elle n'affichait qu'un « Rechercher... » centré : un plein écran vide, ouvert
 * par un raccourci clavier, qui ne propose rien. Trois blocs le remplacent, dans
 * cet ordre précis :
 *
 *  1. **Recherches récentes** — le plus utile de loin. On recherche très souvent
 *     deux fois la même chose, et retaper une requête qu'on vient de faire est
 *     le geste le plus évitable de l'interface. Coût réseau : zéro.
 *  2. **Reprendre la lecture** — la reprise est l'intention la plus probable de
 *     quelqu'un qui ouvre l'app, recherche comprise.
 *  3. **Prochains épisodes** — la découverte vient en dernier : on ne l'a pas
 *     demandée, elle ne doit pas passer devant ce qu'on cherchait.
 *
 * Les deux rangées de médias réutilisent des requêtes DÉJÀ en cache (l'accueil
 * les a chargées) : ouvrir la recherche ne déclenche donc aucun appel réseau
 * dans le cas courant. C'est la raison de ce choix plutôt qu'un vrai moteur de
 * recommandation — un écran d'attente ne doit rien coûter.
 */
export function SearchSuggestions({
  recent, onRecentChange, onPickQuery, renderItems,
}: SearchSuggestionsProps) {
  const { t } = useTranslation("common");
  const { data: resume } = useResumeItems();
  const { data: nextUp } = useNextUp();

  const resumeItems = resume?.slice(0, 8) ?? [];
  const nextUpItems = nextUp?.slice(0, 8) ?? [];

  if (!recent.length && !resumeItems.length && !nextUpItems.length) {
    return (
      <p className="pt-4 text-center text-sm text-content-quaternary">
        {t("common:searchPlaceholder")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-content-tertiary">
              {t("common:recentSearches")}
            </h2>
            <button
              type="button"
              onClick={() => onRecentChange(clearRecentSearches())}
              className="text-xs text-content-quaternary transition-colors hover:text-content-secondary"
            >
              {t("common:clear")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((query) => (
              <button
                key={query}
                type="button"
                onClick={() => onPickQuery(query)}
                className="rounded-full bg-fill-soft px-3.5 py-1.5 text-sm text-content-secondary ring-1 ring-line-subtle transition-colors hover:bg-fill-medium hover:text-content-primary"
              >
                {query}
              </button>
            ))}
          </div>
        </section>
      )}

      {resumeItems.length > 0 && (
        <SuggestionRow title={t("common:resumeWatching")}>
          {renderItems(resumeItems)}
        </SuggestionRow>
      )}

      {nextUpItems.length > 0 && (
        <SuggestionRow title={t("common:nextEpisodes")}>
          {renderItems(nextUpItems)}
        </SuggestionRow>
      )}
    </div>
  );
}

function SuggestionRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-content-tertiary">
        {title}
      </h2>
      {children}
    </section>
  );
}
