/**
 * Préférences de pistes (audio/sous-titres PAR BIBLIOTHÈQUE) pour le mode
 * hors ligne. En ligne, la résolution fine est faite par le backend (alias
 * VFF/VFQ, heuristiques) ; hors ligne on applique une résolution SIMPLIFIÉE
 * depuis un cache local des préférences brutes, rafraîchi à chaque session en
 * ligne (OfflineSessionSync). Par appareil et par utilisateur — aucun secret.
 */

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
