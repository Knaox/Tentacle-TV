/**
 * Octave — QUAND montrer les résultats d'une recherche validée. Règle pure :
 *
 * - tout ARRIVE ENSEMBLE (« bam ») : la bibliothèque, la page SÛRE de
 *   l'extension (jamais une page provisoire : contrat v2) et les pochettes des
 *   premières rangées, décodées ;
 * - si l'extension tarde au-delà de `REVEAL_CAP_MS`, la bibliothèque part seule
 *   et la section de l'extension garde sa place (rangées fantômes) jusqu'à sa
 *   page sûre ;
 * - les pochettes ont un budget (`ART_BUDGET_MS`) : une image en retard ne
 *   retient pas les résultats, elle arrive en fondu à sa place.
 *
 * Une fois montrée, une section ne se réordonne plus (`settleOrder`, tenue) :
 * la suite ne fait qu'ajouter dessous.
 */

export const REVEAL_CAP_MS = 1_500;
export const ART_BUDGET_MS = 250;
/**
 * Les titres que chaque section MONTRE (`SearchResults`) : leurs pochettes sont toutes attendues avant la
 * révélation — une rangée visible dont l'image arriverait après se verrait (banc R1 : la 9e et la 10e rangée de
 * l'extension, jamais préchargées, arrivaient en fondu même à la 2e recherche).
 */
export const LIBRARY_TRACKS_SHOWN = 8;
export const EXTERNAL_TRACKS_SHOWN = 10;
/** Les cartes (albums, artistes) dont la pochette est attendue : les premières, sous les titres. */
export const ART_FIRST_CARDS = 6;

export interface RevealInput {
  /** Temps écoulé depuis la validation (ms). */
  elapsedMs: number;
  libraryReady: boolean;
  /** Pas d'extension, sa page sûre, ou sa recherche finie (même vide). */
  externalReady: boolean;
  /** Les pochettes de tête sont décodées (ou leur budget est écoulé). */
  libraryArtReady: boolean;
  externalArtReady: boolean;
}

export interface RevealDecision {
  library: boolean;
  external: boolean;
}

export function revealDecision(input: RevealInput): RevealDecision {
  const { elapsedMs, libraryReady, externalReady, libraryArtReady, externalArtReady } = input;
  const late = elapsedMs >= REVEAL_CAP_MS;
  const externalShowable = externalReady && externalArtReady;
  // Ensemble ; la bibliothèque seule si l'extension tarde. Jamais l'extension DEVANT la bibliothèque.
  const library = libraryReady && libraryArtReady && (externalShowable || late);
  return { library, external: library && externalShowable };
}

/** L'extension a une page montrable : sa recherche finie, ou une page non provisoire — ou rien ne viendra plus (échec). */
export function externalReadiness(state: { available: boolean; complete: boolean; provisional: boolean; pending: boolean; settled: boolean; failed?: boolean }): boolean {
  if (!state.available || state.failed) return true;
  if (state.pending) return false;
  // `settled` : ce que la bibliothèque possède déjà est connu (sinon un titre disparaîtrait de la section après coup).
  return state.settled && (state.complete || !state.provisional);
}
