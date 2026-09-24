import { foldForSearch } from "./searchText";
import { inlineCompletion } from "./searchHighlight";
import type { ExternalKind } from "./pluginSearch";
import type { SearchItemHit, SearchPersonHit, SearchResponse } from "./searchTypes";

/**
 * Les suggestions de frappe tirées d'une réponse du moteur — pures, communes
 * au mobile et aux téléviseurs (Apple TV, Android TV, LG) : une seule règle
 * de complétion et de requêtes proposées, quelle que soit la saisie.
 */

/** Ce que le moteur permet de proposer pendant la frappe. */
export interface SuggestionModel {
  /** Le nom du meilleur résultat du moteur (titre ou personne) — ce que la complétion suit d'abord. */
  lead: string | null;
  /** Des requêtes à reprendre d'une pression — jamais un titre déjà listé. */
  queries: string[];
  /** Les meilleurs résultats, dans l'ordre du moteur. */
  best: SearchItemHit[];
  people: SearchPersonHit[];
}

const MAX_QUERIES = 4;
const MAX_BEST = 4;
/** Assez de titres pour voir une franchise, pas au point d'en noyer une. */
const FRANCHISE_POOL = 12;
/** Ce qu'une franchise ne garde pas en bout : « Harry Potter et » → « Harry Potter ». */
const LINK_WORDS = new Set(["et", "la", "le", "les", "l", "de", "du", "des", "d", "un", "une", "the", "and", "of", "a", "an"]);

function kindOf(hit: SearchItemHit): ExternalKind | null {
  return hit.item.Type === "Movie" ? "movie" : hit.item.Type === "Series" ? "series" : null;
}

/**
 * La franchise commune aux titres qui commencent par la saisie — « harr » →
 * « Harry Potter » quand plusieurs Harry Potter répondent. Mot à mot, dans la
 * casse du premier titre ; les mots de liaison et la ponctuation de bout
 * tombent. `null` à moins de deux titres, ou si le préfixe n'ajoute rien.
 *
 * C'est une requête qui SERT : un filtre de bibliothèque (qui compare les
 * titres) la comprend, là où le nom d'une collection ne trouverait rien.
 */
export function franchisePrefix(names: readonly string[], typed: string): string | null {
  const folded = foldForSearch(typed.trim());
  if (folded === "") return null;
  const words = names
    .filter((name) => foldForSearch(name).startsWith(folded))
    .map((name) => name.split(/\s+/).filter(Boolean));
  if (words.length < 2) return null;
  const [first] = words;
  let shared = 0;
  while (
    shared < first.length
    && words.every((w) => w[shared] !== undefined && foldForSearch(w[shared]) === foldForSearch(first[shared]))
  ) shared++;
  const kept = first.slice(0, shared);
  // « : » se plie en rien, « et » est un mot de liaison : aucun ne finit une franchise.
  while (kept.length > 0) {
    const last = foldForSearch(kept[kept.length - 1]);
    if (last !== "" && !LINK_WORDS.has(last)) break;
    kept.pop();
  }
  const prefix = kept.join(" ").replace(/[\s:,.;–—-]+$/u, "");
  return foldForSearch(prefix).length > folded.length ? prefix : null;
}

/**
 * Les suggestions tirées d'une réponse du moteur — pur, partagé par les barres
 * locales (qui interrogent le moteur elles-mêmes) et par la recherche (qui a
 * déjà sa réponse). `kind` resserre sur un type : une bibliothèque de films ne
 * propose que des films. `people` : les personnes et les collections, que
 * seule la recherche complète sait chercher — un filtre de page, lui, ne
 * compare que des titres. `correction: false` là où la correction se dit déjà
 * (l'avis « Résultats pour … » de la recherche).
 */
export function suggestionsFrom(
  query: string,
  data: SearchResponse | undefined,
  { kind = null, people = true, correction = true }: { kind?: ExternalKind | null; people?: boolean; correction?: boolean } = {},
): SuggestionModel {
  if (!data) return { lead: null, queries: [], best: [], people: [] };
  const pool: SearchItemHit[] = kind === "movie" ? data.movies
    : kind === "series" ? data.series
    : [...data.movies, ...data.series, ...data.collections];
  const byScore = [...pool].sort((a, b) => b.score - a.score);
  // Le meilleur résultat n'est PAS répété dans sa catégorie : son type décide.
  const topHit = data.top?.kind === "item" ? data.top.hit : null;
  const top = topHit && (kind === null || kindOf(topHit) === kind) ? [topHit] : [];
  const seen = new Set<string>();
  const best = [...top, ...byScore]
    .filter((hit) => (seen.has(hit.item.Id) ? false : (seen.add(hit.item.Id), true)))
    .slice(0, MAX_BEST);
  const shownPeople = people && kind === null ? data.people.slice(0, 2) : [];
  // La personne en tête n'est pas répétée dans `people` non plus.
  const lead = data.top?.kind === "person"
    ? (people && kind === null ? data.top.hit.name : null)
    : (top[0]?.item.Name ?? null);

  // Une requête ne répète jamais ce que la liste montre déjà, ni la saisie.
  const folded = foldForSearch(query.trim());
  const taken = new Set([folded, ...best.map((h) => foldForSearch(h.item.Name))]);
  if (lead !== null) taken.add(foldForSearch(lead));
  const queries: string[] = [];
  const add = (value: string | null) => {
    if (value === null) return;
    const key = foldForSearch(value);
    if (key === "" || taken.has(key)) return;
    taken.add(key);
    queries.push(value);
  };
  if (correction) add(data.correction);
  add(franchisePrefix([...top, ...byScore].slice(0, FRANCHISE_POOL).map((h) => h.item.Name), query));
  if (people && kind === null) {
    for (const hit of data.collections) if (foldForSearch(hit.item.Name).startsWith(folded)) add(hit.item.Name);
    for (const person of data.people) if (foldForSearch(person.name).startsWith(folded)) add(person.name);
  }

  return { lead, queries: queries.slice(0, MAX_QUERIES), best, people: shownPeople };
}

/**
 * La suite du meilleur résultat après ce qui est tapé À L'INSTANT (« Harry » →
 * « Potter… ») — celle du meilleur résultat du moteur SEUL, comme au bureau :
 * « tom holland » ne se complète pas en « Tom Hollander » quand Tom Holland est
 * en tête. Sans meilleur résultat (une barre locale l'a écarté), le premier
 * titre qui convient. Rien quand la saisie est déjà un nom entier. Calculée
 * sur la saisie brute : la complétion suit chaque lettre sans attendre le moteur.
 */
export function completionFor(typed: string, s: Pick<SuggestionModel, "lead" | "best" | "people">): string | null {
  const names = s.lead !== null ? [s.lead] : [...s.best.map((h) => h.item.Name), ...s.people.map((p) => p.name)];
  const folded = foldForSearch(typed.trim());
  if (names.some((name) => foldForSearch(name) === folded)) return null;
  for (const name of names) {
    const completion = inlineCompletion(typed, name);
    if (completion !== null) return completion;
  }
  return null;
}
