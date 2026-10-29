/**
 * Octave — la boîte « Importer une sortie » ouverte ou non (un magasin minuscule, lu par `useSyncExternalStore`) :
 * toute entrée l'ouvre (bouton, fichiers déposés n'importe où dans Octave, lien collé), l'hôte de la coquille la
 * rend. Ce qu'elle doit montrer à l'ouverture (un lien, des fichiers déposés) se prend UNE fois.
 */

export type ReleasePrefill = { kind: "link"; url: string } | { kind: "files"; files: File[] };

let open = false;
let prefill: ReleasePrefill | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const releaseDialogOpen = (): boolean => open;

export function subscribeReleaseDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openReleaseDialog(with_?: ReleasePrefill): void {
  if (with_) prefill = with_;
  open = true;
  notify();
}

export function takeReleasePrefill(): ReleasePrefill | null {
  const value = prefill;
  prefill = null;
  return value;
}

export function closeReleaseDialog(): void {
  open = false;
  notify();
}
