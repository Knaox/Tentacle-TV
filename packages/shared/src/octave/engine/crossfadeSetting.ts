/**
 * Le réglage « Transition douce » d'Octave : une préférence de l'APPAREIL (`tentacle_octave_crossfade`, la durée
 * du fondu en ms, « 0 » = coupée). Un appareil qui n'a jamais rien choisi l'a ALLUMÉE, à 5 s
 * (`CROSSFADE_DEFAULT_MS`). Le même magasin pour le web, le bureau et le mobile : chaque client lui donne son
 * stockage synchrone (`localStorage`, `RNStorageAdapter` préchargé) ; le fournisseur du moteur le passe au port
 * (`setCrossfade`), le contrôle du lecteur et la ligne des Réglages d'Octave l'écrivent. Aucune capacité serveur.
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */

import { CROSSFADE_DEFAULT_MS, sanitizeCrossfadeMs } from "./crossfadeRules";

export const CROSSFADE_STORAGE_KEY = "tentacle_octave_crossfade";

export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** La valeur gardée → la durée : rien de gardé (ou illisible) = le défaut allumé ; « 0 » = coupée par l'utilisateur. */
export function storedCrossfadeMs(raw: string | null): number {
  if (raw === null || raw.trim() === "") return CROSSFADE_DEFAULT_MS;
  const value = Number(raw);
  if (!Number.isFinite(value)) return CROSSFADE_DEFAULT_MS;
  return sanitizeCrossfadeMs(value);
}

export interface CrossfadeSettingStore {
  get(): number;
  set(next: number): void;
  subscribe(listener: () => void): () => void;
}

/** Le magasin du réglage sur un stockage (lu une fois, puis gardé en mémoire ; une écriture refusée vaut pour la session). */
export function createCrossfadeSetting(storage: () => SyncStorage | null): CrossfadeSettingStore {
  const read = (): number => {
    try {
      return storedCrossfadeMs(storage()?.getItem(CROSSFADE_STORAGE_KEY) ?? null);
    } catch {
      return CROSSFADE_DEFAULT_MS;
    }
  };
  let value: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => (value ??= read()),
    set(next) {
      const clean = sanitizeCrossfadeMs(next);
      if (clean === (value ??= read())) return;
      value = clean;
      try {
        storage()?.setItem(CROSSFADE_STORAGE_KEY, String(clean));
      } catch {
        /* Persistance impossible : le choix vaut pour la session en cours. */
      }
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
