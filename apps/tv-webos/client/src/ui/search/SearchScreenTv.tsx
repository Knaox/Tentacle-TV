import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSearchDiscover, useSearchEpisodes, useTentacleSearch } from "@tentacle-tv/api-client";
import {
  completionFor, foldForSearch, inlineCompletion, suggestionsFrom,
  type SearchPersonHit, type SearchTopHit,
} from "@tentacle-tv/shared";
import { searchSubmitAnswer, tvSearchNotice, tvSearchSections, type TvSearchFacet } from "@tentacle-tv/tv-core";
import { pushRecentSearch, readRecentSearches } from "@/components/search/recentSearches";
import { registerBack } from "../../focus/back";
import { giveFocus } from "../../focus/active";
import { DEFAULT_ATTRIBUTE } from "../../focus/default";
import { elementKey, findByKey, OVERLAY_ATTRIBUTE, OVERLAY_RESTORING } from "../../focus/memory";
import { SearchBarTv, DictationHint, type SearchBarHandle } from "./SearchBarTv";
import { SearchSuggestionsTv, type SearchSuggestion } from "./SearchSuggestionsTv";
import { SearchResultsTv, type SearchResultsActions } from "./SearchResultsTv";
import { SearchIdleTv } from "./SearchIdleTv";
import { SearchBrowseTv } from "./SearchBrowseTv";
import { useZoneMemory } from "./zoneMemory";
import { useSubmitToResults } from "./submitToResults";
import {
  closeBrowse, closeSearch, isFreshOpen, lastSearchTarget, openBrowse, rememberSearchTarget,
  setSearchQuery, settleOpen, useSearchOpen, useSearchState,
} from "./searchState";

/**
 * Pose le focus sur une cible dès qu'elle est montée ET atteignable, puis
 * appelle `done`. Une boucle de minuteries et non une attente de mutations : la
 * rangée qui la porte entre en fondu d'opacité, et ce fondu ne produit aucune
 * mutation qui relancerait la recherche. Bornée : au-delà, `done` décide.
 */
const RESTORE_BUDGET_MS = 3000;
function focusWhenReady(find: () => HTMLElement | null, done: () => void): () => void {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = () => {
    const target = find();
    if (target) giveFocus(target);
    if (target || Date.now() - started >= RESTORE_BUDGET_MS) {
      done();
      return;
    }
    timer = setTimeout(attempt, 100);
  };
  timer = setTimeout(attempt, 0);
  return () => clearTimeout(timer);
}

/** Le moteur répond en quelques millisecondes : on n'attend que la frappe. */
const DEBOUNCE_MS = 250;
const RESULTS_LIMIT = 12;
const MAX_SUGGESTIONS = 5;

/**
 * La recherche du téléviseur, sur le moteur de Tentacle (`/api/search`).
 *
 * À gauche la saisie — barre (complétion grisée du meilleur résultat), indice
 * de dictée, suggestions qu'un appui reprend ; à droite les résultats en
 * rangées, dans l'ordre commun aux trois téléviseurs (`tvSearchSections`,
 * tv-core). La bibliothèque seule : rien d'extérieur n'est interrogé ici.
 *
 * Une surcouche et non une route (cf. `searchState.ts`) : `App.tsx` n'est pas
 * modifié. La fermeture passe par la pile de la touche Retour, qui referme
 * d'abord la recherche approfondie, puis la recherche.
 */
export function SearchScreenTv() {
  return useSearchOpen() ? <SearchOverlayTv /> : null;
}

function SearchOverlayTv() {
  const { t } = useTranslation(["search", "nav"]);
  const navigate = useNavigate();
  const { query, browse } = useSearchState();
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<SearchBarHandle>(null);
  const main = useRef<HTMLElement>(null);

  const [debounced, setDebounced] = useState(() => query.trim());
  useEffect(() => {
    const identifier = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(identifier);
  }, [query]);

  const search = useTentacleSearch(debounced, { limit: RESULTS_LIMIT });
  const episodes = useSearchEpisodes(debounced, { limit: RESULTS_LIMIT });
  const discover = useSearchDiscover(true);
  const data = search.data;
  // La réponse affichée peut être celle d'une frappe précédente (gardée
  // pendant la requête suivante) : elle reste lisible, atténuée.
  const current = data !== undefined && foldForSearch(data.query) === foldForSearch(debounced);
  const sections = useMemo(() => tvSearchSections(data, episodes.data?.episodes ?? []), [data, episodes.data]);
  const notice = useMemo(() => tvSearchNotice(data), [data]);

  // La complétion suit la saisie brute ; les suggestions, la réponse du moteur.
  const model = useMemo(() => suggestionsFrom(query, data, { correction: false }), [query, data]);
  const completion = query.trim() ? completionFor(query, model) : null;
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    if (!query.trim()) return [];
    const list: SearchSuggestion[] = [];
    if (completion) {
      const names = model.lead !== null
        ? [model.lead]
        : [...model.best.map((hit) => hit.item.Name), ...model.people.map((person) => person.name)];
      const full = names.find((name) => inlineCompletion(query, name) !== null);
      if (full) list.push({ query: full, kind: "complete" });
    }
    for (const proposed of model.queries) list.push({ query: proposed, kind: "query" });
    return list.slice(0, MAX_SUGGESTIONS);
  }, [query, completion, model]);

  const [recents, setRecents] = useState(readRecentSearches);
  // Mémorisée à la SÉLECTION, pas à la frappe : une requête abandonnée en
  // route n'a rien donné, la ressortir serait un mauvais conseil.
  const remember = useCallback(() => {
    if (debounced.length >= 2) setRecents(pushRecentSearch(debounced));
  }, [debounced]);

  // Choisir une requête (suggestion, recherche récente) rend la main à la
  // BARRE, qui la montre : la liste qu'on vient d'employer se reconstruit, et
  // l'élément choisi n'y survit pas toujours.
  const pickQuery = useCallback((next: string) => {
    setSearchQuery(next);
    bar.current?.focusBar();
  }, []);

  // L'entrée : la barre à une ouverture neuve ; au retour d'une fiche, la
  // dernière cible visée — la surcouche est remontée avec son état. Le temps de
  // la retrouver, elle se déclare « en restitution » : le moteur, qui repose le
  // focus à chaque changement d'écran, attend au lieu de viser la bannière.
  useLayoutEffect(() => {
    if (isFreshOpen()) {
      const identifier = setTimeout(() => {
        settleOpen();
        bar.current?.focusBar();
      }, 60);
      return () => clearTimeout(identifier);
    }
    const key = lastSearchTarget();
    const element = root.current;
    if (!key || !element) {
      bar.current?.focusBar();
      return;
    }
    element.setAttribute(OVERLAY_ATTRIBUTE, OVERLAY_RESTORING);
    return focusWhenReady(() => findByKey(key, element), () => {
      element.setAttribute(OVERLAY_ATTRIBUTE, "");
      if (!element.contains(document.activeElement)) bar.current?.focusBar();
    });
  }, []);

  // Retour : la recherche approfondie d'abord — le focus revient à ce qui
  // l'avait ouverte —, puis la recherche elle-même, clavier compris.
  useEffect(() => registerBack(() => {
    const { closed, openerKey } = closeBrowse();
    if (closed) {
      setTimeout(() => {
        const opener = openerKey && root.current ? findByKey(openerKey, root.current) : null;
        if (opener) giveFocus(opener);
        else bar.current?.focusBar();
      }, 0);
      return true;
    }
    bar.current?.blurField();
    return closeSearch();
  }), []);

  // La dernière cible, pour le remontage — et la cible par défaut de la
  // surcouche : si l'élément focalisé disparaît, le moteur y revient.
  const marked = useRef<HTMLElement | null>(null);
  const onFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target === marked.current) return;
    marked.current?.removeAttribute(DEFAULT_ATTRIBUTE);
    target.setAttribute(DEFAULT_ATTRIBUTE, "");
    marked.current = target;
    rememberSearchTarget(elementKey(target));
  }, []);
  const sideMemory = useZoneMemory();
  const mainMemory = useZoneMemory();

  const actions = useMemo<SearchResultsActions>(() => ({
    onOpenItem: (itemId: string) => {
      remember();
      navigate(`/media/${itemId}`);
    },
    onOpenPerson: (person: SearchPersonHit, opener: HTMLElement) => {
      remember();
      openBrowse({ kind: "person", id: person.id, name: person.name }, elementKey(opener));
    },
    onOpenTopPerson: (top: SearchTopHit, opener: HTMLElement) => {
      if (top.kind !== "person") return;
      remember();
      openBrowse({ kind: "person", id: top.hit.id, name: top.hit.name }, elementKey(opener));
    },
    onOpenFacet: (facet: TvSearchFacet, opener: HTMLElement) => {
      remember();
      openBrowse({ kind: facet.kind, name: facet.name }, elementKey(opener));
    },
  }), [navigate, remember]);

  const openGenre = useCallback((name: string, opener: HTMLElement) => {
    openBrowse({ kind: "genre", name }, elementKey(opener));
  }, []);

  const idle = debounced.length === 0;
  const loading = !idle && data === undefined && search.isFetching;
  const empty = !idle && current && !search.isFetching && sections.length === 0;
  const answer = searchSubmitAnswer({
    typed: query, debounced, current, fetching: search.isFetching, failed: search.isError, sections: sections.length,
  });
  const submit = useSubmitToResults(answer, main, bar);
  const overlayProps = { [OVERLAY_ATTRIBUTE]: "" };

  return (
    <div
      ref={root}
      className="tv-search"
      role="dialog"
      aria-modal="true"
      aria-label={t("search:dialog")}
      onFocus={onFocus}
      {...overlayProps}
    >
      <div className="tv-search-content" data-covered={browse !== null}>
        <aside className="tv-search-side" data-tv-zone="search-input" onFocus={sideMemory}>
          <h1 className="tv-search-title">{t("nav:search")}</h1>
          <SearchBarTv ref={bar} query={query} completion={completion} onChange={setSearchQuery} onSubmit={submit} />
          <DictationHint />
          <SearchSuggestionsTv suggestions={suggestions} onPick={pickQuery} />
        </aside>
        {/* Toute ouverture d'un titre depuis les résultats passe par un clic :
            c'est là qu'on mémorise la recherche, quel que soit le composant. */}
        <main ref={main} className="tv-search-main" data-tv-zone="search-results" onFocus={mainMemory} onClickCapture={remember}>
          {idle || empty ? (
            <SearchIdleTv
              mode={idle ? "idle" : "empty"}
              query={debounced}
              recents={recents}
              genres={discover.data?.genres ?? []}
              onPickQuery={pickQuery}
              onOpenGenre={openGenre}
            />
          ) : loading ? (
            <p className="tv-search-message">{t("search:searching")}</p>
          ) : (
            <div className="tv-search-results" data-stale={!current}>
              <SearchResultsTv sections={sections} notice={notice} actions={actions} />
            </div>
          )}
        </main>
      </div>
      {browse && <SearchBrowseTv target={browse} />}
    </div>
  );
}
