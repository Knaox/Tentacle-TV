/**
 * Le MOTEUR de recherche — pur : un catalogue en entrée, des candidats classés
 * en sortie. Ni Jellyfin, ni compte : les droits se filtrent après
 * (`searchService.ts`).
 *
 * Deux index MiniSearch (BM25, préfixes, distance d'édition) :
 *
 * - les TITRES : titre (poids 6), variantes (paires soudées, numéros — 4,5),
 *   titre original (4), casting (1,6), genres (1,2), studios (0,9) ;
 * - les PERSONNES : leur nom, poussé par le nombre de titres où elles figurent.
 *
 * MiniSearch trouve LARGE ; chaque candidat est ensuite relu terme par terme
 * (`matchAnalysis.ts`) — c'est là que se décident la cohérence, la raison
 * affichée et la correction d'orthographe. Tolérance aux fautes :
 * `fuzziness.ts`. Préfixes dès deux lettres : la frappe en cours trouve déjà.
 */

import MiniSearch, { type SearchOptions } from "minisearch";
import { foldForSearch, searchTokens, titleVariants, type ParsedSearchQuery } from "../../search/searchText";
import type { SearchMatch } from "../../search/searchTypes";
import type { CatalogItem } from "./catalogSource";
import { fuzziness } from "./fuzziness";
import { analyze, type Analysis, type DocWords, type TermHit } from "./matchAnalysis";

export interface EnginePerson {
  id: string;
  name: string;
  imageTag: string | null;
  /** Rôle → nombre de titres. */
  roles: Map<string, number>;
  itemIds: string[];
}

export interface ItemCandidate {
  id: string;
  score: number;
  match: SearchMatch;
  /** Titre plié égal à la requête pliée. */
  exactTitle: boolean;
  analysis: Analysis;
}

export interface PersonCandidate {
  id: string;
  score: number;
  /** Tous les termes commencent un mot du nom, sans faute : « tom hanks ». */
  fullNameMatch: boolean;
  /** Terme fautif → le mot du nom qu'il visait. */
  corrections: Map<string, string>;
}

interface ItemDoc { id: string; title: string; alt: string; original: string; people: string; genres: string; studios: string }
interface PersonDoc { id: string; name: string }

const WORDS = (text: string): string[] => text.split(" ").filter((t) => t.length > 0);
const SAME = (term: string): string => term;
/** Au-delà, un candidat ne sera jamais affiché : inutile de le relire. */
const CANDIDATES_READ = 400;

/**
 * Les mots d'un nom, et ses paires soudées — particules comprises, qui font
 * le nom : « Robert De Niro » se trouve aussi par « deniro ».
 */
function nameWords(name: string): string[] {
  const words = searchTokens(name);
  const joined: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) joined.push(`${words[i] ?? ""}${words[i + 1] ?? ""}`);
  return words.concat(joined);
}

/** Les particules qui se soudent au nom : « Di Caprio », « Van Damme », « Mc Queen ». */
const PARTICLES: ReadonlySet<string> = new Set([
  "di", "de", "da", "du", "del", "della", "van", "von", "der", "den", "ter", "ten",
  "mc", "mac", "le", "la", "st", "dos", "das", "o", "d", "l",
]);

/**
 * La particule recollée au nom qui la suit : « leonardo di caprio » →
 * « leonardo dicaprio ». La première paire seulement ; `null` s'il n'y en a pas.
 */
export function particleJoin(parsed: ParsedSearchQuery): string | null {
  const words = parsed.folded.split(" ");
  for (let i = 0; i + 1 < words.length; i++) {
    const particle = words[i] ?? "";
    const name = words[i + 1] ?? "";
    if (PARTICLES.has(particle) && name.length >= 3) {
      return [...words.slice(0, i), particle + name, ...words.slice(i + 2)].join(" ");
    }
  }
  return null;
}

function baseOptions(loose: boolean): SearchOptions {
  return {
    prefix: (term: string) => term.length >= 2,
    fuzzy: (term: string) => fuzziness(term, loose),
    maxFuzzy: 2,
    tokenize: WORDS,
    processTerm: SAME,
  };
}

export class SearchEngine {
  readonly items = new Map<string, CatalogItem>();
  readonly persons = new Map<string, EnginePerson>();
  /** Genre plié → nom affiché et titres. */
  readonly genres = new Map<string, { name: string; itemIds: string[] }>();
  /** Studio plié → nom affiché et titres. */
  readonly studios = new Map<string, { name: string; itemIds: string[] }>();
  private readonly docs = new Map<string, { folded: string; words: DocWords }>();
  private readonly itemIndex: MiniSearch<ItemDoc>;
  private readonly personIndex: MiniSearch<PersonDoc>;
  private readonly itemBoost = new Map<string, number>();
  private readonly personBoost = new Map<string, number>();

  constructor(catalog: readonly CatalogItem[]) {
    const docs: ItemDoc[] = [];
    for (const item of catalog) {
      if (this.items.has(item.id)) continue;
      this.items.set(item.id, item);
      const title = searchTokens(item.name);
      const original = item.originalTitle ? searchTokens(item.originalTitle) : [];
      const variants = titleVariants(title).concat(titleVariants(original));
      const people = item.people.map((p) => nameWords(p.name));
      const genres = item.genres.map(searchTokens);
      const studios = item.studios.map(searchTokens);
      this.docs.set(item.id, {
        folded: title.join(" "),
        words: { title: title.concat(variants), titleLength: title.length, original, people, genres, studios },
      });
      docs.push({
        id: item.id, title: title.join(" "), alt: variants.join(" "), original: original.join(" "),
        people: people.flat().join(" "), genres: genres.flat().join(" "), studios: studios.flat().join(" "),
      });
      this.itemBoost.set(item.id, popularity(item));
      this.collectPersons(item);
      collectFacet(this.genres, item.genres, item.id);
      collectFacet(this.studios, item.studios, item.id);
    }
    this.itemIndex = new MiniSearch<ItemDoc>({
      idField: "id",
      fields: ["title", "alt", "original", "people", "genres", "studios"],
      tokenize: WORDS,
      processTerm: SAME,
    });
    this.itemIndex.addAll(docs);
    this.personIndex = new MiniSearch<PersonDoc>({ idField: "id", fields: ["name"], tokenize: WORDS, processTerm: SAME });
    this.personIndex.addAll([...this.persons.values()].map((p) => ({ id: p.id, name: nameWords(p.name).join(" ") })));
    for (const person of this.persons.values()) {
      this.personBoost.set(person.id, 1 + Math.log2(1 + person.itemIds.length) * 0.12);
    }
  }

  get size(): number {
    return this.items.size;
  }

  /** Le titre plié et ses mots (variantes comprises) — la matière du classement. */
  titleOf(id: string): { folded: string; words: string[] } | undefined {
    const doc = this.docs.get(id);
    return doc === undefined ? undefined : { folded: doc.folded, words: doc.words.title };
  }

  private collectPersons(item: CatalogItem): void {
    for (const ref of item.people) {
      let person = this.persons.get(ref.id);
      if (person === undefined) {
        person = { id: ref.id, name: ref.name, imageTag: null, roles: new Map(), itemIds: [] };
        this.persons.set(ref.id, person);
      }
      person.imageTag ??= item.personImages[ref.id] ?? null;
      person.roles.set(ref.role, (person.roles.get(ref.role) ?? 0) + 1);
      if (person.itemIds[person.itemIds.length - 1] !== item.id) person.itemIds.push(item.id);
    }
  }


  /** Les titres qui répondent de façon COHÉRENTE — ET d'abord, OU quand l'appelant élargit. */
  searchItems(parsed: ParsedSearchQuery, combineWith: "AND" | "OR", loose = false): ItemCandidate[] {
    if (parsed.terms.length === 0) return [];
    const results = this.itemIndex.search(parsed.terms.join(" "), {
      ...baseOptions(loose),
      combineWith,
      boost: { title: 6, alt: 4.5, original: 4, people: 1.6, genres: 1.2, studios: 0.9 },
      boostDocument: (id) => this.itemBoost.get(String(id)) ?? 1,
    });
    const candidates: ItemCandidate[] = [];
    for (const result of results.slice(0, CANDIDATES_READ)) {
      const id = String(result.id);
      const doc = this.docs.get(id);
      const item = this.items.get(id);
      if (doc === undefined || item === undefined) continue;
      const analysis = analyze(parsed.terms, doc.words, combineWith === "OR");
      if (!analysis.coherent) continue;
      candidates.push({
        id,
        score: result.score,
        match: matchOf(item, analysis),
        exactTitle: doc.folded === parsed.folded,
        analysis,
      });
    }
    return candidates;
  }

  /**
   * Les personnes dont CHAQUE terme répond au nom. Sans faute, toujours ; avec
   * fautes, seulement si un terme au moins est juste, ou que chaque terme a
   * cinq lettres et UNE seule faute — « dune » ne propose pas June Squibb, ni
   * « frorest » Nick Frost.
   */
  searchPersons(parsed: ParsedSearchQuery, loose = false): PersonCandidate[] {
    if (parsed.terms.length === 0) return [];
    const results = this.personIndex.search(parsed.terms.join(" "), {
      ...baseOptions(loose),
      combineWith: "AND",
      boostDocument: (id) => this.personBoost.get(String(id)) ?? 1,
    });
    const candidates: PersonCandidate[] = [];
    for (const result of results.slice(0, CANDIDATES_READ)) {
      const id = String(result.id);
      const words = nameWords(this.persons.get(id)?.name ?? "");
      const doc: DocWords = { title: words, titleLength: words.length, original: [], people: [], genres: [], studios: [] };
      const { hits, corrections } = analyze(parsed.terms, doc, false);
      if (!hits.every((h) => h.length > 0)) continue;
      const solid = hits.map((h) => h.some((x) => x.solid));
      // Le NOM, pas un début de nom : un mot entier, ou un préfixe d'au moins
      // quatre lettres — « toy » n'est pas le nom de Kikunosuke Toya.
      const fullNameMatch = hits.every((h, i) => h.some((x) => x.exact || (x.solid && (parsed.terms[i]?.length ?? 0) >= 4)));
      const nearMiss = parsed.terms.every((t) => t.length >= 5) && hits.every((h) => h.some((x) => x.distance <= 1));
      if (!fullNameMatch && !solid.some(Boolean) && !nearMiss) continue;
      candidates.push({ id, score: result.score, fullNameMatch, corrections });
    }
    return candidates;
  }

  /** Les genres dont chaque terme commence un mot : « com » → Comédie, « sci fi » → Science-Fiction. */
  matchGenres(parsed: ParsedSearchQuery): Array<{ name: string; itemIds: string[] }> {
    return matchFacet(this.genres, parsed);
  }

  /** Les studios dont chaque terme commence un mot : « pixar », « marvel ». */
  matchStudios(parsed: ParsedSearchQuery): Array<{ name: string; itemIds: string[] }> {
    return matchFacet(this.studios, parsed);
  }
}

type Facet = Map<string, { name: string; itemIds: string[] }>;

function collectFacet(facet: Facet, names: readonly string[], itemId: string): void {
  for (const name of names) {
    const key = foldForSearch(name);
    if (key === "") continue;
    const entry = facet.get(key) ?? { name, itemIds: [] };
    entry.itemIds.push(itemId);
    facet.set(key, entry);
  }
}

function matchFacet(facet: Facet, parsed: ParsedSearchQuery): Array<{ name: string; itemIds: string[] }> {
  if (parsed.terms.length === 0) return [];
  const found: Array<{ name: string; itemIds: string[] }> = [];
  for (const [key, entry] of facet) {
    const words = key.split(" ");
    if (parsed.terms.every((t) => words.some((w) => w.startsWith(t)))) found.push(entry);
  }
  return found.sort((a, b) => b.itemIds.length - a.itemIds.length);
}

/** La correction d'une requête : ses propres mots, les fautifs remplacés un à un. */
export function correctionOf(parsed: ParsedSearchQuery, corrections: ReadonlyMap<string, string>): string | null {
  if (corrections.size === 0) return null;
  const corrected = parsed.folded.split(" ").map((word) => corrections.get(word) ?? word).join(" ");
  return corrected === parsed.folded ? null : corrected;
}

/** Pourquoi ce titre est là : le titre, le titre original, ou qui (personne, genre, studio). */
function matchOf(item: CatalogItem, analysis: Analysis): SearchMatch {
  const everyIn = (field: TermHit["field"]) => analysis.hits.every((h) => h.some((x) => x.field === field));
  if (analysis.byTitle) {
    return !everyIn("title") && everyIn("original") && item.originalTitle !== null
      ? { field: "originalTitle", value: item.originalTitle }
      : { field: "title" };
  }
  const first = (field: TermHit["field"]) => analysis.hits.flat().find((x) => x.field === field && x.entry !== undefined);
  const person = first("people");
  const ref = person?.entry === undefined ? undefined : item.people[person.entry];
  if (ref !== undefined) return { field: "people", value: ref.name, role: ref.role };
  const genre = first("genres");
  const genreName = genre?.entry === undefined ? undefined : item.genres[genre.entry];
  if (genreName !== undefined) return { field: "genre", value: genreName };
  const studio = first("studios");
  const studioName = studio?.entry === undefined ? undefined : item.studios[studio.entry];
  if (studioName !== undefined) return { field: "studio", value: studioName };
  return { field: "title" };
}

/** L'a priori d'un titre : sa note publique (jusqu'à +15 %), une collection un cran sous l'œuvre. */
function popularity(item: CatalogItem): number {
  const rating = item.rating ?? 6;
  const lift = Math.min(1, Math.max(0, (rating - 5) / 5)) * 0.15;
  return (1 + lift) * (item.type === "BoxSet" ? 0.95 : 1);
}
