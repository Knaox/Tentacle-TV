/**
 * Sauvegarde du stockage local en vue de la migration vers Electron.
 *
 * # Le problème
 *
 * `localStorage` n'appartient pas à l'application mais au MOTEUR WEB, et il
 * est rangé par ORIGINE de la page. Sous Tauri l'origine de production est
 * `http://tauri.localhost` ; le futur client Electron servira la page sous une
 * autre origine et ne verra donc RIEN de ce qui est stocké aujourd'hui.
 *
 * Sans ce module, chaque utilisateur se réveillerait déconnecté à la première
 * version Electron : adresse du serveur perdue, identifiants à ressaisir.
 *
 * # Le véhicule
 *
 * On dépose une copie dans `tentacle-local.db` — le fichier SQLite de l'app,
 * qui vit dans le dossier de données et SURVIT à la migration sur les trois
 * systèmes. La commande `session_cache_set` accepte des chaînes arbitraires :
 * aucune modification de `apps/desktop` (Rust) n'est nécessaire.
 *
 * L'identifiant utilisateur est synthétique (`MIGRATION_KEY`), donc aucune
 * collision possible avec une vraie session. Le TTL de 30 jours côté Rust ne
 * détruit rien : il marque `expired`, et le client Electron lira la base
 * directement, sans passer par cette logique.
 *
 * # Sur le jeton
 *
 * `tentacle_token` est copié avec le reste. Ce n'est pas une régression : il
 * est DÉJÀ stocké en clair par le moteur web, dans le même dossier protégé.
 * Côté Electron il sera repris puis déplacé vers le coffre du système, et
 * cette ligne supprimée.
 */

import { invoke, isTauriShell } from "../desktop/bridge";

/** Identifiant synthétique : jamais un vrai identifiant Jellyfin. */
export const MIGRATION_KEY = "__tentacle_migration_v1__";

/** Clés volatiles ou propres au débogage : inutile de les transporter. */
const SKIP = new Set(["_test", "tentacle_mpv_log", "tentacle_wt_log", "tentacle_dev_last_watch"]);

/** Au-delà, on renonce plutôt que d'écrire une ligne SQLite démesurée. */
const MAX_BYTES = 4 * 1024 * 1024;

/** Intervalle de relecture. Une écriture n'a lieu que si le contenu a changé. */
const CHECK_MS = 30_000;

export interface MigrationPayload {
  version: 1;
  savedAt: number;
  origin: string;
  userAgent: string;
  entries: Record<string, string>;
}

/** Photographie du stockage local, hors clés ignorées. */
function snapshot(): MigrationPayload {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key === null || SKIP.has(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return {
    version: 1,
    savedAt: Date.now(),
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    entries,
  };
}

/**
 * Empreinte du CONTENU seul — `savedAt` en est exclu, sinon chaque relecture
 * paraîtrait modifiée et on écrirait dans SQLite toutes les 30 secondes pour
 * rien.
 *
 * ⚠️ Les séparateurs restent ÉCHAPPÉS. Écrits en clair, ce sont deux octets de
 * contrôle dans le fichier source, et git classe alors le module en BINAIRE :
 * plus de diff, plus de revue, plus de fusion à trois branches. La chaîne
 * produite est identique — seule la façon de l'écrire change.
 */
function fingerprint(payload: MigrationPayload): string {
  const keys = Object.keys(payload.entries).sort();
  let out = "";
  for (const k of keys) out += `${k}\u0000${payload.entries[k]}\u0001`;
  return out;
}

let lastFingerprint: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Écrit la sauvegarde si le contenu a changé depuis la dernière fois.
 * Silencieuse et sans effet hors application de bureau.
 */
export async function exportLocalStorageOnce(): Promise<boolean> {
  if (!isTauriShell() || typeof localStorage === "undefined") return false;

  let payload: MigrationPayload;
  try {
    payload = snapshot();
  } catch {
    return false; // stockage inaccessible (mode privé, quota) : on n'insiste pas
  }

  const print = fingerprint(payload);
  if (print === lastFingerprint) return false;

  const json = JSON.stringify(payload);
  if (json.length > MAX_BYTES) {
    console.warn("[migration] sauvegarde ignorée : contenu trop volumineux");
    return false;
  }

  try {
    await invoke("session_cache_set", {
      userId: MIGRATION_KEY,
      profileJson: json,
      policyJson: null,
    });
    lastFingerprint = print;
    return true;
  } catch {
    // Best-effort : un échec d'écriture ne doit jamais gêner l'utilisateur.
    return false;
  }
}

/**
 * Arme la sauvegarde : une fois au démarrage, puis à chaque changement
 * détecté, plus un dernier passage à la fermeture de la fenêtre.
 *
 * Idempotent — un second appel ne crée pas de second minuteur.
 */
export function startLocalStorageExport(): void {
  if (!isTauriShell() || timer !== null) return;

  // Léger différé : le démarrage écrit encore préférences et langue.
  setTimeout(() => {
    void exportLocalStorageOnce();
  }, 3_000);

  timer = setInterval(() => {
    void exportLocalStorageOnce();
  }, CHECK_MS);

  // `pagehide` couvre la fermeture ET le rechargement, là où `beforeunload`
  // est ignoré dans certaines webviews.
  window.addEventListener("pagehide", () => {
    void exportLocalStorageOnce();
  });
}

/** Désarme le minuteur (tests, démontage). */
export function stopLocalStorageExport(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
