import { getPrisma, hasPrisma } from "../db";
import { tmdbConfigured, tmdbFetch, type TmdbPriority } from "../tmdb/client";
import { getTitleMeta, metaKey } from "../tmdb/metaCache";
import type { TitleCertifications } from "./externalTitleRule";

/**
 * Les certifications d'un titre TMDB, gardées DANS le cache des fiches
 * (`tmdb_meta_cache`, aucune table de plus) : la fiche porte déjà `adult` et les
 * mots-clés ; on y ajoute, réduites au strict nécessaire, `release_dates` (film) ou
 * `content_ratings` (série), lues par UN appel de plus la première fois. Une
 * certification ne change presque jamais : une ligne périmée sert encore.
 *
 * Coût borné : au plus `budget` titres lus chez TMDB par appel (file interactive) ;
 * les autres sont CACHÉS cette fois-ci (fermé à l'échec) et lus en fond pour la
 * suivante. Rien n'est lu pour un compte non restreint : seul `externalTitles.ts`
 * appelle ce module, après avoir vu la restriction.
 */

type Ref = { mediaType: "movie" | "tv"; tmdbId: number };

interface SlimMovieReleases {
  results: { iso_3166_1: string; release_dates: { certification: string }[] }[];
}

interface SlimTvRatings {
  results: { iso_3166_1: string; rating: string }[];
}

interface RawPayload {
  adult?: boolean;
  keywords?: { keywords?: { name?: string }[]; results?: { name?: string }[] };
  release_dates?: SlimMovieReleases;
  content_ratings?: SlimTvRatings;
}

const CHUNK = 400;
const backgroundQueue = new Set<string>();

function certificationKey(mediaType: Ref["mediaType"]): "release_dates" | "content_ratings" {
  return mediaType === "movie" ? "release_dates" : "content_ratings";
}

/** Réduit la réponse de TMDB aux seules certifications non vides. Pur. */
export function slimCertifications(mediaType: Ref["mediaType"], raw: unknown): SlimMovieReleases | SlimTvRatings {
  const results = Array.isArray((raw as { results?: unknown })?.results) ? ((raw as { results: unknown[] }).results) : [];
  if (mediaType === "movie") {
    return {
      results: results.flatMap((entry) => {
        const { iso_3166_1, release_dates } = (entry ?? {}) as { iso_3166_1?: unknown; release_dates?: unknown };
        if (typeof iso_3166_1 !== "string" || !Array.isArray(release_dates)) return [];
        const certs = release_dates
          .map((date) => (date as { certification?: unknown })?.certification)
          .filter((cert): cert is string => typeof cert === "string" && cert.trim() !== "")
          .map((certification) => ({ certification: certification.trim() }));
        return certs.length ? [{ iso_3166_1, release_dates: certs }] : [];
      }),
    };
  }
  return {
    results: results.flatMap((entry) => {
      const { iso_3166_1, rating } = (entry ?? {}) as { iso_3166_1?: unknown; rating?: unknown };
      return typeof iso_3166_1 === "string" && typeof rating === "string" && rating.trim() !== ""
        ? [{ iso_3166_1, rating: rating.trim() }]
        : [];
    }),
  };
}

/** Les certifications d'une fiche en cache, ou null si elle ne les porte pas encore. Pur. */
export function certificationsFromPayload(ref: Ref, payload: RawPayload): TitleCertifications | null {
  const byCountry: Record<string, string[]> = {};
  if (ref.mediaType === "movie") {
    if (!payload.release_dates) return null;
    for (const entry of payload.release_dates.results ?? []) {
      byCountry[entry.iso_3166_1] = (entry.release_dates ?? []).map((date) => date.certification);
    }
  } else {
    if (!payload.content_ratings) return null;
    for (const entry of payload.content_ratings.results ?? []) {
      (byCountry[entry.iso_3166_1] ??= []).push(entry.rating);
    }
  }
  const keywords = (payload.keywords?.keywords ?? payload.keywords?.results ?? [])
    .map((keyword) => keyword?.name)
    .filter((name): name is string => typeof name === "string");
  return { mediaType: ref.mediaType, adult: payload.adult === true, byCountry, keywords };
}

async function readRows(refs: Ref[]): Promise<Map<string, RawPayload>> {
  const out = new Map<string, RawPayload>();
  const prisma = getPrisma();
  for (let i = 0; i < refs.length; i += CHUNK) {
    const rows = await prisma.tmdbMetaCache.findMany({
      where: { OR: refs.slice(i, i + CHUNK).map((ref) => ({ mediaType: ref.mediaType, tmdbId: ref.tmdbId })) },
      select: { mediaType: true, tmdbId: true, payload: true },
    });
    for (const row of rows) {
      try {
        out.set(metaKey(row.mediaType as Ref["mediaType"], row.tmdbId), JSON.parse(row.payload) as RawPayload);
      } catch {
        // Ligne illisible : traitée comme absente.
      }
    }
  }
  return out;
}

/** Lit chez TMDB ce qui manque à UN titre et l'ajoute à sa fiche en cache. null : rien d'exploitable. */
async function fetchCertifications(ref: Ref, priority: TmdbPriority): Promise<TitleCertifications | null> {
  if (!(await getTitleMeta(ref.mediaType, ref.tmdbId, { priority }))) return null;
  const key = certificationKey(ref.mediaType);
  const slim = slimCertifications(ref.mediaType, await tmdbFetch(`/${ref.mediaType}/${ref.tmdbId}/${key}`, {}, { priority }));
  const prisma = getPrisma();
  const row = await prisma.tmdbMetaCache.findUnique({ where: { mediaType_tmdbId: { mediaType: ref.mediaType, tmdbId: ref.tmdbId } } });
  if (!row) return null;
  const payload = JSON.parse(row.payload) as RawPayload;
  if (ref.mediaType === "movie") payload.release_dates = slim as SlimMovieReleases;
  else payload.content_ratings = slim as SlimTvRatings;
  await prisma.tmdbMetaCache.update({
    where: { mediaType_tmdbId: { mediaType: ref.mediaType, tmdbId: ref.tmdbId } },
    data: { payload: JSON.stringify(payload) },
  });
  return certificationsFromPayload(ref, payload);
}

function fillInBackground(refs: Ref[]): void {
  for (const ref of refs) {
    const key = metaKey(ref.mediaType, ref.tmdbId);
    if (backgroundQueue.has(key)) continue;
    backgroundQueue.add(key);
    void fetchCertifications(ref, "background")
      .catch(() => null)
      .finally(() => backgroundQueue.delete(key));
  }
}

/**
 * Les certifications de chaque titre (clé `metaKey`) ; null : inconnues (le titre
 * sera caché à un compte restreint). Jamais une exception.
 */
export async function getTitleCertifications(refs: readonly Ref[], options: { budget: number }): Promise<Map<string, TitleCertifications | null>> {
  const out = new Map<string, TitleCertifications | null>();
  const unique = [...new Map(refs.map((ref) => [metaKey(ref.mediaType, ref.tmdbId), ref])).values()];
  if (unique.length === 0 || !hasPrisma()) return out;
  let rows: Map<string, RawPayload>;
  try {
    rows = await readRows(unique);
  } catch {
    return out;
  }
  const missing: Ref[] = [];
  for (const ref of unique) {
    const key = metaKey(ref.mediaType, ref.tmdbId);
    const payload = rows.get(key);
    const certifications = payload ? certificationsFromPayload(ref, payload) : null;
    out.set(key, certifications);
    if (!certifications) missing.push(ref);
  }
  if (missing.length === 0 || !tmdbConfigured()) return out;
  const now = missing.slice(0, Math.max(0, options.budget));
  const results = await Promise.all(now.map((ref) => fetchCertifications(ref, "interactive").catch(() => null)));
  now.forEach((ref, index) => out.set(metaKey(ref.mediaType, ref.tmdbId), results[index]));
  fillInBackground(missing.slice(now.length));
  return out;
}
