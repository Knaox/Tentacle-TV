/**
 * La recherche d'un compte, de bout en bout : la requête lue, le moteur du
 * serveur interrogé, les droits du compte appliqués, le classement final, et
 * la réponse rangée comme l'écran la montre — un meilleur résultat, puis
 * films, séries, collections, personnes, genres.
 *
 * Tout se passe en mémoire : aucun aller-retour vers Jellyfin par frappe, sauf
 * à la toute première recherche d'un compte (ses droits) ou tant que l'index
 * se construit (le repli). Les épisodes ont leur propre requête
 * (`jellyfinSearch.ts`), que le client attend sans bloquer celle-ci.
 *
 * Quand la requête telle quelle ne trouve RIEN mais qu'une orthographe proche
 * trouve, c'est elle qu'on cherche — « Résultats pour … », comme Google.
 */

import { parseSearchQuery, type ParsedSearchQuery } from "../../search/searchText";
import type {
  SearchFacetHit, SearchItemHit, SearchMediaItem, SearchPersonHit, SearchResponse, SearchTopHit,
} from "../../search/searchTypes";
import { currentEngine } from "./catalog";
import { correctionOf, particleJoin, type ItemCandidate, type SearchEngine } from "./engine";
import { fallbackItems } from "./jellyfinSearch";
import { rankBoost } from "./ranking";
import { toItemHit, toPersonHit } from "./shaping";
import { getUserAccess, type UserAccess } from "./userAccess";

/** Les genres, les studios proposés en pastilles, au plus. */
const FACETS_SHOWN = 4;
/** Sous ce nombre de titres visibles, la passe stricte a sans doute buté sur une faute. */
const FEW_RESULTS = 3;
/** Les correspondances qui se replient en pastilles quand mieux répond. */
const FACETS: ReadonlySet<string> = new Set(["genre", "studio"]);

/** Genres et studios en pastilles : ce que chacun couvre POUR LE COMPTE. */
function facets(entries: Array<{ name: string; itemIds: string[] }>, access: UserAccess): SearchFacetHit[] {
  return entries
    .map((entry) => ({ name: entry.name, count: entry.itemIds.filter((id) => access.items.has(id)).length }))
    .filter((entry) => entry.count > 0)
    .slice(0, FACETS_SHOWN);
}

interface RankedItem { hit: SearchItemHit; candidate: ItemCandidate }
interface RankedPerson { hit: SearchPersonHit; fullName: boolean; corrections: Map<string, string> }

function emptyResponse(query: string, ready: boolean, started: number): SearchResponse {
  return {
    query, ready, tookMs: Math.round(performance.now() - started), correction: null, partial: false,
    top: null, movies: [], series: [], collections: [], people: [], genres: [], studios: [],
    totals: { movies: 0, series: 0, collections: 0, people: 0 },
  };
}

/** Films, séries, collections : un groupe par type, dans l'ordre du classement. */
function group(hits: readonly SearchItemHit[], limit: number): Pick<SearchResponse, "movies" | "series" | "collections" | "totals"> {
  const movies = hits.filter((h) => h.item.Type === "Movie");
  const series = hits.filter((h) => h.item.Type === "Series");
  const collections = hits.filter((h) => h.item.Type === "BoxSet");
  return {
    movies: movies.slice(0, limit),
    series: series.slice(0, limit),
    collections: collections.slice(0, limit),
    totals: { movies: movies.length, series: series.length, collections: collections.length, people: 0 },
  };
}

/**
 * ET strict d'abord ; la passe LARGE (lettres inversées) quand il trouve trop
 * peu ; OU seulement si rien de visible ne répond à tous les mots.
 */
function findCandidates(engine: SearchEngine, access: UserAccess, parsed: ParsedSearchQuery): { candidates: ItemCandidate[]; partial: boolean } {
  const visible = (list: ItemCandidate[]) => list.filter((c) => access.items.has(c.id));
  let candidates = visible(engine.searchItems(parsed, "AND"));
  if (candidates.length < FEW_RESULTS) {
    const known = new Set(candidates.map((c) => c.id));
    candidates = candidates.concat(visible(engine.searchItems(parsed, "AND", true)).filter((c) => !known.has(c.id)));
  }
  if (candidates.length === 0 && parsed.terms.length > 1) {
    candidates = visible(engine.searchItems(parsed, "OR"));
    return { candidates, partial: candidates.length > 0 };
  }
  // Des titres répondent sans faute : ceux qui ne répondent qu'avec des fautes
  // sont d'AUTRES titres — « dune » ne propose pas *First Man… sur la Lune*.
  if (candidates.some((c) => c.analysis.solid)) candidates = candidates.filter((c) => c.analysis.solid);
  // Un titre, une personne répondent : ce qui ne tient qu'au genre ou au
  // studio se replie dans sa pastille — « dune » ne liste pas les films de
  // Dune Entertainment, « marvel » propose Marvel Studios en pastille.
  if (candidates.some((c) => !FACETS.has(c.match.field))) candidates = candidates.filter((c) => !FACETS.has(c.match.field));
  return { candidates, partial: false };
}

function rankItems(engine: SearchEngine, access: UserAccess, parsed: ParsedSearchQuery): { ranked: RankedItem[]; partial: boolean } {
  const { candidates, partial } = findCandidates(engine, access, parsed);
  const ranked: RankedItem[] = [];
  for (const candidate of candidates) {
    const item = engine.items.get(candidate.id);
    const userData = access.items.get(candidate.id);
    if (item === undefined || userData === undefined) continue;
    // Trouvé par son casting : la notoriété de la personne dans la
    // bibliothèque départage — « christopher » met Nolan avant un figurant.
    const personHit = candidate.analysis.hits.flat().find((h) => h.field === "people" && h.entry !== undefined);
    const personId = personHit?.entry === undefined ? undefined : item.people[personHit.entry]?.id;
    const renown = personId === undefined ? 0 : (engine.persons.get(personId)?.itemIds.length ?? 0);
    const score = candidate.score * rankBoost(item, candidate, engine.titleOf(candidate.id), parsed, userData)
      * (1 + 0.2 * Math.log2(1 + renown));
    ranked.push({ hit: toItemHit(item, userData, candidate.match, score), candidate });
  }
  ranked.sort((a, b) => b.hit.score - a.hit.score);
  return { ranked, partial };
}

/**
 * Les personnes visibles. Une personne trouvée SEULEMENT avec des fautes ne
 * sort que si aucun titre ne répond — ni par son titre, ni sans faute
 * ailleurs : « stranger » ne propose pas Robert Strange à côté de *Stranger
 * Things*, ni « pixar » une actrice prénommée Piper devant les films du studio.
 */
function rankPeople(engine: SearchEngine, access: UserAccess, parsed: ParsedSearchQuery, itemsAnswer: boolean): RankedPerson[] {
  const strict = engine.searchPersons(parsed);
  const people: RankedPerson[] = [];
  for (const candidate of strict.length > 0 ? strict : engine.searchPersons(parsed, true)) {
    if (!candidate.fullNameMatch && itemsAnswer) continue;
    const person = engine.persons.get(candidate.id);
    if (person === undefined) continue;
    const visible = person.itemIds.filter((id) => access.items.has(id)).length;
    // Une personne qui ne figure que dans des titres invisibles au compte
    // n'existe pas pour lui : son nom même ne doit pas sortir.
    if (visible === 0) continue;
    // La notoriété DANS LA BIBLIOTHÈQUE départage les homonymes :
    // « christopher » met Christopher Nolan (5 titres) devant un figurant.
    const score = candidate.score * (1 + 0.35 * Math.log2(1 + visible));
    people.push({ hit: toPersonHit(person, visible, score), fullName: candidate.fullNameMatch, corrections: candidate.corrections });
  }
  return people.sort((a, b) => Number(b.fullName) - Number(a.fullName) || b.hit.score - a.hit.score);
}

/**
 * Le meilleur résultat : un TITRE qui répond par son titre ; sinon la
 * PERSONNE (« tom hanks », « nolan ») ; sinon rien — un film trouvé par son
 * genre ou son studio n'est pas « le » résultat. Un nom juste l'emporte sur un
 * titre trouvé avec des fautes.
 */
function topHit(items: readonly RankedItem[], people: readonly RankedPerson[]): SearchTopHit | null {
  const [bestItem] = items;
  const [bestPerson] = people;
  const titled = bestItem?.candidate.analysis.byTitle === true;
  if (titled && bestItem !== undefined && !(bestPerson?.fullName && !bestItem.candidate.analysis.titleSolid)) {
    return { kind: "item", hit: bestItem.hit };
  }
  if (bestPerson !== undefined) return { kind: "person", hit: bestPerson.hit };
  return null;
}

/**
 * La correction : les mots du meilleur titre trouvé avec des fautes, sinon
 * ceux de la meilleure personne. Aucune quand quelque chose répond sans faute.
 */
function correctionFor(parsed: ParsedSearchQuery, items: readonly RankedItem[], people: readonly RankedPerson[]): string | null {
  if (items.some((r) => r.candidate.analysis.solid) || people.some((p) => p.fullName)) return null;
  const titled = items.find((r) => r.candidate.analysis.byTitle && r.candidate.analysis.corrections.size > 0);
  if (titled !== undefined) return correctionOf(parsed, titled.candidate.analysis.corrections);
  const named = people.find((p) => p.corrections.size > 0);
  return named === undefined ? null : correctionOf(parsed, named.corrections);
}

/** Repli tant que l'index se construit : Jellyfin seul, dans la même forme. */
async function fallbackSearch(userId: string, query: string, limit: number, started: number): Promise<SearchResponse> {
  const found: SearchMediaItem[] = await fallbackItems(userId, query, limit * 3).catch(() => []);
  const hits = found.map((item, i): SearchItemHit => ({ item, match: { field: "title" }, score: found.length - i }));
  const [first, ...rest] = hits;
  return {
    ...emptyResponse(query, false, started),
    top: first === undefined ? null : { kind: "item", hit: first },
    ...group(rest, limit),
  };
}

/** Une requête évaluée, avant d'être rangée en réponse. */
interface Evaluation {
  parsed: ParsedSearchQuery;
  ranked: RankedItem[];
  people: RankedPerson[];
  partial: boolean;
  correction: string | null;
  /** Quelque chose répond SANS faute : un titre, ou le nom d'une personne. */
  strong: boolean;
}

function evaluate(engine: SearchEngine, access: UserAccess, query: string): Evaluation {
  const parsed = parseSearchQuery(query);
  const { ranked, partial } = rankItems(engine, access, parsed);
  const itemsAnswer = ranked.some((r) => r.candidate.analysis.solid || r.candidate.analysis.byTitle);
  const people = rankPeople(engine, access, parsed, itemsAnswer);
  return {
    parsed,
    ranked,
    people,
    partial,
    correction: correctionFor(parsed, ranked, people),
    strong: ranked.some((r) => r.candidate.analysis.solid) || people.some((p) => p.fullName),
  };
}

function respond(engine: SearchEngine, access: UserAccess, e: Evaluation, query: string, limit: number, started: number): SearchResponse {
  const top = topHit(e.ranked, e.people);
  const items = e.ranked.map((r) => r.hit).filter((h) => !(top?.kind === "item" && h.item.Id === top.hit.item.Id));
  const genres = facets(engine.matchGenres(e.parsed), access);
  const studios = facets(engine.matchStudios(e.parsed), access);
  // Les totaux comptent le meilleur résultat, que les listes ne répètent pas.
  const totals = group(e.ranked.map((r) => r.hit), 0).totals;
  return {
    query,
    ready: true,
    tookMs: Math.round(performance.now() - started),
    correction: e.correction,
    partial: e.partial,
    top,
    ...group(items, limit),
    people: e.people.map((p) => p.hit).filter((p) => !(top?.kind === "person" && p.id === top.hit.id)).slice(0, limit),
    genres,
    studios,
    totals: { ...totals, people: e.people.length },
  };
}

/**
 * Rien de FRANC pour la requête telle quelle : une particule détachée
 * (« di caprio »), puis l'orthographe proche — la première réécriture qui
 * répond sans faute est cherchée à sa place, et « Résultats pour … ».
 */
function searchWith(engine: SearchEngine, access: UserAccess, query: string, limit: number, started: number): SearchResponse {
  const first = evaluate(engine, access, query);
  if (!first.strong) {
    for (const rewrite of [particleJoin(first.parsed), first.correction]) {
      if (rewrite === null) continue;
      const second = evaluate(engine, access, rewrite);
      if (second.strong) return respond(engine, access, { ...second, correction: rewrite }, query, limit, started);
    }
  }
  return respond(engine, access, first, query, limit, started);
}

export async function runSearch(userId: string, query: string, limit: number): Promise<SearchResponse> {
  const started = performance.now();
  const engine = currentEngine();
  if (parseSearchQuery(query).terms.length === 0) return emptyResponse(query, engine !== null, started);
  const access = engine === null ? null : await getUserAccess(userId);
  if (engine === null || access === null) return fallbackSearch(userId, query, limit, started);
  return searchWith(engine, access, query, limit, started);
}
