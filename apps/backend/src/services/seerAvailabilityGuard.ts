import { getPrisma } from "./db";
import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";
import { getAdminUserId } from "./jellyfinLibrary";
import { findLibraryItemByTmdb as findByTmdb } from "./jellyfinTmdbLookup";
import { normalizeTitle } from "./libraryAddedDedup";
import type { RegistryClaim } from "./announcedRegistry";
import { jellyfinAuthHeaders } from "./jellyfinAuth";

// Garde de VÉRITÉ des annonces de disponibilité Seer. Le plugin (bundle généré
// intouchable) fabrique ses notifs « … est sorti(e) sur Tentacle TV » sur la
// seule foi du statut Jellyseerr — statut qui peut être périmé (contenu
// supprimé de la bibliothèque, availability-sync en retard) : une simple
// DEMANDE pouvait déclencher une fausse annonce de dispo immédiate.
// Blindage côté core : avant de POUSSER une annonce de dispo, on vérifie que
// le film (ou chaque saison annoncée) est réellement présent dans Jellyfin.
// Absent → le worker DIFFÈRE le push (la ligne reste pushedAt=null) et la
// ré-évalue à chaque tick : la notif part quand le contenu atterrit vraiment.
// Le découpage par saison (quelle saison pousser quand) vit dans
// seerPushPlanner.ts ; ici on ne fait que constater la présence.
//
// Sans couplage dur au plugin : la résolution du contenu passe d'abord par
// refId → seer_requests (lecture SQL brute, try/catch — table créée par le
// plugin, absente si plugin non installé), sinon par les content_claims de
// l'utilisateur (titre normalisé). Échec de résolution ou panne Jellyfin →
// verdict 'unknown' = FAIL-OPEN (on pousse comme avant : une panne ne doit
// jamais avaler une notification légitime).

export type AvailabilityVerdict = "present" | "absent" | "unknown";

/** Saisons annoncées par une notif de dispo ([] = film ou série sans détail). */
export interface SeerAvailability {
  seasons: number[];
}

const NEGATIVE_TTL_MS = 5 * 60_000; // « absent » re-vérifié au plus toutes les 5 min
const negativeCache = new Map<string, number>(); // clé contenu/saison → expiration (epoch ms)

function purgeNegativeCache(now: number): void {
  for (const [k, exp] of negativeCache) if (exp <= now) negativeCache.delete(k);
}

/**
 * null si la notif n'est PAS une annonce de disponibilité. Prédicat et regex
 * identiques à seerContentKeys (announcedRegistry) : seules les annonces de
 * dispo portent le suffixe « sur Tentacle TV » (releasedSuffix du plugin).
 */
export function parseSeerAvailability(n: { body: string | null }): SeerAvailability | null {
  const body = n.body ?? "";
  if (!body.includes("sur Tentacle TV")) return null;
  const m = body.match(/^Saisons?\s+([\d\s,]+)/i);
  const seasons = m
    ? m[1].split(/[\s,]+/).map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x))
    : [];
  return { seasons };
}

/**
 * Résout (tmdbId, mediaType) du contenu annoncé, sous forme de RegistryClaim
 * SYNTHÉTIQUE (title = titre de la notif → matche toujours dans seerContentKeys,
 * garantissant des clés tmdb même quand le claim TTL 30 min a été purgé).
 * Ordre : refId → seer_requests ; sinon claim utilisateur au même titre ; sinon null.
 */
export async function resolveSeerContent(
  n: { refId: string | null; title: string },
  userClaims: RegistryClaim[],
): Promise<RegistryClaim | null> {
  if (n.refId) {
    try {
      const rows = await getPrisma().$queryRawUnsafe<
        Array<{ tmdb_id: unknown; media_type: unknown }>
      >(`SELECT tmdb_id, media_type FROM seer_requests WHERE id = ? LIMIT 1`, n.refId);
      const row = rows[0];
      if (row) {
        const tmdbId = Number(row.tmdb_id);
        const mediaType = String(row.media_type);
        if (Number.isFinite(tmdbId) && tmdbId > 0 && (mediaType === "movie" || mediaType === "tv")) {
          return { tmdbId, mediaType, title: n.title };
        }
      }
    } catch {
      // Table du plugin absente ou requête en échec → repli sur les claims.
    }
  }
  const norm = normalizeTitle(n.title);
  return userClaims.find((c) => normalizeTitle(c.title) === norm) ?? null;
}

/** Numéros de saison présents dans Jellyfin pour une série, null si échec. */
async function fetchSeasonNumbers(seriesId: string): Promise<Set<number> | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const userId = await getAdminUserId();
  if (!jellyfinUrl || !apiKey || !userId) return null;
  try {
    const res = await fetch(
      `${jellyfinUrl}/Shows/${seriesId}/Seasons?userId=${userId}&EnableImages=false`,
      { headers: jellyfinAuthHeaders(apiKey), signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Items?: Array<{ IndexNumber?: number }> };
    const set = new Set<number>();
    for (const it of data.Items ?? []) {
      if (typeof it.IndexNumber === "number") set.add(it.IndexNumber);
    }
    return set;
  } catch {
    return null;
  }
}

/**
 * Verdict de présence REELLE d'un contenu SANS détail de saison (film ou série
 * entière). 'absent' est mémorisé 5 min (cache négatif, purge paresseuse) pour
 * ne pas marteler Jellyfin à chaque tick de 15 s ; 'present' et 'unknown' ne
 * sont JAMAIS cachés (fraîcheur au moment du push, panne transitoire).
 * Log uniquement sur verdict fraîchement calculé.
 */
export async function checkJellyfinPresence(
  resolved: RegistryClaim | null,
): Promise<AvailabilityVerdict> {
  if (!resolved || (resolved.mediaType !== "movie" && resolved.mediaType !== "tv")) {
    return "unknown";
  }
  const now = Date.now();
  purgeNegativeCache(now);
  const key = `${resolved.mediaType}:${resolved.tmdbId}`;
  if (negativeCache.has(key)) return "absent";

  const label = `« ${resolved.title} » (${resolved.mediaType} tmdb:${resolved.tmdbId})`;
  const lookup = await findByTmdb(resolved.tmdbId, resolved.mediaType);
  if (lookup.kind === "error") {
    console.log(`[SeerGuard] ${label} vérification impossible → push (fail-open)`);
    return "unknown";
  }
  if (lookup.kind === "missing") {
    negativeCache.set(key, now + NEGATIVE_TTL_MS);
    console.log(`[SeerGuard] ${label} absent de Jellyfin → push différé`);
    return "absent";
  }
  console.log(`[SeerGuard] ${label} présent dans Jellyfin → push`);
  return "present";
}

/**
 * Présence PAR SAISON dans Jellyfin (une seule passe HTTP pour tout le lot).
 * Retourne l'ensemble des saisons réellement présentes, ou 'unknown' si
 * invérifiable (fail-open géré par l'appelant). Chaque saison absente est
 * mémorisée 5 min ; si TOUTES les saisons demandées sont en cache négatif,
 * aucune requête n'est émise (et rien n'est loggé — anti-spam des ticks).
 */
export async function checkSeasonsPresence(
  resolved: RegistryClaim,
  seasons: number[],
): Promise<Set<number> | "unknown"> {
  const now = Date.now();
  purgeNegativeCache(now);
  const sKey = (s: number): string => `s:${resolved.tmdbId}:${s}`;
  if (seasons.every((s) => negativeCache.has(sKey(s)))) return new Set();

  const label = `« ${resolved.title} » (tv tmdb:${resolved.tmdbId})`;
  const lookup = await findByTmdb(resolved.tmdbId, "tv");
  if (lookup.kind === "error") {
    console.log(`[SeerGuard] ${label} vérification impossible → push (fail-open)`);
    return "unknown";
  }
  if (lookup.kind === "missing") {
    for (const s of seasons) negativeCache.set(sKey(s), now + NEGATIVE_TTL_MS);
    console.log(`[SeerGuard] ${label} série absente de Jellyfin → push différé`);
    return new Set();
  }
  const have = await fetchSeasonNumbers(lookup.id);
  if (have === null) {
    console.log(`[SeerGuard] ${label} saisons invérifiables → push (fail-open)`);
    return "unknown";
  }
  const present = new Set(seasons.filter((s) => have.has(s)));
  const missing = seasons.filter((s) => !present.has(s));
  for (const s of missing) negativeCache.set(sKey(s), now + NEGATIVE_TTL_MS);
  if (missing.length > 0) {
    console.log(`[SeerGuard] ${label} saisons manquantes [${missing.join(",")}] → différées`);
  }
  if (present.size > 0) {
    console.log(`[SeerGuard] ${label} saisons présentes [${[...present].join(",")}] → push`);
  }
  return present;
}
