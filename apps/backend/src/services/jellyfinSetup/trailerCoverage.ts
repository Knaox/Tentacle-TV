import { getJellyfinUrl } from "../configStore";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";

/**
 * Combien de films et de séries ont une bande-annonce — compté ici, titre par
 * titre, et non par le filtre `HasTrailer` de Jellyfin : mesuré le
 * 2026-09-29, il compte les bandes-annonces distantes en 10.11.8 et plus en
 * 12.1.0 (« Inception », trois RemoteTrailers : 1 d'un côté, 0 de l'autre).
 *
 * Champs minimaux (identifiants et bandes-annonces, ni images ni données
 * d'utilisateur), pages de 500, plafond de 10 000 titres ; gardé dix minutes
 * par serveur — la vue d'ensemble se rouvre souvent, une bibliothèque change
 * rarement plus vite. « Rechercher les métadonnées manquantes » l'oublie.
 */

export interface TrailerCounts {
  titles: number;
  withTmdb: number;
  withTrailer: number;
  sampled: boolean;
}

const PAGE = 500;
const CAP = 10_000;
const TTL_MS = 10 * 60_000;
// `LocalTrailerCount` n'arrive que demandé (10.11.8 comme 12.1.0).
const FIELDS = "Fields=RemoteTrailers,LocalTrailerCount,ProviderIds&EnableImages=false&EnableUserData=false";

let cached: { key: string; counts: TrailerCounts; at: number } | null = null;

type Loose = Record<string, unknown>;
const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);

/** Une page de titres ; `null` si Jellyfin ne répond pas comme attendu. */
async function readPage(start: number): Promise<{ items: Loose[]; total: number } | null> {
  const res = await jellyfinAdminFetch(
    `/Items?Recursive=true&IncludeItemTypes=Movie,Series&${FIELDS}&StartIndex=${String(start)}&Limit=${String(PAGE)}`,
    { timeoutMs: 15_000 },
  );
  if (!res.ok || !isRecord(res.data) || !Array.isArray(res.data.Items)) return null;
  const total = typeof res.data.TotalRecordCount === "number" ? res.data.TotalRecordCount : res.data.Items.length;
  return { items: res.data.Items.filter(isRecord), total };
}

/** Un titre a une bande-annonce : distante (TMDB via Jellyfin) ou locale. */
export function hasTrailer(item: Loose): boolean {
  const remote = Array.isArray(item.RemoteTrailers) && item.RemoteTrailers.length > 0;
  const local = typeof item.LocalTrailerCount === "number" && item.LocalTrailerCount > 0;
  return remote || local;
}

export function hasTmdbId(item: Loose): boolean {
  const ids = isRecord(item.ProviderIds) ? item.ProviderIds : {};
  return Object.entries(ids).some(([name, value]) => name.toLowerCase() === "tmdb" && typeof value === "string" && value !== "");
}

export async function readTrailerCoverage(): Promise<TrailerCounts | null> {
  const key = getJellyfinUrl() ?? "";
  if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.counts;
  const counts: TrailerCounts = { titles: 0, withTmdb: 0, withTrailer: 0, sampled: false };
  let start = 0;
  for (;;) {
    const page = await readPage(start);
    if (!page) return null;
    for (const item of page.items) {
      counts.titles += 1;
      if (hasTmdbId(item)) counts.withTmdb += 1;
      if (hasTrailer(item)) counts.withTrailer += 1;
    }
    start += page.items.length;
    if (page.items.length === 0 || start >= page.total) break;
    if (start >= CAP) {
      counts.sampled = true;
      break;
    }
  }
  cached = { key, counts, at: Date.now() };
  return counts;
}

/** Après une actualisation demandée d'ici : la prochaine lecture recompte. */
export function forgetTrailerCoverage(): void {
  cached = null;
}
