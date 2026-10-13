import { jellyfinAdminFetch } from "../jellyfinAdminFetch";

/**
 * La langue des TITRES hors bibliothèque : celle des métadonnées de Jellyfin
 * (« fr » + « FR » → « fr-FR »), comme les titres de la bibliothèque. Sans
 * elle, TMDB répond en anglais : « Arrival » à côté de « Premier Contact ».
 * Relue au plus toutes les six heures ; inconnue → rien (l'anglais de TMDB).
 */
const TTL_MS = 6 * 3600_000;
let cache: { value: string | null; at: number } | null = null;
let forced: string | null | undefined;

/** Pur : l'étiquette TMDB d'une langue de métadonnées Jellyfin (« fr », « FR » → « fr-FR » ; « pt-BR » tel quel). */
export function languageTag(language?: string | null, country?: string | null): string | null {
  const lang = (language ?? "").trim();
  if (/^[a-z]{2,3}-[A-Z]{2}$/.test(lang)) return lang;
  if (!/^[a-z]{2,3}$/i.test(lang)) return null;
  const c = (country ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? `${lang.toLowerCase()}-${c}` : lang.toLowerCase();
}

/** Relit la langue de Jellyfin (au plus toutes les six heures) ; un échec garde la précédente. */
export async function refreshTitleLanguage(now = Date.now()): Promise<string | null> {
  if (forced !== undefined) return forced;
  if (cache && now - cache.at < TTL_MS) return cache.value;
  const res = await jellyfinAdminFetch<{ PreferredMetadataLanguage?: string; MetadataCountryCode?: string }>("/System/Configuration");
  const value = res.ok ? languageTag(res.data.PreferredMetadataLanguage, res.data.MetadataCountryCode) : cache?.value ?? null;
  cache = { value, at: now };
  return value;
}

/** La langue connue (sans appel) : null tant qu'elle n'a pas été lue. */
export function titleLanguage(): string | null {
  return forced !== undefined ? forced : cache?.value ?? null;
}

/** Le banc et les tests la fixent : aucun appel à Jellyfin. `undefined` rend la main à Jellyfin. */
export function setTitleLanguage(value: string | null | undefined): void {
  forced = value;
}

/** Les paramètres d'une liste TMDB de candidats : la langue des titres, si connue. */
export function titleLanguageParams(): Record<string, string> {
  const language = titleLanguage();
  return language ? { language } : {};
}
