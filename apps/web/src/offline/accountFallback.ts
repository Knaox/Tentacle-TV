/**
 * Plus de connexion pendant la session d'un PROFIL (bureau) : l'application
 * revient d'elle-même au compte de l'appareil — le hors ligne est le sien, et
 * aucun code PIN ne se vérifie sans serveur (`offline-core` ›
 * `offlineSessionFallback`, la règle du mobile). La page se recharge sur son
 * catalogue local ; le message de passage hors ligne le dit, une fois
 * (`OfflineSwitchBanner`). Sans « Qui regarde ? » exigé : le choix de cette
 * exécution est tenu pour fait (`markLaunchPassed`), et au retour du réseau
 * rien ne se rouvre au nom d'un profil — le sélecteur suit sa règle au
 * prochain démarrage de l'application.
 *
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */

import { readActiveProfile } from "../auth/profileSession";
import { beginProfileSwitch, cancelProfileSwitch } from "../auth/profileEnded";
import { returnToAccount } from "../auth/sessionSwap";
import { markLaunchPassed } from "../profiles/launch/launchState";

/** Le nom du compte revenu (stockage de session : survit au rechargement). */
export const ACCOUNT_FALLBACK_NOTICE_KEY = "tentacle_offline_account_fallback";
const QUERY_CACHE_KEY = "tentacle_query_cache_v1";

function storedUserName(): string {
  try {
    const name = (JSON.parse(localStorage.getItem("tentacle_user") ?? "null") as { Name?: unknown } | null)?.Name;
    return typeof name === "string" ? name : "";
  } catch {
    return "";
  }
}

/** Revient au compte et recharge ; faux si rien n'a basculé (hors profil, réserve illisible). */
export function fallBackToAccount(): boolean {
  if (!readActiveProfile()) return false;
  // La fin de la session du profil que pousserait encore la socket est la nôtre.
  beginProfileSwitch();
  let swapped = false;
  try {
    swapped = returnToAccount(localStorage);
    if (swapped) {
      // Le cache persisté est celui du profil : il ne s'hydrate jamais ailleurs.
      localStorage.removeItem(QUERY_CACHE_KEY);
      sessionStorage.setItem(ACCOUNT_FALLBACK_NOTICE_KEY, storedUserName());
    }
  } catch {
    /* stockage indisponible : on reste où l'on est */
  }
  if (!swapped) {
    cancelProfileSwitch();
    return false;
  }
  markLaunchPassed();
  window.location.assign("/");
  return true;
}

/** Le nom à dire (`""` : sans nom), ou null : rien à dire. */
export function readAccountFallbackNotice(): string | null {
  try {
    return sessionStorage.getItem(ACCOUNT_FALLBACK_NOTICE_KEY);
  } catch {
    return null;
  }
}

export function clearAccountFallbackNotice(): void {
  try {
    sessionStorage.removeItem(ACCOUNT_FALLBACK_NOTICE_KEY);
  } catch {
    /* rien à effacer */
  }
}
