import { getPrisma } from "./db";
import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";
import { getAdminUserId } from "./jellyfin";
import { normalizeTitle } from "./libraryAddedDedup";
import type { RegistryClaim } from "./announcedRegistry";

// Garde de VÉRITÉ des annonces de disponibilité Seer. Le plugin (bundle généré
// intouchable) fabrique ses notifs « … est sorti(e) sur Tentacle TV » sur la
// seule foi du statut Jellyseerr — statut qui peut être périmé (contenu
// supprimé de la bibliothèque, availability-sync en retard) : une simple
// DEMANDE pouvait déclencher une fausse annonce de dispo immédiate.
// Blindage côté core : avant de POUSSER une annonce de dispo, on vérifie que
// le film (ou CHAQUE saison annoncée) est réellement présent dans Jellyfin.
// Absent → le worker DIFFÈRE le push (la ligne reste pushedAt=null) et la
// ré-évalue à chaque tick : la notif part quand le contenu atterrit vraiment.
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
const negativeCache = new Map<string, number>(); // clé contenu → expiration (epoch ms)

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

type Lookup = { kind: "found"; id: string } | { kind: "missing" } | { kind: "error" };

/** Item Movie/Series par identifiant TMDB — stratégie éprouvée de routes/tmdb.ts
 *  (AnyProviderIdEquals + filtre exact, puis scan complet en repli), MAIS avec le
 *  userId admin : sans lui, /Items?Recursive=true masque une partie de la
 *  bibliothèque et produirait de faux « absent » (= reports indus). */
async function findByTmdb(tmdbId: number, mediaType: "movie" | "tv"): Promise<Lookup> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const userId = await getAdminUserId();
  if (!jellyfinUrl || !apiKey || !userId) return { kind: "error" };
  const itemTypes = mediaType === "movie" ? "Movie" : "Series";
  const headers = { "X-Emby-Token": apiKey };
  type Item = { Id?: string; ProviderIds?: { Tmdb?: string } };
  try {
    const res = await fetch(
      `${jellyfinUrl}/Items?userId=${userId}&AnyProviderIdEquals=tmdb.${tmdbId}` +
        `&IncludeItemTypes=${itemTypes}&Recursive=true&Limit=100&Fields=ProviderIds&EnableImages=false`,
      { headers, signal: AbortSignal.timeout(8_000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { Items?: Item[] };
      const match = data.Items?.find((it) => it.ProviderIds?.Tmdb === String(tmdbId));
      if (match?.Id) return { kind: "found", id: match.Id };
    }
    const allRes = await fetch(
      `${jellyfinUrl}/Items?userId=${userId}&IncludeItemTypes=${itemTypes}` +
        `&Recursive=true&Limit=10000&Fields=ProviderIds&EnableImages=false`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    if (!allRes.ok) return { kind: "error" };
    const allData = (await allRes.json()) as { Items?: Item[] };
    const match = allData.Items?.find((it) => it.ProviderIds?.Tmdb === String(tmdbId));
    return match?.Id ? { kind: "found", id: match.Id } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
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
      { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(8_000) },
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
 * Verdict de présence RÉELLE en bibliothèque. 'absent' est mémorisé 5 min
 * (cache négatif, purge paresseuse) pour ne pas marteler Jellyfin à chaque tick
 * de 15 s ; 'present' et 'unknown' ne sont JAMAIS cachés (fraîcheur au moment
 * du push, panne transitoire). Log uniquement sur verdict fraîchement calculé.
 */
export async function checkJellyfinPresence(
  resolved: RegistryClaim | null,
  seasons: number[],
): Promise<AvailabilityVerdict> {
  if (!resolved || (resolved.mediaType !== "movie" && resolved.mediaType !== "tv")) {
    return "unknown";
  }
  const now = Date.now();
  for (const [k, exp] of negativeCache) if (exp <= now) negativeCache.delete(k);
  const key = `${resolved.mediaType}:${resolved.tmdbId}:${seasons.join(",")}`;
  if ((negativeCache.get(key) ?? 0) > now) return "absent";

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
  if (resolved.mediaType === "tv" && seasons.length > 0) {
    const have = await fetchSeasonNumbers(lookup.id);
    if (have === null) {
      console.log(`[SeerGuard] ${label} saisons invérifiables → push (fail-open)`);
      return "unknown";
    }
    const missing = seasons.filter((s) => !have.has(s));
    if (missing.length > 0) {
      negativeCache.set(key, now + NEGATIVE_TTL_MS);
      console.log(`[SeerGuard] ${label} saisons manquantes [${missing.join(",")}] → push différé`);
      return "absent";
    }
  }
  console.log(`[SeerGuard] ${label} présent dans Jellyfin → push`);
  return "present";
}
