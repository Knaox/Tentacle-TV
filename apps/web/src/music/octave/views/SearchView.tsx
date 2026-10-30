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
import { useSharedLinkSearch } from "@tentacle-tv/api-client";
import { OctaveSearchBox } from "../search/OctaveSearchBox";
import { parseSearchFilter } from "../search/SearchFilters";
import type { SearchFilter } from "../search/searchLayout";
import { SearchResults } from "../search/SearchResults";
import { useTypingPause } from "../data/typingPause";
import { useOctaveSuggestions } from "../search/useOctaveSuggestions";
import { useRevealedResults } from "../search/useRevealedResults";
import { SearchHome } from "../search/SearchHome";
import { SearchMoodResultsSlot } from "../home/ambianceSlots";

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

  const { suggestions, recents, remember, forget, history } = useOctaveSuggestions(draft);
  // La recherche préparée à la pause de frappe (bureau seulement, axe R7) : rien n'est cherché ni montré ici.
  const pause = useTypingPause();
  useEffect(() => {
    if (draft !== query) pause.note(draft);
  }, [draft, pause, query]);
  // Un lien Shazam collé : on cherche son titre, jamais le lien lui-même.
  const goShared = useCallback((text: string, replace: boolean) => {
    pause.cancel();
    setDraft(text);
    setParams({ q: text }, { replace });
  }, [pause, setParams]);
  const shared = useSharedLinkSearch({ query, draft, go: goShared, remember });
  const searched = shared.isLink ? "" : query;
  const results = useRevealedResults(searched);
  const preparing = useDelayedFlag(results.preparing || shared.pending, PREPARING_VISIBLE_MS);

  const submit = useCallback(
    (text: string) => {
      pause.cancel();
      setDraft(text);
      remember(text);
      // Une nouvelle recherche repart sur « Tout ».
      setParams({ q: text }, { replace: false });
    },
    [pause, remember, setParams],
  );
  // Le ✕ du champ ramène à l'état d'avant la frappe ; le retour arrière retrouve la recherche quittée.
  const clear = useCallback(() => {
    pause.cancel();
    setDraft("");
    if (query) setParams({}, { replace: false });
  }, [pause, query, setParams]);
  // Une puce ne crée pas d'entrée d'historique : le retour arrière ramène à la recherche précédente.
  const onFilter = useCallback(
    (next: SearchFilter) => setParams(next === "all" ? { q: query } : { q: query, f: next }, { replace: true }),
    [query, setParams],
  );

  return (
    <div className="flex flex-col gap-8 px-2 pb-10 pt-6 md:px-6">
      <div className="octave-search-band sticky top-0 z-10 -mx-2 bg-surface-0 px-2 pb-2 pt-1 md:-mx-6 md:px-6">
        <OctaveSearchBox value={draft} onChange={setDraft} onSubmit={submit} suggestions={suggestions} onForget={forget} onClear={clear} />
        {/* Place réservée : la barre d'attente n'ajoute ni ne retire de hauteur. */}
        <div aria-hidden className="mt-2 h-0.5 max-w-2xl overflow-hidden rounded-full">
          {preparing && <div className="h-full w-1/4 animate-loading-bar rounded-full bg-octave-accent motion-reduce:animate-none" />}
        </div>
        {results.preparing && (
          <span className="sr-only" role="status">
            {t("search.preparing")}
          </span>
        )}
      </div>

      {shared.isLink && (
        <p className="text-sm text-content-secondary" role="status">
          {shared.failed ? t("search.sharedLinkFailed") : t("search.sharedLinkReading")}
        </p>
      )}

      {/* Avant la frappe : le « déjà écouté » et les recherches récentes, dans la page. */}
      {!query.trim() && <SearchHome recents={recents} history={history} onSearch={submit} />}

      {searched.trim() && <SearchMoodResultsSlot query={searched} onSearch={submit} />}
      {searched.trim() && <SearchResults results={results} filter={filter} onFilter={onFilter} />}
    </div>
  );
}
