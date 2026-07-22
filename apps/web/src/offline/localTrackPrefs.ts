/**
 * Préférences de pistes (audio/sous-titres PAR BIBLIOTHÈQUE) pour le mode
 * hors ligne. En ligne, la résolution fine est faite par le backend (alias
 * VFF/VFQ, heuristiques) ; hors ligne on applique une résolution SIMPLIFIÉE
 * depuis un cache local des préférences brutes, rafraîchi à chaque session en
 * ligne (OfflineSessionSync). Par appareil et par utilisateur — aucun secret.
 */

import { readPendingPrefs } from "./pendingPrefs";

export type SubtitleMode = "none" | "always" | "forced" | "signs";

export interface CachedLibraryPref {
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

const STORAGE_KEY_PREFIX = "tentacle_library_prefs_";

export function cacheLibraryPrefs(userId: string, rows: unknown): void {
  if (!Array.isArray(rows)) return;
  const prefs: CachedLibraryPref[] = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.libraryId !== "string") return [];
    const mode = value.subtitleMode;
    return [
      {
        libraryId: value.libraryId,
        audioLang: typeof value.audioLang === "string" ? value.audioLang : null,
        subtitleLang: typeof value.subtitleLang === "string" ? value.subtitleLang : null,
        subtitleMode:
          mode === "always" || mode === "forced" || mode === "signs" ? mode : "none",
      },
    ];
  });
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(prefs));
  } catch {
    /* cache best-effort */
  }
}

/**
 * Photographie les préférences du compte pour l'usage hors ligne. Appelée à
 * chaque passage en ligne, à chaque téléchargement lancé et après chaque
 * lecture réussie des préférences : un cache vide signifierait « aucune
 * préférence » et le lecteur local retomberait sur les pistes par défaut du
 * fichier. Best-effort, jamais bloquant.
 */
export async function refreshLibraryPrefsCache(
  userId: string,
  backendBase: string,
): Promise<void> {
  try {
    const token = localStorage.getItem("tentacle_token");
    if (!token) return;
    const res = await fetch(`${backendBase}/api/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    cacheLibraryPrefs(userId, await res.json());
    // Les modifications faites hors ligne et pas encore poussées PRIMENT sur
    // la photo serveur (elles partiront via flushPendingPrefs).
    applyPendingOverCache(userId);
  } catch {
    /* hors ligne ou backend injoignable : on garde le cache précédent */
  }
}

function applyPendingOverCache(userId: string): void {
  const pending = readPendingPrefs(userId);
  if (pending.length === 0) return;
  const base = readLibraryPrefs(userId).filter(
    (p) => !pending.some((q) => q.libraryId === p.libraryId),
  );
  for (const q of pending) {
    if (!q.reset) {
      base.push({
        libraryId: q.libraryId,
        audioLang: q.audioLang,
        subtitleLang: q.subtitleLang,
        subtitleMode: q.subtitleMode,
      });
    }
  }
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(base));
  } catch {
    /* cache best-effort */
  }
}

/* ── Bibliothèques (id + nom) — page Préférences utilisable hors ligne ── */

export interface CachedLibrary {
  id: string;
  name: string;
}

const LIBRARIES_KEY_PREFIX = "tentacle_libraries_";

export function cacheLibrariesList(
  userId: string,
  libs: Array<{ Id: string; Name: string }>,
): void {
  try {
    const list: CachedLibrary[] = libs.map((lib) => ({ id: lib.Id, name: lib.Name }));
    localStorage.setItem(`${LIBRARIES_KEY_PREFIX}${userId}`, JSON.stringify(list));
  } catch {
    /* cache best-effort */
  }
}

export function readLibrariesList(userId: string): CachedLibrary[] {
  try {
    const raw = localStorage.getItem(`${LIBRARIES_KEY_PREFIX}${userId}`);
    const parsed = raw ? (JSON.parse(raw) as CachedLibrary[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Photographie id + nom des bibliothèques (léger : /Views sans enrichissement). */
export async function refreshLibrariesCache(userId: string, backendBase: string): Promise<void> {
  try {
    const token = localStorage.getItem("tentacle_token");
    if (!token) return;
    const res = await fetch(`${backendBase}/api/jellyfin/Users/${userId}/Views`, {
      headers: { "X-Emby-Token": token },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { Items?: Array<{ Id?: unknown; Name?: unknown }> };
    const items = (data.Items ?? []).filter(
      (lib): lib is { Id: string; Name: string } =>
        typeof lib.Id === "string" && typeof lib.Name === "string",
    );
    cacheLibrariesList(userId, items);
  } catch {
    /* on garde le cache précédent */
  }
}

export function readLibraryPrefs(userId: string): CachedLibraryPref[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    const parsed = raw ? (JSON.parse(raw) as CachedLibraryPref[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Préférence applicable : celle de la bibliothèque si connue, sinon — cas
 * fréquent d'une instance mono-usage — l'unique préférence enregistrée.
 */
export function prefForLibrary(
  userId: string,
  libraryId: string | null,
): CachedLibraryPref | null {
  const prefs = readLibraryPrefs(userId);
  if (libraryId) {
    const normalized = libraryId.replace(/-/g, "").toLowerCase();
    const match = prefs.find(
      (p) => p.libraryId.replace(/-/g, "").toLowerCase() === normalized,
    );
    if (match) return match;
  }
  return prefs.length === 1 ? prefs[0] : null;
}

/** « fre-vff » → « fre » ; alias bibliographiques courants ramenés à ISO-B. */
export function langPrefix(value: string | null | undefined): string {
  const prefix = (value ?? "").toLowerCase().split("-")[0].slice(0, 3);
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
