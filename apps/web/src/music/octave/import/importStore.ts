/**
 * Octave — la boîte d'import ouverte ou non (un magasin minuscule, lu par
 * `useSyncExternalStore`) : toute entrée l'ouvre, l'hôte de la coquille la rend.
 */

let open = false;
/** La playlist EXISTANTE où l'import verse ses titres (ouverte depuis sa page) ; `null` : une playlist neuve. */
export interface ImportTargetPlaylist {
  playlistId: string;
  name: string;
}
let target: ImportTargetPlaylist | null = null;
/** Ce que la boîte doit montrer collé à son ouverture (un lien de partage ouvert depuis sa page), une fois. */
let prefill: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const importDialogOpen = (): boolean => open;

export function subscribeImportDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const importDialogTarget = (): ImportTargetPlaylist | null => target;

export function openImportDialog(): void {
  target = null;
  open = true;
  notify();
}

/** Ouvrir la boîte avec ce texte déjà collé (un lien de partage ouvert depuis sa page). */
export function openImportDialogWith(text: string): void {
  prefill = text;
  openImportDialog();
}

/** Ouvrir la boîte pour verser un album ou des fichiers dans CETTE playlist (depuis sa page). */
export function openImportDialogInto(playlist: ImportTargetPlaylist): void {
  openImportDialog();
  target = playlist;
  notify();
}

/** Le texte à coller à l'ouverture, pris une seule fois. */
export function takeImportPrefill(): string | null {
  const text = prefill;
  prefill = null;
  return text;
}

export function closeImportDialog(): void {
  open = false;
  notify();
}
