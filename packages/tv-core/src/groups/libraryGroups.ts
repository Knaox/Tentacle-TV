import {
  FIRST_DECADE,
  LETTER_RANGES,
  RATING_STEPS,
  SMALL_GENRE,
  decadeOf,
  letterLabel,
  type GroupLabel,
  type LibraryGroupMode,
} from "./groupModel";

/**
 * Les rangées d'une BIBLIOTHÈQUE — le catalogue reste sur le serveur : chaque
 * rangée est une requête (ses affiches page à page, quand on s'en approche).
 *
 * En deux temps, pour que rien ne bouge sous les yeux :
 * 1. les CANDIDATS (`libraryGroupCandidates`) — un par genre de la
 *    bibliothèque, par décennie, par tranche de lettres ou par palier de note,
 *    déjà réduits aux filtres posés (un genre filtré ne garde que ses rangées,
 *    une plage d'années ses décennies, une note minimale ses paliers) ;
 * 2. leurs NOMBRES de titres (une requête de comptage chacun, aucun titre
 *    chargé), d'où les rangées (`libraryGroupsFromCounts`) : jamais une rangée
 *    vide, l'ordre connu avant le premier dessin — les genres les plus gros
 *    d'abord, les petits réunis dans « Autres genres ».
 *
 * La note : le serveur ne sait que « au moins N ». Les paliers se lisent donc
 * en CUMULÉ (« au moins 8 », « au moins 7 »…), et chaque palier est une
 * tranche de la liste triée par note décroissante : son début (`offset`) est
 * le nombre de titres des paliers au-dessus, sa longueur (`limit`) la
 * différence des deux comptes.
 */

export interface GroupQuery {
  /** Un genre (ou plusieurs : « Autres genres », l'un OU l'autre). */
  genreIds?: string[];
  years?: number[];
  /** Le titre de tri commence à cette lettre ou après (`NameStartsWithOrGreater`, en minuscules). */
  nameFrom?: string;
  /** … et avant celle-ci (`NameLessThan`, en minuscules). */
  nameBefore?: string;
  minRating?: number;
}

export interface GroupCandidate {
  key: string;
  label: GroupLabel;
  query: GroupQuery;
}

export interface LibraryGroup extends GroupCandidate {
  /** Ses titres, d'après le comptage (pour l'ordre ; la rangée dit le sien). */
  count: number;
  /** Un palier de note : sa tranche de la liste triée par note décroissante. */
  slice?: { offset: number; limit: number };
}

export interface LibraryGroupContext {
  genres: readonly { id: string; name: string }[];
  currentYear: number;
  genreIds: readonly string[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
}

/** La plus petite note qui compte : une note nulle ou absente n'est dans aucun palier. */
const LOWEST_RATING = 0.1;

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

export function libraryGroupCandidates(mode: LibraryGroupMode, ctx: LibraryGroupContext): GroupCandidate[] {
  switch (mode) {
    case "genre": {
      const only = new Set(ctx.genreIds);
      return ctx.genres
        .filter((genre) => only.size === 0 || only.has(genre.id))
        .map((genre) => ({ key: `genre:${genre.id}`, label: { kind: "genre", name: genre.name }, query: { genreIds: [genre.id] } }));
    }
    case "year": {
      const from = ctx.yearFrom ?? 1900;
      const to = Math.min(ctx.yearTo ?? ctx.currentYear, ctx.currentYear);
      const out: GroupCandidate[] = [];
      for (let decade = decadeOf(ctx.currentYear); decade >= FIRST_DECADE; decade -= 10) {
        const years = range(Math.max(decade, from), Math.min(decade + 9, to));
        if (years.length > 0) out.push({ key: `year:${decade}`, label: { kind: "decade", decade }, query: { years } });
      }
      const before = range(Math.max(1900, from), Math.min(FIRST_DECADE - 1, to));
      if (before.length > 0) out.push({ key: "year:before", label: { kind: "before", year: FIRST_DECADE }, query: { years: before } });
      return out;
    }
    case "alpha": {
      const letters = LETTER_RANGES.map(([from], index) => {
        const next = LETTER_RANGES[index + 1]?.[0];
        return { key: `alpha:${index}`, label: letterLabel(index), query: { nameFrom: from.toLowerCase(), ...(next ? { nameBefore: next.toLowerCase() } : {}) } };
      });
      return [...letters, { key: `alpha:${LETTER_RANGES.length}`, label: letterLabel(LETTER_RANGES.length), query: { nameBefore: "a" } }];
    }
    case "rating": {
      // Du plus haut au plus bas ; les paliers sous la note minimale filtrée tombent.
      const floor = ctx.ratingMin ?? LOWEST_RATING;
      const steps = RATING_STEPS.filter((min) => min > floor);
      const mins = [...steps, floor];
      return mins.map((min, index) => {
        const max = index === 0 ? null : mins[index - 1];
        const label: GroupLabel = max === null
          ? { kind: "ratingAtLeast", min }
          : ctx.ratingMin === null && index === mins.length - 1
            ? { kind: "ratingBelow", max }
            : { kind: "ratingBetween", min, max };
        return { key: `rating:${min}`, label, query: { minRating: min } };
      });
    }
  }
}

/**
 * Les rangées, une fois TOUS les comptes connus (`null` tant qu'il en manque :
 * l'ordre des genres en dépend). `counts[i]` : les titres du candidat `i` —
 * pour la note, le compte CUMULÉ « au moins N ».
 */
export function libraryGroupsFromCounts(
  mode: LibraryGroupMode,
  candidates: readonly GroupCandidate[],
  counts: readonly (number | undefined)[],
): LibraryGroup[] | null {
  if (candidates.some((_, index) => counts[index] === undefined)) return null;
  const counted = candidates.map((candidate, index) => ({ ...candidate, count: counts[index] ?? 0 }));
  if (mode === "rating") {
    return counted
      .map((group, index) => {
        const above = index === 0 ? 0 : counted[index - 1].count;
        const size = Math.max(0, group.count - above);
        return { ...group, count: size, slice: { offset: above, limit: size } };
      })
      .filter((group) => group.count > 0);
  }
  const present = counted.filter((group) => group.count > 0);
  if (mode !== "genre") return present;
  const big = present.filter((group) => group.count >= SMALL_GENRE).sort((a, b) => b.count - a.count);
  const small = present.filter((group) => group.count < SMALL_GENRE);
  if (small.length === 0) return big;
  // Un seul petit genre n'a pas besoin d'être « autre » : il garde son nom.
  if (small.length === 1) return [...big, small[0]];
  const ids = small.flatMap((group) => group.query.genreIds ?? []);
  return [
    ...big,
    { key: "genre:other", label: { kind: "otherGenres" }, query: { genreIds: ids }, count: small.reduce((sum, group) => sum + group.count, 0) },
  ];
}
