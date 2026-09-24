import { getPrisma } from "./db";
import { getAllLibraryItemsForIdentity, type LibItem } from "./jellyfinLibrary";
import { normalizeTitle } from "./libraryAddedDedup";

// Reconnaissance des CONTENUS, pas des fichiers. Jellyfin donne un nouvel ID à
// un fichier remplacé — mise à niveau Radarr/Sonarr, renommage, déplacement :
// pour le diff d'IDs, c'est un ajout comme un autre, et tous les abonnés
// recevaient « Dune est sorti » pour un film là depuis des mois. Ici, chaque
// item connu porte la clé de son contenu (film par TMDB, épisode par TMDB de
// sa série + numéros), et un départ garde sa ligne (removedAt) au lieu de
// l'effacer. Une arrivée dont le contenu est déjà là (autre version) ou vient
// de partir (moins de 24 h : un remplacement) n'est pas une nouveauté. Un
// contenu parti depuis plus longtemps qui revient — une demande refaite après
// suppression — en redevient une.
//
// Jamais le NOM d'une série : deux séries homonymes (l'animé « One Piece » et
// la série live, « The Office » US et UK) se confondraient, et le nouvel
// épisode de l'une passerait pour une version de l'autre. À défaut de TMDB,
// l'ID Jellyfin de la série, stable quand un fichier d'épisode est remplacé.

export const REPLACEMENT_GRACE_MS = 24 * 60 * 60_000;
const DEPARTED_RETENTION_MS = 30 * 24 * 60 * 60_000;
const DB_CHUNK = 1000;
const BACKFILL_CHUNK = 500;
const KEY_MAX = 191;

/**
 * Les clés possibles du contenu que porte un item, de la plus forte à la plus
 * faible. Film : son TMDB, puis son nom normalisé plus l'année (deux films
 * homonymes restent deux contenus). Épisode : TMDB de la série + saison +
 * épisode, puis ID Jellyfin de la série + saison + épisode. [] pour ce qui
 * n'est pas un contenu annoncé (série, saison) ou pas identifiable.
 */
export function presenceKeys(it: LibItem): string[] {
  const keys: string[] = [];
  if (it.Type === "Movie") {
    const name = normalizeTitle(it.Name ?? "");
    if (it.tmdbId != null) keys.push(`m:t:${it.tmdbId}`);
    if (name) keys.push(`m:n:${name}:${it.ProductionYear ?? ""}`);
  } else if (it.Type === "Episode" && it.ParentIndexNumber != null && it.IndexNumber != null) {
    const at = `${it.ParentIndexNumber}:${it.IndexNumber}`;
    if (it.seriesTmdbId != null) keys.push(`e:t:${it.seriesTmdbId}:${at}`);
    if (it.SeriesId) keys.push(`e:i:${it.SeriesId}:${at}`);
  }
  return keys.map((k) => (k.length > KEY_MAX ? k.slice(0, KEY_MAX) : k));
}

/** La clé qu'on enregistre : la plus forte connue ('' = aucune). */
export function presenceKey(it: LibItem): string {
  return presenceKeys(it)[0] ?? "";
}

export interface ArrivalVerdict {
  /** Vraies nouveautés : à annoncer. */
  news: LibItem[];
  /** Contenus déjà là, ou remplacés il y a moins de 24 h : silence. */
  known: LibItem[];
}

/**
 * Trie des arrivées PAS ENCORE enregistrées. Une arrivée est reconnue si
 * l'une de ses clés possibles est celle d'un item présent ou parti il y a
 * moins de 24 h — l'ancien fichier a pu être enregistré sous une clé plus
 * faible. Un item sans clé est une nouveauté : faute de pouvoir le
 * reconnaître, on ne l'étouffe pas.
 */
export async function classifyArrivals(items: LibItem[], now = Date.now()): Promise<ArrivalVerdict> {
  const keys = [...new Set(items.flatMap(presenceKeys))];
  if (keys.length === 0) return { news: items, known: [] };
  const rows = await getPrisma().libraryKnownId.findMany({
    where: { contentKey: { in: keys } },
    select: { contentKey: true, removedAt: true },
  });
  const graceStart = now - REPLACEMENT_GRACE_MS;
  const covered = new Set<string>();
  for (const r of rows) {
    if (r.contentKey && (r.removedAt === null || r.removedAt.getTime() >= graceStart)) covered.add(r.contentKey);
  }
  const verdict: ArrivalVerdict = { news: [], known: [] };
  for (const it of items) {
    (presenceKeys(it).some((k) => covered.has(k)) ? verdict.known : verdict.news).push(it);
  }
  return verdict;
}

/** Les IDs présents (lignes sans départ) : la base du diff. */
export async function loadPresentIds(): Promise<Set<string>> {
  const rows = await getPrisma().libraryKnownId.findMany({
    where: { removedAt: null },
    select: { itemId: true },
  });
  return new Set(rows.map((r) => r.itemId));
}

/**
 * Enregistre des arrivées. `contentKey` null = à reconnaître plus tard (la
 * ligne de base). Un ID qui revient (fichier remis au même chemin) retrouve
 * sa ligne : on efface son départ.
 */
export async function recordArrivals(entries: Array<{ itemId: string; contentKey: string | null }>): Promise<void> {
  const prisma = getPrisma();
  for (let i = 0; i < entries.length; i += DB_CHUNK) {
    const chunk = entries.slice(i, i + DB_CHUNK);
    await prisma.libraryKnownId.createMany({ data: chunk, skipDuplicates: true });
    await prisma.libraryKnownId.updateMany({
      where: { itemId: { in: chunk.map((e) => e.itemId) }, removedAt: { not: null } },
      data: { removedAt: null },
    });
  }
}

/** Enregistre des départs : la ligne reste, datée, le temps de reconnaître un remplacement. */
export async function recordDepartures(itemIds: string[], now = Date.now()): Promise<void> {
  const prisma = getPrisma();
  for (let i = 0; i < itemIds.length; i += DB_CHUNK) {
    await prisma.libraryKnownId.updateMany({
      where: { itemId: { in: itemIds.slice(i, i + DB_CHUNK) }, removedAt: null },
      data: { removedAt: new Date(now) },
    });
  }
}

/** Oublie les départs de plus de 30 jours. */
export async function purgeDepartures(now = Date.now()): Promise<number> {
  const { count } = await getPrisma().libraryKnownId.deleteMany({
    where: { removedAt: { lt: new Date(now - DEPARTED_RETENTION_MS) } },
  });
  return count;
}

/**
 * Reconnaît, une fois, les items présents enregistrés avant la reconnaissance
 * des contenus (clé NULL) : un balayage paginé de la bibliothèque, séries
 * comprises (le TMDB de chaque épisode vient de la sienne). Un item
 * absent du balayage garde sa clé NULL (il est parti ; le diff le datera).
 * Échec = retenté au prochain démarrage. Rend le nombre de lignes reconnues.
 */
export async function backfillPresenceKeys(): Promise<number> {
  const prisma = getPrisma();
  const pending = await prisma.libraryKnownId.findMany({
    where: { contentKey: null, removedAt: null },
    select: { itemId: true },
  });
  if (pending.length === 0) return 0;
  const all = await getAllLibraryItemsForIdentity();
  if (!all) return 0;

  // Le TMDB de la série de chaque épisode, pris aux séries du même balayage.
  const seriesTmdb = new Map<string, number>();
  for (const it of all) if (it.Type === "Series" && it.tmdbId != null) seriesTmdb.set(it.Id, it.tmdbId);
  for (const it of all) if (it.Type === "Episode" && it.SeriesId) it.seriesTmdbId = seriesTmdb.get(it.SeriesId);
  const keyById = new Map(all.map((it) => [it.Id, presenceKey(it)] as const));

  const pairs = pending
    .filter((r) => keyById.has(r.itemId))
    .map((r) => [r.itemId, keyById.get(r.itemId) as string] as const);
  for (let i = 0; i < pairs.length; i += BACKFILL_CHUNK) {
    const chunk = pairs.slice(i, i + BACKFILL_CHUNK);
    const cases = chunk.map(() => "WHEN ? THEN ?").join(" ");
    const marks = chunk.map(() => "?").join(",");
    await prisma.$executeRawUnsafe(
      `UPDATE library_known_id SET contentKey = CASE itemId ${cases} END WHERE itemId IN (${marks})`,
      ...chunk.flatMap(([id, key]) => [id, key]),
      ...chunk.map(([id]) => id),
    );
  }
  return pairs.length;
}
