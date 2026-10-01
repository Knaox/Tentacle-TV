/**
 * « La session vient de changer » — jumelage écrit, ou déjumelage.
 *
 * Les synchronisations montées au-dessus du navigateur (canal de session,
 * lecture directe) relisent le jeton toutes les deux secondes
 * (`useStoredToken`) : assez pour un jumelage, trop lent pour un déjumelage,
 * où la socket ne doit pas rester ouverte une seconde de plus avec l'ancien
 * jeton. Ce signal les réveille aussitôt ; la relecture périodique reste en
 * filet.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onSessionChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionChanged(): void {
  for (const listener of [...listeners]) listener();
}
