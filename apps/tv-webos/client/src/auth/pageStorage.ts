import { ACCOUNT_STORAGE_KEYS, type SessionStorage } from "@tentacle-tv/tv-core";

/**
 * Le stockage de la page, pour le déjumelage : `localStorage`, mais sans
 * jamais lever — un stockage refusé ne doit pas laisser une purge à moitié.
 */
export const pageStorage: SessionStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* stockage refusé */ }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); } catch { /* stockage refusé */ }
  },
};

/** Les clés de compte du client web, dont la LG hérite : une langue en attente
 *  d'envoi, les fournisseurs filtrés des recommandations, et les réglages en
 *  attente, rangés par compte. */
const WEB_ACCOUNT_KEYS = ["tentacle_language_pending", "tentacle_reco_providers"];
const WEB_ACCOUNT_PREFIXES = ["tentacle_pending_prefs_"];

/** Tout ce que le déjumelage efface sur la LG. */
export function webosAccountKeys(): string[] {
  const keys = [...ACCOUNT_STORAGE_KEYS, ...WEB_ACCOUNT_KEYS];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && WEB_ACCOUNT_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
    }
  } catch { /* stockage refusé */ }
  return keys;
}
