import type { TitleMeta } from "../tmdb/metaCache";

/** Une facette d'un titre, avec son multiplicateur intrinsèque. */
export interface FacetEntry {
  key: string;
  mult: number;
}

/** Réalisateur ×2 par rapport aux acteurs — la signature d'auteur pèse. */
const DIRECTOR_MULT = 2;

/** Bucket de durée : < 90, 90-120, 120-150, > 150 minutes. */
export function runtimeBucket(minutes: number): "short" | "standard" | "long" | "epic" {
  if (minutes < 90) return "short";
  if (minutes <= 120) return "standard";
  if (minutes <= 150) return "long";
  return "epic";
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/**
 * Facettes d'un titre depuis ses métadonnées TMDB. Espaces de clés par
 * préfixe : `genre:`/`kw:`/`director:`/`actor:`/`studio:`/`network:` portent
 * des IDs TMDB ; `decade:`/`lang:`/`runtime:` sont neutres et partagés avec
 * l'extraction Jellyfin.
 */
export function facetsFromTmdb(meta: TitleMeta): FacetEntry[] {
  const out: FacetEntry[] = [];
  for (const g of meta.genres) out.push({ key: `genre:${g.id}`, mult: 1 });
  // Les keywords sont la facette la plus discriminante du profil.
  for (const k of meta.keywords) out.push({ key: `kw:${k.id}`, mult: 1 });
  for (const d of meta.directors) out.push({ key: `director:${d.id}`, mult: DIRECTOR_MULT });
  for (const a of meta.topCast) out.push({ key: `actor:${a.id}`, mult: 1 });
  for (const s of meta.studios) out.push({ key: `studio:${s.id}`, mult: 1 });
  for (const n of meta.networks) out.push({ key: `network:${n.id}`, mult: 1 });
  if (meta.year != null) out.push({ key: `decade:${decadeOf(meta.year)}`, mult: 1 });
  if (meta.originalLanguage) out.push({ key: `lang:${meta.originalLanguage}`, mult: 1 });
  if (meta.runtimeMinutes != null && meta.runtimeMinutes > 0) {
    out.push({ key: `runtime:${runtimeBucket(meta.runtimeMinutes)}`, mult: 1 });
  }
  return out;
}

/** Champs Jellyfin suffisants pour des facettes de repli (sans TMDB). */
export interface JellyfinFacetSource {
  Genres?: string[];
  Studios?: Array<{ Name?: string }>;
  ProductionYear?: number;
  RunTimeTicks?: number;
  /** Langue d'origine si connue (rarement exposée par Jellyfin). */
  OriginalLanguage?: string;
}

const TICKS_PER_MINUTE = 600_000_000;

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Facettes de repli depuis un item Jellyfin — espaces `genre-name:` /
 * `studio-name:` distincts des IDs TMDB : les deux mondes ne doivent jamais
 * se mélanger dans le même compteur IDF.
 */
export function facetsFromJellyfin(item: JellyfinFacetSource): FacetEntry[] {
  const out: FacetEntry[] = [];
  for (const g of item.Genres ?? []) {
    if (g) out.push({ key: `genre-name:${slug(g)}`, mult: 1 });
  }
  for (const s of item.Studios ?? []) {
    if (s.Name) out.push({ key: `studio-name:${slug(s.Name)}`, mult: 1 });
  }
  if (item.ProductionYear) out.push({ key: `decade:${decadeOf(item.ProductionYear)}`, mult: 1 });
  if (item.OriginalLanguage) out.push({ key: `lang:${item.OriginalLanguage}`, mult: 1 });
  if (item.RunTimeTicks && item.RunTimeTicks > 0) {
    const minutes = item.RunTimeTicks / TICKS_PER_MINUTE;
    out.push({ key: `runtime:${runtimeBucket(minutes)}`, mult: 1 });
  }
  return out;
}
