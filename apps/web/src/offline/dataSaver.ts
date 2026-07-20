/**
 * Réglage « économie de données » — par appareil, comme le mode d'apparence :
 * la qualité de connexion dépend de l'endroit où tourne l'app, pas du compte.
 *
 * Trois valeurs plutôt qu'un booléen :
 *  - `auto` (défaut) — suit la qualité de lien mesurée par les sondes ;
 *  - `on` / `off` — forçage explicite, pour qui veut trancher lui-même
 *    (partage de connexion mobile, forfait limité, ou au contraire lien lent
 *    mais illimité).
 *
 * Ne décide de rien tout seul : `DataSaverBinding` combine ce réglage avec
 * `linkQuality` et pousse le résultat dans `api-client`.
 */

export type DataSaverSetting = "auto" | "on" | "off";

export const DATA_SAVER_STORAGE_KEY = "tentacle_data_saver";

const read = (): DataSaverSetting => {
  try {
    const raw = localStorage.getItem(DATA_SAVER_STORAGE_KEY);
    return raw === "on" || raw === "off" ? raw : "auto";
  } catch {
    return "auto";
  }
};

let setting = read();
const listeners = new Set<() => void>();

export const getDataSaverSetting = (): DataSaverSetting => setting;

export function setDataSaverSetting(next: DataSaverSetting): void {
  if (setting === next) return;
  setting = next;
  try {
    if (next === "auto") localStorage.removeItem(DATA_SAVER_STORAGE_KEY);
    else localStorage.setItem(DATA_SAVER_STORAGE_KEY, next);
  } catch {
    /* Persistance impossible : le réglage vaut pour la session en cours. */
  }
  for (const l of listeners) l();
}

export function subscribeDataSaverSetting(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Résout le réglage en décision effective. */
export function resolveDataSaver(value: DataSaverSetting, slowLink: boolean): boolean {
  if (value === "on") return true;
  if (value === "off") return false;
  return slowLink;
}
