import { getPrisma, hasPrisma } from "./db";
import type { LibItem } from "./jellyfin";
import { normalizeTitle } from "./libraryAddedDedup";

// Registre PERSISTANT des annonces push par (clé de contenu, utilisateur) —
// table announced_contents. Consulté et alimenté par LES DEUX pipelines
// (libraryAddedNotifier + notificationPushWorker) au moment de l'ENVOI : un
// contenu annoncé à un utilisateur ne l'est jamais deux fois, ni au restart
// (persistant, contrairement à l'ancien cache RAM 6 h), ni au changement de
// préférences, ni via l'autre pipeline (Seer ↔ bibliothèque).
//
// Multi-alias : chaque envoi enregistre TOUTES ses clés connues (tmdb ET titre
// normalisé). La résolution TMDB est souvent tardive côté Jellyfin — une même
// saison changeait de clé d'un poll à l'autre (titre → tmdb) et se faisait
// re-notifier ; ici l'alias titre posé à la première vague suffit à bloquer
// les suivantes. La vérification est synchrone à l'envoi : elle ne retarde
// JAMAIS une notification (pas d'attente de résolution TMDB).
//
// Format des clés :
//   m:t:<tmdbId>              film (tmdb)         m:n:<titreNorm>   film (titre)
//   s:t:<tmdbSérie>:<saison>  saison (tmdb)       s:n:<sérieNorm>:<saison>
//   s:t:<tmdbSérie>:all       série entière       s:n:<sérieNorm>:all
//   p:<type>:<hash>           unicité exacte d'un push (anti-flapping Seer)

const PURGE_AFTER_MS = 30 * 24 * 60 * 60_000; // 30 jours
const PURGE_INTERVAL_MS = 6 * 60 * 60_000;

const KEY_MAX = 191; // largeur de la colonne contentKey (index MariaDB utf8mb4)
const clamp = (k: string): string => (k.length > KEY_MAX ? k.slice(0, KEY_MAX) : k);

/** Clés multi-alias d'un item bibliothèque (tmdb + titre, posées ensemble). */
export function libraryContentKeys(it: LibItem): string[] {
  const keys: string[] = [];
  if (it.Type === "Movie") {
    if (it.tmdbId != null) keys.push(`m:t:${it.tmdbId}`);
    const name = normalizeTitle(it.Name ?? "");
    if (name) keys.push(`m:n:${name}`);
    return keys.map(clamp);
  }
  const season = it.Type === "Episode"
    ? (it.ParentIndexNumber ?? "?")
    : it.Type === "Season" ? (it.IndexNumber ?? "?") : "all";
  if (it.seriesTmdbId != null) keys.push(`s:t:${it.seriesTmdbId}:${season}`);
  const name = normalizeTitle(it.SeriesName ?? it.Name ?? "");
  if (name) keys.push(`s:n:${name}:${season}`);
  return keys.map(clamp);
}

/** FNV-1a 32 bits (hex) — zéro dépendance. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Clé d'unicité EXACTE d'un push (type + titre + corps) : étouffe les
 *  re-créations à l'identique (flapping de statut du plugin Seer). */
export function exactPushKey(n: { type: string; title: string; body: string | null }): string {
  return clamp(`p:${n.type}:${fnv1a(`${n.title}\n${n.body ?? ""}`)}`);
}

/** Claim tel que lu dans content_claims (identification, PAS suppression :
 *  on ne filtre pas sur expiresAt — un claim expiré identifie encore le tmdb). */
export interface RegistryClaim {
  tmdbId: number;
  title: string;
  mediaType: string; // movie | tv
}

/**
 * Clés de CONTENU d'une notification Seer de DISPONIBILITÉ — celles-là seules
 * portent le suffixe « sur Tentacle TV » (releasedSuffix du plugin). Le tmdb
 * est résolu génériquement en croisant le titre de la notif avec les
 * content_claims de l'utilisateur (aucun couplage aux tables du plugin) ;
 * les saisons sont parsées du corps (« Saison 2 est sortie… »). Retourne []
 * pour toute notif non-disponibilité (le garde exactPushKey reste actif).
 */
export function seerContentKeys(
  n: { title: string; body: string | null },
  userClaims: RegistryClaim[],
): string[] {
  const body = n.body ?? "";
  if (!body.includes("sur Tentacle TV")) return [];
  const normTitle = normalizeTitle(n.title);
  const claim = userClaims.find((c) => normalizeTitle(c.title) === normTitle);
  const keys: string[] = [];
  const seasonMatch = body.match(/^Saisons?\s+([\d\s,]+)/i);
  const seasons = seasonMatch
    ? seasonMatch[1].split(/[\s,]+/).map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x))
    : [];
  if (seasons.length > 0) {
    for (const s of seasons) {
      if (claim) keys.push(`s:t:${claim.tmdbId}:${s}`);
      if (normTitle) keys.push(`s:n:${normTitle}:${s}`);
    }
  } else if (claim?.mediaType === "tv") {
    // Dispo série sans détail saison (syncGlobal) → clé série entière.
    keys.push(`s:t:${claim.tmdbId}:all`);
    if (normTitle) keys.push(`s:n:${normTitle}:all`);
  } else {
    if (claim) keys.push(`m:t:${claim.tmdbId}`);
    if (normTitle) keys.push(`m:n:${normTitle}`);
  }
  return keys.map(clamp);
}

/** Clés d'UNE saison d'une annonce Seer (planificateur de push par saison) :
 *  mêmes formats s:t:/s:n: que ci-dessus, pour une saison donnée. tmdbId null
 *  (contenu non résolu) → clé titre seule. */
export function seerSeasonKeys(tmdbId: number | null, title: string, season: number): string[] {
  const keys: string[] = [];
  if (tmdbId != null) keys.push(`s:t:${tmdbId}:${season}`);
  const norm = normalizeTitle(title);
  if (norm) keys.push(`s:n:${norm}:${season}`);
  return keys.map(clamp);
}

/** true si AU MOINS une des clés est déjà enregistrée pour cet utilisateur. */
export async function isAnnounced(jellyfinUserId: string, keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false;
  const prisma = getPrisma();
  const hit = await prisma.announcedContent.findFirst({
    where: { jellyfinUserId, contentKey: { in: keys } },
    select: { contentKey: true },
  });
  return hit !== null;
}

/** Variante batch pour le notifier bibliothèque : un findMany pour N items.
 *  Retourne un booléen « déjà annoncé » par jeu de clés (même ordre). */
export async function filterAnnounced(
  jellyfinUserId: string,
  keySets: string[][],
): Promise<boolean[]> {
  const all = [...new Set(keySets.flat())];
  if (all.length === 0) return keySets.map(() => false);
  const prisma = getPrisma();
  const rows = await prisma.announcedContent.findMany({
    where: { jellyfinUserId, contentKey: { in: all } },
    select: { contentKey: true },
  });
  const known = new Set(rows.map((r) => r.contentKey));
  return keySets.map((keys) => keys.some((k) => known.has(k)));
}

/** Enregistre les clés d'un envoi effectif (createMany skipDuplicates). */
export async function recordAnnounced(jellyfinUserId: string, keys: string[]): Promise<void> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return;
  const prisma = getPrisma();
  await prisma.announcedContent.createMany({
    data: unique.map((contentKey) => ({ contentKey, jellyfinUserId })),
    skipDuplicates: true,
  });
}

let purgeTimer: ReturnType<typeof setInterval> | null = null;

/** Purge périodique (> 30 jours) — borne la table sans jamais ré-ouvrir la
 *  porte aux doublons réels (les vagues d'un même ajout se comptent en jours). */
export function startAnnouncedPurge(): void {
  if (purgeTimer) return;
  const purge = async (): Promise<void> => {
    if (!hasPrisma()) return;
    try {
      const cutoff = new Date(Date.now() - PURGE_AFTER_MS);
      const { count } = await getPrisma().announcedContent.deleteMany({
        where: { notifiedAt: { lt: cutoff } },
      });
      if (count > 0) console.log(`[Announced] purge: ${count} entrées > 30 j`);
    } catch (err) {
      console.error("[Announced] purge échouée:", err);
    }
  };
  purgeTimer = setInterval(() => void purge(), PURGE_INTERVAL_MS);
  setTimeout(() => void purge(), 30_000);
}

export function stopAnnouncedPurge(): void {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
}
