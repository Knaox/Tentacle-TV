/**
 * Octave — la boîte d'import ouverte ou non (un magasin minuscule, lu par
 * `useSyncExternalStore`) : toute entrée l'ouvre, l'hôte de la coquille la rend.
 */

let open = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const importDialogOpen = (): boolean => open;

export function subscribeImportDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openImportDialog(): void {
  open = true;
  notify();
}

export function closeImportDialog(): void {
  open = false;
  notify();
}
