/**
 * Octave — POURQUOI un titre démarre : l'utilisateur l'a CHOISI (clic dans une liste ou la file, Suivant,
 * Précédent, reprise, « Réessayer »), ou la file l'ENCHAÎNE d'elle-même (fin du précédent). Un titre choisi
 * n'est JAMAIS sauté sur un échec : il reste, avec son message et « Réessayer » (Damien, 25/10 : « je m'en fous
 * du titre suivant, je veux lire CE titre ») ; seul l'enchaînement passe au suivant, au plus deux fois d'affilée
 * (`failureStreak.ts`).
 */

export type StartCause = "chosen" | "chained";

/** « Réessaie plus tard » de l'extension : nouveaux essais permis pour un titre choisi (un seul pour l'enchaînement). */
export const CHOSEN_BUDGET_TRIES = 3;
