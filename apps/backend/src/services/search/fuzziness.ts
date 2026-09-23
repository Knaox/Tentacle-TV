/**
 * Combien de fautes un terme tolère — une seule règle pour MiniSearch et pour
 * la relecture des correspondances (`matchAnalysis.ts`).
 *
 * Aucune jusqu'à trois lettres (« it », « up » doivent rester exacts), une de
 * quatre à six, deux au-delà. La passe LARGE en tolère deux dès cinq lettres :
 * deux lettres inversées (« hansk » pour « hanks ») coûtent DEUX en distance de
 * Levenshtein, que MiniSearch mesure sans transposition.
 */
export function fuzziness(term: string, loose = false): number | false {
  if (term.length <= 3) return false;
  if (loose && term.length >= 5) return 2;
  return term.length <= 6 ? 1 : 2;
}
