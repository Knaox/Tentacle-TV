/**
 * Le POINT D'ENTRÉE NEUTRE du mode de mesure du rendu — Android TV seulement
 * (`index.android.ts` → `platform/androidtv/perf`, journal `[perf]`). Ce
 * fichier est celui de l'Apple TV : rien n'y mesure, chaque nom est vide. Un
 * nom nouveau s'ajoute aux deux (même règle que `platform/input`).
 */
export const PERF_ENABLED = false;

export function perfMark(_label: string): void {}

export function usePerfReady(_screen: string, _ready: boolean): void {}
