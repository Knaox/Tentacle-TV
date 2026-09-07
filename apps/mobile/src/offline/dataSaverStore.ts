/**
 * Réglage « économie de données » — par appareil, comme le mode d'apparence :
 * la qualité de connexion dépend de l'endroit où tourne l'application, pas du
 * compte.
 *
 * Trois valeurs plutôt qu'un booléen :
 *  - `auto` (défaut) — suit la qualité du lien mesurée par les sondes ET, sur
 *    mobile, le réseau du téléphone (les données mobiles comptent) ;
 *  - `on` / `off` — forçage explicite (forfait limité, ou au contraire lien
 *    lent mais illimité).
 *
 * Ne décide de rien tout seul : `DataSaverBinding` combine ce réglage avec la
 * connectivité et pousse le résultat dans `api-client`. Même clé de stockage
 * que le web ; le magasin est amorcé par `configureDataSaver(storage)`, sans
 * effet au chargement du module.
 */

import type { StorageAdapter } from "@tentacle-tv/api-client";

export type DataSaverSetting = "auto" | "on" | "off";

export const DATA_SAVER_STORAGE_KEY = "tentacle_data_saver";

let storage: StorageAdapter | null = null;
let setting: DataSaverSetting = "auto";
const listeners = new Set<() => void>();

const parse = (raw: string | null): DataSaverSetting => (raw === "on" || raw === "off" ? raw : "auto");

/** À appeler une fois le stockage hydraté ; relit le réglage persistant. */
export function configureDataSaver(adapter: StorageAdapter): void {
  storage = adapter;
  const next = parse(adapter.getItem(DATA_SAVER_STORAGE_KEY));
  if (next === setting) return;
  setting = next;
  for (const listener of listeners) listener();
}

export const getDataSaverSetting = (): DataSaverSetting => setting;

export function setDataSaverSetting(next: DataSaverSetting): void {
  if (setting === next) return;
  setting = next;
  if (next === "auto") storage?.removeItem(DATA_SAVER_STORAGE_KEY);
  else storage?.setItem(DATA_SAVER_STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

export function subscribeDataSaverSetting(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Résout le réglage en décision effective : en `auto`, lien lent OU cellulaire. */
export function resolveDataSaver(value: DataSaverSetting, slowLink: boolean, cellular: boolean): boolean {
  if (value === "on") return true;
  if (value === "off") return false;
  return slowLink || cellular;
}
