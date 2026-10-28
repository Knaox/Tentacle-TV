/**
 * Octave — la PAGE où l'on était en quittant (adresse et défilement), règle
 * PURE commune au web et au mobile : où retomber au lancement en Octave. Le
 * stockage (`OCTAVE_PAGE_KEY`, aucun secret : une adresse d'Octave et un
 * nombre de pixels) est celui de chaque plateforme ; une valeur illisible
 * vaut l'accueil d'Octave.
 */

/** Au-delà, la page gardée ne vaut plus : on rouvre l'accueil d'Octave. */
export const PAGE_RESUME_MAX_AGE_MS = 30 * 24 * 3_600_000;

export interface SavedOctavePage {
  owner: string;
  /** `pathname` + `search` (une recherche garde sa question). */
  path: string;
  scrollTop: number;
  savedAt: number;
}

/** Une adresse d'Octave qu'on peut rouvrir (jamais une adresse hors du mode). */
export function isOctavePath(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`) || path.startsWith(`${basePath}?`);
}

function valid(saved: SavedOctavePage | null, owner: string | null, now: number, basePath: string): saved is SavedOctavePage {
  if (!saved || owner === null || saved.owner !== owner) return false;
  if (now - saved.savedAt > PAGE_RESUME_MAX_AGE_MS || saved.savedAt > now + 60_000) return false;
  return isOctavePath(saved.path, basePath);
}

/** Où arriver au lancement : la page gardée de CETTE identité, sinon l'accueil d'Octave. */
export function resumePath(saved: SavedOctavePage | null, owner: string | null, now: number, basePath: string): string {
  return valid(saved, owner, now, basePath) ? saved.path : basePath;
}

/** Le défilement à rejouer, seulement sur la page gardée elle-même. */
export function resumeScroll(saved: SavedOctavePage | null, owner: string | null, now: number, basePath: string, path: string): number | null {
  if (!valid(saved, owner, now, basePath) || saved.path !== path) return null;
  return saved.scrollTop > 0 ? saved.scrollTop : null;
}

/** La valeur brute du stockage, lue sans jamais lever : `null` si elle ne décrit pas une page. */
export function parseSavedOctavePage(raw: string | null | undefined): SavedOctavePage | null {
  try {
    const parsed = JSON.parse(raw ?? "null") as Partial<SavedOctavePage> | null;
    if (!parsed || typeof parsed.owner !== "string" || typeof parsed.path !== "string") return null;
    const scrollTop = typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop) ? Math.max(0, Math.round(parsed.scrollTop)) : 0;
    return { owner: parsed.owner, path: parsed.path, scrollTop, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0 };
  } catch {
    return null;
  }
}

/** Le miroir de disponibilité gardé, lu sans jamais lever. */
export function parseOctaveLaunchMirror(raw: string | null | undefined): { owner: string; available: boolean } | null {
  try {
    const parsed = JSON.parse(raw ?? "null") as { owner?: unknown; available?: unknown } | null;
    if (!parsed || typeof parsed.owner !== "string" || typeof parsed.available !== "boolean") return null;
    return { owner: parsed.owner, available: parsed.available };
  } catch {
    return null;
  }
}
