/**
 * Les caches de préférences de pistes et de configuration, DANS la base
 * locale (table `settings`, par compte) : ils survivent à « Vider le cache »,
 * se lisent en synchrone, et servent la lecture locale — qui n'interroge
 * jamais le serveur, même en ligne. Photographiés à chaque passage en ligne,
 * après avoir poussé les modifications faites hors ligne.
 */

import {
  cacheItemTracks,
  cacheLibrariesList,
  cacheLibraryPrefs,
  readPendingPrefs,
  watchedThreshold,
  writePendingPrefs,
  type ItemTrackChoice,
  type KeyValueStore,
  type PendingPrefUpsert,
} from "@tentacle-tv/offline-core";
import { localDb } from "./database";
import { offlineSettingGet, offlineSettingSet } from "./settings";

const AUTOPLAY_KEY = "autoplay_config";
const TIMEOUT_MS = 12_000;

/** Le magasin clé-valeur des caches : la table `settings` du cœur. */
export const prefsStore: KeyValueStore = {
  get: (key) => offlineSettingGet(key),
  set: (key, value) => offlineSettingSet(key, value),
  remove: (key) => {
    localDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  },
};

/** Seuil « vu » (MaxResumePct) photographié, ou le repli de Jellyfin. */
export function cachedMaxResumePct(): number {
  try {
    const raw = prefsStore.get(AUTOPLAY_KEY);
    const parsed = raw ? (JSON.parse(raw) as { maxResumePct?: unknown }) : null;
    return watchedThreshold(typeof parsed?.maxResumePct === "number" ? parsed.maxResumePct : undefined);
  } catch {
    return watchedThreshold(undefined);
  }
}

async function get(url: string, headers: Record<string, string>): Promise<unknown | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: abort.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pousse les préférences de bibliothèque modifiées hors ligne ; ce qui échoue reste en file. */
export async function flushPendingPrefs(serverUrl: string, token: string, userId: string): Promise<void> {
  const pending = readPendingPrefs(prefsStore, userId);
  if (pending.length === 0) return;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const remaining: PendingPrefUpsert[] = [];
  for (const pref of pending) {
    try {
      const res = pref.reset
        ? await fetch(`${serverUrl}/api/preferences/${pref.libraryId}`, { method: "DELETE", headers })
        : await fetch(`${serverUrl}/api/preferences`, {
            method: "PUT",
            headers,
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
  writePendingPrefs(prefsStore, userId, remaining);
}

/**
 * Photographie, à chaque passage en ligne : préférences par bibliothèque,
 * liste des bibliothèques (page des langues hors ligne), langues retenues par
 * contenu, seuil « vu ». Chaque photo est best-effort et garde la précédente.
 */
export async function refreshOfflineCaches(serverUrl: string, token: string, userId: string): Promise<void> {
  await flushPendingPrefs(serverUrl, token, userId);
  const bearer = { Authorization: `Bearer ${token}` };
  const emby = { "X-Emby-Token": token };
  const [prefs, views, items, autoplay] = await Promise.all([
    get(`${serverUrl}/api/preferences`, bearer),
    get(`${serverUrl}/api/jellyfin/Users/${userId}/Views`, emby),
    get(`${serverUrl}/api/preferences/items`, bearer),
    get(`${serverUrl}/api/config/autoplay`, bearer),
  ]);
  try {
    if (prefs !== null) cacheLibraryPrefs(prefsStore, userId, prefs);
    const libraries = (views as { Items?: Array<{ Id?: unknown; Name?: unknown }> } | null)?.Items;
    if (Array.isArray(libraries)) {
      cacheLibrariesList(
        prefsStore,
        userId,
        libraries.filter((lib): lib is { Id: string; Name: string } => typeof lib.Id === "string" && typeof lib.Name === "string"),
      );
    }
    if (items !== null) cacheItemTracks(prefsStore, userId, items);
    if (autoplay !== null && typeof autoplay === "object") prefsStore.set(AUTOPLAY_KEY, JSON.stringify(autoplay));
  } catch {
    // La base locale répondra au prochain passage en ligne.
  }
}

/** Le choix de langues d'un contenu, poussé au serveur — best-effort, en ligne seulement. */
export async function pushItemTrackChoice(serverUrl: string, token: string, itemId: string, choice: ItemTrackChoice): Promise<void> {
  try {
    await fetch(`${serverUrl}/api/preferences/item`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, ...choice }),
    });
  } catch {
    // Le miroir local a déjà retenu le choix ; le serveur l'apprendra plus tard.
  }
}
