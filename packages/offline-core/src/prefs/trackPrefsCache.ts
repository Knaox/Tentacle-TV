/**
 * Les caches de préférences de pistes du mode hors ligne — LOGIQUE PURE, sur
 * un magasin clé-valeur injecté (localStorage sur le web, la table `settings`
 * de la base locale sur le mobile).
 *
 * Trois choses y vivent, par compte : les préférences PAR BIBLIOTHÈQUE
 * (photo du serveur), les langues retenues PAR CONTENU (miroir borné à
 * `ITEM_TRACKS_MAX_ENTRIES`, éviction de la plus anciennement touchée), et les
 * modifications faites HORS LIGNE en attente du serveur (dernier écrit gagne,
 * comme l'upsert serveur). Les clés sont celles du web : elles ne changent pas.
 *
 * Ce qui parle au réseau (photographier, pousser) reste à chaque plateforme.
 */

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export type SubtitleMode = "none" | "always" | "forced" | "signs";

export interface CachedLibraryPref {
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

export interface CachedLibrary {
  id: string;
  name: string;
}

export interface ItemTrackChoice {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

export interface PendingPrefUpsert extends CachedLibraryPref {
  /** `true` = réinitialisation (DELETE côté serveur). */
  reset?: boolean;
}

interface ItemEntry extends ItemTrackChoice {
  itemId: string;
  /** Rang de dernier usage, pour l'éviction. Un compteur, pas une horloge. */
  seq: number;
}

/** Au-delà, la plus anciennement touchée saute. */
export const ITEM_TRACKS_MAX_ENTRIES = 200;

export const libraryPrefsKey = (userId: string): string => `tentacle_library_prefs_${userId}`;
export const librariesKey = (userId: string): string => `tentacle_libraries_${userId}`;
export const itemTracksKey = (userId: string): string => `tentacle_item_tracks_${userId}`;
export const pendingPrefsKey = (userId: string): string => `tentacle_pending_prefs_${userId}`;

function subtitleModeOf(value: unknown): SubtitleMode {
  return value === "always" || value === "forced" || value === "signs" ? value : "none";
}

function readJsonArray(store: KeyValueStore, key: string): unknown[] {
  try {
    const raw = store.get(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(store: KeyValueStore, key: string, value: unknown[]): void {
  try {
    if (value.length === 0) store.remove(key);
    else store.set(key, JSON.stringify(value));
  } catch {
    // Cache best-effort : une écriture refusée ne doit rien casser.
  }
}

/* ── Préférences par bibliothèque ─────────────────────────────────────── */

/** Lecture prudente des lignes du serveur (`GET /api/preferences`). */
export function parseLibraryPrefs(rows: unknown): CachedLibraryPref[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.libraryId !== "string") return [];
    return [
      {
        libraryId: value.libraryId,
        audioLang: typeof value.audioLang === "string" ? value.audioLang : null,
        subtitleLang: typeof value.subtitleLang === "string" ? value.subtitleLang : null,
        subtitleMode: subtitleModeOf(value.subtitleMode),
      },
    ];
  });
}

export function readLibraryPrefs(store: KeyValueStore, userId: string): CachedLibraryPref[] {
  return parseLibraryPrefs(readJsonArray(store, libraryPrefsKey(userId)));
}

/**
 * Photographie les préférences du compte. Les modifications faites hors ligne
 * et pas encore poussées PRIMENT sur la photo : elles partiront au retour.
 */
export function cacheLibraryPrefs(store: KeyValueStore, userId: string, rows: unknown): void {
  const prefs = parseLibraryPrefs(rows);
  const pending = readPendingPrefs(store, userId);
  const merged = prefs.filter((p) => !pending.some((q) => q.libraryId === p.libraryId));
  for (const q of pending) {
    if (!q.reset) {
      merged.push({
        libraryId: q.libraryId,
        audioLang: q.audioLang,
        subtitleLang: q.subtitleLang,
        subtitleMode: q.subtitleMode,
      });
    }
  }
  write(store, libraryPrefsKey(userId), merged);
}

/**
 * Préférence applicable : celle de la bibliothèque si connue, sinon — cas
 * fréquent d'une instance mono-usage — l'unique préférence enregistrée.
 */
export function prefForLibrary(
  store: KeyValueStore,
  userId: string,
  libraryId: string | null,
): CachedLibraryPref | null {
  const prefs = readLibraryPrefs(store, userId);
  if (libraryId) {
    const normalized = libraryId.replace(/-/g, "").toLowerCase();
    const match = prefs.find((p) => p.libraryId.replace(/-/g, "").toLowerCase() === normalized);
    if (match) return match;
  }
  return prefs.length === 1 ? (prefs[0] ?? null) : null;
}

/* ── Bibliothèques (id + nom) — page Préférences utilisable hors ligne ── */

export function cacheLibrariesList(
  store: KeyValueStore,
  userId: string,
  libs: ReadonlyArray<{ Id: string; Name: string }>,
): void {
  write(
    store,
    librariesKey(userId),
    libs.map((lib): CachedLibrary => ({ id: lib.Id, name: lib.Name })),
  );
}

export function readLibrariesList(store: KeyValueStore, userId: string): CachedLibrary[] {
  return readJsonArray(store, librariesKey(userId)).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    return typeof value.id === "string" && typeof value.name === "string"
      ? [{ id: value.id, name: value.name }]
      : [];
  });
}

/* ── Modifications hors ligne en attente ──────────────────────────────── */

export function readPendingPrefs(store: KeyValueStore, userId: string): PendingPrefUpsert[] {
  return readJsonArray(store, pendingPrefsKey(userId)).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.libraryId !== "string") return [];
    const upsert: PendingPrefUpsert = {
      libraryId: value.libraryId,
      audioLang: typeof value.audioLang === "string" ? value.audioLang : null,
      subtitleLang: typeof value.subtitleLang === "string" ? value.subtitleLang : null,
      subtitleMode: subtitleModeOf(value.subtitleMode),
    };
    if (value.reset === true) upsert.reset = true;
    return [upsert];
  });
}

export function writePendingPrefs(store: KeyValueStore, userId: string, list: PendingPrefUpsert[]): void {
  write(store, pendingPrefsKey(userId), list);
}

/** Dernier état par bibliothèque, et le cache appliqué aussitôt (lecture locale). */
export function queuePendingPref(store: KeyValueStore, userId: string, upsert: PendingPrefUpsert): void {
  const list = readPendingPrefs(store, userId).filter((p) => p.libraryId !== upsert.libraryId);
  list.push(upsert);
  writePendingPrefs(store, userId, list);
  const current = readLibraryPrefs(store, userId).filter((p) => p.libraryId !== upsert.libraryId);
  if (!upsert.reset) {
    current.push({
      libraryId: upsert.libraryId,
      audioLang: upsert.audioLang,
      subtitleLang: upsert.subtitleLang,
      subtitleMode: upsert.subtitleMode,
    });
  }
  write(store, libraryPrefsKey(userId), current);
}

/* ── Langues retenues par contenu ─────────────────────────────────────── */

function readItemEntries(store: KeyValueStore, userId: string): ItemEntry[] {
  return readJsonArray(store, itemTracksKey(userId)).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.itemId !== "string") return [];
    return [
      {
        itemId: value.itemId,
        audioLang: typeof value.audioLang === "string" ? value.audioLang : null,
        subtitleLang: typeof value.subtitleLang === "string" ? value.subtitleLang : null,
        subtitleMode: subtitleModeOf(value.subtitleMode),
        seq: typeof value.seq === "number" ? value.seq : 0,
      },
    ];
  });
}

/** Enregistre (ou met à jour) le choix de langues d'un contenu. */
export function rememberItemTracks(
  store: KeyValueStore,
  userId: string,
  itemId: string,
  choice: ItemTrackChoice,
): void {
  const entries = readItemEntries(store, userId).filter((e) => e.itemId !== itemId);
  const seq = entries.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
  entries.push({ itemId, ...choice, seq });
  entries.sort((a, b) => a.seq - b.seq);
  write(store, itemTracksKey(userId), entries.slice(Math.max(0, entries.length - ITEM_TRACKS_MAX_ENTRIES)));
}

/** Le choix retenu pour ce contenu, ou `null`. */
export function itemTracksFor(
  store: KeyValueStore,
  userId: string,
  itemId: string | null | undefined,
): ItemTrackChoice | null {
  if (!itemId) return null;
  const found = readItemEntries(store, userId).find((e) => e.itemId === itemId);
  if (!found) return null;
  return { audioLang: found.audioLang, subtitleLang: found.subtitleLang, subtitleMode: found.subtitleMode };
}

/** Recopie la photo serveur des préférences par contenu (`GET /api/preferences/items`). */
export function cacheItemTracks(store: KeyValueStore, userId: string, rows: unknown): void {
  if (!Array.isArray(rows)) return;
  let seq = 0;
  const entries: ItemEntry[] = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.itemId !== "string") return [];
    seq += 1;
    return [
      {
        itemId: value.itemId,
        audioLang: typeof value.audioLang === "string" ? value.audioLang : null,
        subtitleLang: typeof value.subtitleLang === "string" ? value.subtitleLang : null,
        subtitleMode: subtitleModeOf(value.subtitleMode),
        seq,
      },
    ];
  });
  write(store, itemTracksKey(userId), entries.slice(Math.max(0, entries.length - ITEM_TRACKS_MAX_ENTRIES)));
}

/* ── Langues ──────────────────────────────────────────────────────────── */

/** « fre-vff » → « fre » ; alias bibliographiques courants ramenés à ISO-B. */
export function langPrefix(value: string | null | undefined): string {
  const prefix = ((value ?? "").toLowerCase().split("-")[0] ?? "").slice(0, 3);
  if (prefix === "fra" || prefix === "fr") return "fre";
  if (prefix === "deu" || prefix === "de") return "ger";
  if (prefix === "en") return "eng";
  return prefix;
}

export function sameLang(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = langPrefix(a);
  const pb = langPrefix(b);
  return pa !== "" && pa === pb;
}
