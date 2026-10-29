/**
 * La SORTIE d'une feuille du bas, en règle pure. Tant que sa `Modal` est montée — même vide, voile
 * transparent —, iOS et Android lui donnent TOUS les gestes : la page dessous ne défile pas. La sortie
 * se joue donc en temps COURT et BORNÉ (une courbe qui accélère, jamais un ressort : celui d'avant,
 * amorti 22 / raideur 240 / masse 0,9, ne se posait qu'en 1,15 s, si bien que le garde-fou de 600 ms
 * le coupait, puis un second fondu de 220 ms suivait — ~0,8 s où la liste semblait bloquée après une
 * feuille refermée, retour du 29/10), et la modale se démonte dès la fin.
 */

/** La durée de la sortie : plus courte que l'entrée (« exit faster than enter »). */
export const SHEET_EXIT_MS = 200;
/** La marge du garde-fou : une animation interrompue ne rappelle jamais, la modale se démonte quand même. */
export const SHEET_EXIT_GUARD_MS = SHEET_EXIT_MS + 80;

