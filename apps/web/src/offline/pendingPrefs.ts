/**
 * Modifications de préférences faites HORS LIGNE, en attente de backend.
 * La page Préférences écrit ici (et met à jour le cache localTrackPrefs
 * immédiatement — la lecture locale applique aussitôt) ; ConnectivityBinding
 * flush au boot et à chaque retour en ligne. Dernier état par bibliothèque
 * (last-write-wins, comme l'upsert serveur).
 */

import type { CachedLibraryPref } from "./localTrackPrefs";

const PENDING_PREFS_PREFIX = "tentacle_pending_prefs_";
const PENDING_LANG_KEY = "tentacle_language_pending";

export interface PendingPrefUpsert extends CachedLibraryPref {
  /** true = réinitialisation (DELETE côté backend). */
  reset?: boolean;
}

export function queuePendingPref(userId: string, upsert: PendingPrefUpsert): void {
  const list = readPendingPrefs(userId).filter((p) => p.libraryId !== upsert.libraryId);
  list.push(upsert);
  writePendingPrefs(userId, list);
}

export function readPendingPrefs(userId: string): PendingPrefUpsert[] {
  try {
    const raw = localStorage.getItem(`${PENDING_PREFS_PREFIX}${userId}`);
    const parsed = raw ? (JSON.parse(raw) as PendingPrefUpsert[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingPrefs(userId: string, list: PendingPrefUpsert[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(`${PENDING_PREFS_PREFIX}${userId}`);
    else localStorage.setItem(`${PENDING_PREFS_PREFIX}${userId}`, JSON.stringify(list));
  } catch {
    /* best-effort */
  }
}

function authHeaders(): { headers: Record<string, string>; credentials: RequestCredentials | undefined } {
  const token = localStorage.getItem("tentacle_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { headers, credentials: token ? undefined : "include" };
}

/** PUT/DELETE par entrée ; retirée au succès. Best-effort, jamais bloquant. */
export async function flushPendingPrefs(userId: string, backendBase: string): Promise<void> {
  const pending = readPendingPrefs(userId);
  if (pending.length === 0) return;
  const { headers, credentials } = authHeaders();
  const remaining: PendingPrefUpsert[] = [];
  for (const pref of pending) {
    try {
      const res = pref.reset
        ? await fetch(`${backendBase}/api/preferences/${pref.libraryId}`, {
            method: "DELETE", headers, credentials,
          })
        : await fetch(`${backendBase}/api/preferences`, {
            method: "PUT", headers, credentials,
            body: JSON.stringify({
              libraryId: pref.libraryId,
              audioLang: pref.audioLang,
              subtitleLang: pref.subtitleLang,
              subtitleMode: pref.subtitleMode,
            }),
          });
      // 404 sur un DELETE = déjà absent côté serveur : synchronisé.
      if (res.ok || (pref.reset && res.status === 404)) continue;
      remaining.push(pref);
    } catch {
      remaining.push(pref);
    }
  }
  writePendingPrefs(userId, remaining);
}

/* ── Langue d'interface changée hors ligne ── */

export function markInterfaceLanguagePending(lang: string): void {
  try {
    localStorage.setItem(PENDING_LANG_KEY, lang);
  } catch {
    /* best-effort */
  }
}

export function clearPendingInterfaceLanguage(): void {
  try {
    localStorage.removeItem(PENDING_LANG_KEY);
  } catch {
    /* best-effort */
  }
}

/** Pousse la langue changée hors ligne — le pull du démarrage (main.tsx) la
 *  respecte tant qu'elle est en attente, donc jamais d'écrasement. */
export async function flushPendingInterfaceLanguage(backendBase: string): Promise<void> {
  let lang: string | null = null;
  try {
    lang = localStorage.getItem(PENDING_LANG_KEY);
  } catch {
    return;
  }
  if (!lang) return;
  const { headers, credentials } = authHeaders();
  try {
    const res = await fetch(`${backendBase}/api/preferences/language`, {
      method: "PUT", headers, credentials,
      body: JSON.stringify({ language: lang }),
    });
    if (res.ok) clearPendingInterfaceLanguage();
  } catch {
    /* retenté au prochain retour en ligne */
  }
}
