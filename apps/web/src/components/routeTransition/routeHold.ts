/**
 * Une navigation ATTEND-elle ? — le compte des pages quittées qui restent à l'écran pendant que
 * la suivante se prépare (`RouteExit`). Pur, sans React ; `RouteProgress` s'y abonne.
 *
 * Tenir la page quittée n'est supportable que si le clic a été entendu : sur un serveur rapide
 * la tenue dure quelques images et personne ne la voit ; sur un serveur lent elle peut durer une
 * seconde, et une interface qui ne dit rien pendant une seconde paraît gelée.
 */

let holds = 0;
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const listener of [...listeners]) listener();
};

/** Une page quittée se met à attendre ; rend de quoi dire qu'elle n'attend plus. */
export function beginRouteHold(): () => void {
  holds += 1;
  emit();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    holds -= 1;
    emit();
  };
}

export function isRouteHeld(): boolean {
  return holds > 0;
}

export function subscribeRouteHold(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pour les tests. */
export function resetRouteHoldForTests(): void {
  holds = 0;
  listeners.clear();
}
