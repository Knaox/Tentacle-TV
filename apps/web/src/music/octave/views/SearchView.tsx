/**
 * Octave — la recherche. Pendant la frappe, des SUGGESTIONS seulement
 * (`OctaveSearchBox`) : aucune recherche complète, aucun résultat qui défile à
 * chaque lettre. Entrée, « Rechercher » ou une suggestion choisie VALIDENT : la
 * requête validée vit dans l'adresse (`?q=` : retour arrière et lien profond la
 * retrouvent), et ses résultats arrivent d'un coup (`useRevealedResults`) —
 * la recherche précédente reste affichée en attendant.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OctaveSearchBox } from "../search/OctaveSearchBox";
import { parseSearchFilter } from "../search/SearchFilters";
import type { SearchFilter } from "../search/searchLayout";
import { SearchResults } from "../search/SearchResults";
import { useTypingPause } from "../search/typingPause";
import { useOctaveSuggestions } from "../search/useOctaveSuggestions";
import { useRevealedResults } from "../search/useRevealedResults";

/** La barre d'attente ne se montre que si l'attente se voit (une recherche en cache n'en a pas). */
const PREPARING_VISIBLE_MS = 150;

function useDelayedFlag(on: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [on, delayMs]);
  return on && shown;
}

export function SearchView() {
  const { t } = useTranslation("music");
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const filter = parseSearchFilter(params.get("f"));
  const [draft, setDraft] = useState(query);
  // Une recherche validée ailleurs (retour arrière, lien) reprend la barre.
  useEffect(() => setDraft(query), [query]);

  const { suggestions, remember, forget } = useOctaveSuggestions(draft);
  // Une pause de frappe, pour qui s'y abonne (recherche préparée du bureau) : rien n'est cherché ni montré ici.
  useTypingPause(draft === query ? "" : draft);
  const results = useRevealedResults(query);
  const preparing = useDelayedFlag(results.preparing, PREPARING_VISIBLE_MS);

  const submit = useCallback(
    (text: string) => {
      setDraft(text);
      remember(text);
      // Une nouvelle recherche repart sur « Tout ».
      setParams({ q: text }, { replace: false });
    },
    [remember, setParams],
  );
  // Une puce ne crée pas d'entrée d'historique : le retour arrière ramène à la recherche précédente.
  const onFilter = useCallback(
    (next: SearchFilter) => setParams(next === "all" ? { q: query } : { q: query, f: next }, { replace: true }),
    [query, setParams],
  );

  return (
    <div className="flex flex-col gap-8 px-2 pb-10 pt-6 md:px-6">
      <div className="sticky top-0 z-10 -mx-2 bg-surface-0 px-2 pb-2 pt-1 md:-mx-6 md:px-6">
        <OctaveSearchBox value={draft} onChange={setDraft} onSubmit={submit} suggestions={suggestions} onForget={forget} />
        {/* Place réservée : la barre d'attente n'ajoute ni ne retire de hauteur. */}
        <div aria-hidden className="mt-2 h-0.5 max-w-2xl overflow-hidden rounded-full">
          {preparing && <div className="h-full w-1/4 animate-loading-bar rounded-full bg-brand motion-reduce:animate-none" />}
        </div>
        {results.preparing && (
          <span className="sr-only" role="status">
            {t("search.preparing")}
          </span>
        )}
      </div>

      {!query.trim() && (
        <div className="px-2 py-10">
          <h1 className="text-2xl font-bold text-content-primary">{t("search.emptyTitle")}</h1>
          <p className="mt-2 text-sm text-content-tertiary">{t("search.emptyHint")}</p>
        </div>
      )}

      {query.trim() && <SearchResults results={results} filter={filter} onFilter={onFilter} />}
    </div>
  );
}
