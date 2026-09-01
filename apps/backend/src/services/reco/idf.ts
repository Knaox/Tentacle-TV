/**
 * IDF des facettes : une facette portée par 40 % du corpus n'apprend rien,
 * une facette à 0,3 % est un signal fort. idf = log((N+1)/(n+1)) + 1, borné —
 * le lissage (+1) évite le log de zéro et la division par zéro, les bornes
 * évitent qu'une facette vue une fois domine tout le profil.
 */

export const IDF_MIN = 0.2;
export const IDF_MAX = 8;

/** IDF par défaut d'une facette jamais comptée : « plutôt informative ». */
export const IDF_UNKNOWN = 3;

export function idfValue(totalDocs: number, docCount: number): number {
  const raw = Math.log((totalDocs + 1) / (docCount + 1)) + 1;
  return Math.min(IDF_MAX, Math.max(IDF_MIN, raw));
}

export interface IdfEntry {
  docCount: number;
  idf: number;
}

/**
 * Compte les facettes d'un corpus (un Set de clés par document) et en tire
 * les IDF. Pure : les jobs fournissent les documents, la persistance vit
 * ailleurs (services/reco/jobs).
 */
export function computeIdf(docs: Iterable<ReadonlySet<string>>): Map<string, IdfEntry> {
  const counts = new Map<string, number>();
  let total = 0;
  for (const doc of docs) {
    total++;
    for (const key of doc) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = new Map<string, IdfEntry>();
  for (const [key, count] of counts) {
    out.set(key, { docCount: count, idf: idfValue(total, count) });
  }
  return out;
}
