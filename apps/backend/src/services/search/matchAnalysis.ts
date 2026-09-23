/**
 * Ce qu'une correspondance VAUT — ce que MiniSearch ne dit pas.
 *
 * MiniSearch trouve large : un terme peut répondre dans n'importe quel champ,
 * exactement, par préfixe ou avec des fautes, et deux termes peuvent répondre
 * dans deux champs différents. Mesuré sur une vraie bibliothèque (23.09.2026),
 * c'est la source de tout le bruit : « star wars » y trouvait *Seul sur Mars*
 * par « Sebastian **Stan** » et « **Mars** » — deux fautes, deux champs.
 *
 * On relit donc chaque candidat terme par terme, contre les mots de CHAQUE
 * champ, et on garde trois règles :
 *
 * 1. une FAUTE n'est tolérée que dans le titre (ou le titre original) : c'est
 *    là qu'on se trompe en tapant ce qu'on cherche. Un nom mal tapé se
 *    rattrape par la recherche de PERSONNES, pas par les titres où elles
 *    jouent — sans quoi « dune » ramenait tous les films de June Squibb ;
 * 2. un titre n'est retenu que si ses correspondances sont COHÉRENTES : tous
 *    les termes sans faute (où qu'ils soient : « nolan inception »), ou tous
 *    dans le titre (fautes comprises : « hary poter ») ;
 * 3. une correction se construit MOT À MOT, depuis les vrais mots du titre qui
 *    a répondu — jamais depuis un assemblage de suggestions.
 *
 * La distance est celle de Damerau (transpositions comprises) : « hansk » est
 * à UNE faute de « hanks », comme un humain le compterait. Et le verdict se
 * rend TOUJOURS au barème strict (`fuzziness`) : la passe large ne sert qu'à
 * RETROUVER les inversions que MiniSearch compte double — « the ofice » ne
 * doit pas trouver *Fire Force* à deux fautes.
 */

import { fuzziness } from "./fuzziness";

export type DocField = "title" | "original" | "people" | "genres" | "studios";

/** Les mots d'un titre, champ par champ — pliés, variantes du titre comprises. */
export interface DocWords {
  /** Les mots du titre, suivis de ses variantes (paires soudées, numéros). */
  title: string[];
  /** Le nombre de VRAIS mots du titre, variantes exclues. */
  titleLength: number;
  original: string[];
  /** Un tableau de mots par personne, dans l'ordre du casting. */
  people: string[][];
  genres: string[][];
  studios: string[][];
}

export interface TermHit {
  field: DocField;
  /** Sans faute : le mot commence par le terme. */
  solid: boolean;
  /** Le mot EST le terme — ni préfixe, ni faute. */
  exact: boolean;
  /** Le nombre de fautes (0 sans faute). */
  distance: number;
  /** Le mot du document qui a répondu — la matière d'une correction. */
  word: string;
  /** Pour `people`, `genres`, `studios` : l'indice de l'entrée qui a répondu. */
  entry?: number;
}

/** Distance de Damerau (alignement optimal), abandonnée au-delà de `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push([i]);
  for (let j = 1; j <= b.length; j++) (rows[0] as number[])[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const row = rows[i] as number[];
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const prev = rows[i - 1] as number[];
      let value = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, ((rows[i - 2] as number[])[j - 2] ?? 0) + 1);
      }
      row[j] = value;
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
  }
  return (rows[a.length] as number[])[b.length] ?? max + 1;
}

/**
 * Une faute ne touche pas la PREMIÈRE lettre — ou l'échange avec la deuxième
 * (« hte » pour « the ») : mesuré, « the ofice » trouvait sinon *The Nice Guys*.
 */
function sameStart(term: string, word: string): boolean {
  return term[0] === word[0] || (term[0] === word[1] && term[1] === word[0]);
}

/**
 * Le nombre de fautes entre le terme et ce mot — 0 si le mot commence par le
 * terme —, ou `null` au-delà du barème strict. Faute sur le mot entier, ou
 * sur son début : « hary pot » tape encore.
 */
function wordDistance(term: string, word: string): number | null {
  if (word.startsWith(term)) return 0;
  const allowed = fuzziness(term);
  if (allowed === false || !sameStart(term, word)) return null;
  const whole = editDistance(term, word, allowed);
  const head = word.length > term.length ? editDistance(term, word.slice(0, term.length), allowed) : whole;
  const distance = Math.min(whole, head);
  return distance <= allowed ? distance : null;
}

interface WordHit { solid: boolean; exact: boolean; word: string; distance: number }

function bestIn(term: string, words: readonly string[]): WordHit | null {
  let prefix: string | null = null;
  let fuzzy: WordHit | null = null;
  for (const word of words) {
    if (word === term) return { solid: true, exact: true, word, distance: 0 };
    const distance = wordDistance(term, word);
    if (distance === 0 && prefix === null) prefix = word;
    if (distance !== null && distance > 0 && (fuzzy === null || distance < fuzzy.distance)) {
      fuzzy = { solid: false, exact: false, word, distance };
    }
  }
  if (prefix !== null) return { solid: true, exact: false, word: prefix, distance: 0 };
  return fuzzy;
}

/** Toutes les façons dont un terme répond au document, champ par champ. */
export function termHits(term: string, doc: DocWords): TermHit[] {
  const hits: TermHit[] = [];
  for (const field of ["title", "original"] as const) {
    const found = bestIn(term, doc[field]);
    if (found !== null) hits.push({ field, ...found });
  }
  for (const field of ["people", "genres", "studios"] as const) {
    const entries = doc[field];
    for (let entry = 0; entry < entries.length; entry++) {
      const found = bestIn(term, entries[entry] ?? []);
      // Rien que du sans-faute hors du titre (règle 1), et un préfixe d'au
      // moins quatre lettres : « sci fi » ne trouve pas Finn Bennett, ni
      // « toy » Nao Tōyama.
      if (found?.solid && (found.exact || term.length >= 4)) {
        hits.push({ field, solid: true, exact: found.exact, word: found.word, distance: 0, entry });
        break;
      }
    }
  }
  return hits;
}

export interface Analysis {
  coherent: boolean;
  /** Tous les termes répondent sans faute, où que ce soit. */
  solid: boolean;
  /** Tous les termes répondent au titre (ou au titre original), fautes comprises. */
  byTitle: boolean;
  /** Tous les termes commencent un mot du titre, sans faute. */
  titleSolid: boolean;
  /** Termes ÷ mots du titre : la part du titre que la requête couvre. */
  coverage: number;
  /** Terme fautif → le mot du titre qu'il visait. */
  corrections: Map<string, string>;
  hits: TermHit[][];
}

/** Relit un candidat terme par terme (règles 1 et 2 de l'en-tête). */
export function analyze(terms: readonly string[], doc: DocWords, any: boolean): Analysis {
  const hits = terms.map((term) => termHits(term, doc));
  const answered = hits.filter((h) => h.length > 0);
  const inTitle = (h: TermHit[]) => h.some((x) => x.field === "title" || x.field === "original");
  const byTitle = hits.every(inTitle);
  const allSolid = hits.every((h) => h.some((x) => x.solid));
  // Un résultat PARTIEL (OU) doit tenir à au moins deux mots ENTIERS de son
  // titre, et à la moitié des termes : « star wars » ne ramène ni *Stargirl*
  // ni les films de Mike Starr, « l'âge de glace » ni *Adaline*.
  const exactInTitle = hits.filter((h) => h.some((x) => x.exact && (x.field === "title" || x.field === "original"))).length;
  const coherent = any
    ? exactInTitle >= 2 && exactInTitle >= Math.ceil(terms.length / 2)
    : answered.length === terms.length && (allSolid || byTitle);
  const corrections = new Map<string, string>();
  hits.forEach((h, i) => {
    const title = h.find((x) => x.field === "title" || x.field === "original");
    const term = terms[i];
    // Un terme juste ailleurs (dans le casting) n'est pas une faute.
    if (term !== undefined && title !== undefined && !title.solid && !h.some((x) => x.solid)) {
      corrections.set(term, title.word);
    }
  });
  return {
    coherent,
    solid: allSolid,
    byTitle,
    titleSolid: hits.every((h) => h.some((x) => x.field === "title" && x.solid)),
    coverage: Math.min(1, terms.length / Math.max(1, doc.titleLength)),
    corrections,
    hits,
  };
}
