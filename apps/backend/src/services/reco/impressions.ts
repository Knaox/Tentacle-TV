import { getPrisma } from "../db";

/**
 * La MÉMOIRE DE L'AFFICHÉ : les titres que les rangées personnelles ont servis
 * à un compte, comptés une fois par jour (table reco_impressions). Un titre
 * montré jour après jour sans que le compte y touche — le lire, le noter,
 * l'aimer, le mettre de côté le sortent des rangées — se lasse : il recule au
 * tirage du jour (rowDraw), de plus en plus, puis revient à mesure que les
 * jours passent sans lui (~30 jours). Aucun client n'en sait rien.
 *
 * Écriture : le service de page NOTE les titres servis (en mémoire, une fois
 * par compte, titre et jour) ; une écriture groupée part au plus une minute
 * plus tard, hors de la requête.
 */

/** Jours sans affichage après lesquels un titre est tout à fait reposé. */
export const IMPRESSION_RECOVERY_DAYS = 30;
/** Lignes gardées : au-delà de 60 jours sans affichage, elles ne disent plus rien. */
export const IMPRESSION_RETENTION_DAYS = 60;
/** Recul par jour montré au-delà du premier : ×0,82 à deux jours, ×0,30 à sept. */
const FATIGUE_PER_DAY = 0.2;
/** Délai de l'écriture groupée. */
const FLUSH_DELAY_MS = 60_000;
/** Lignes par instruction : 5 paramètres chacune, sous la borne de 999 de SQLite. */
const UPSERT_CHUNK = 150;

/** Les rangées tirées du pool du compte : les seules dont l'affiché compte. */
const PERSONAL_ROWS = new Set(["forYou", "forYouMovies", "inLibrary", "discover", "anime", "exploration"]);
const PERSONAL_ROW_PREFIXES = ["becauseYouLiked:", "withActor:", "person:"];

export function isPersonalRow(rowKey: string): boolean {
  return PERSONAL_ROWS.has(rowKey) || PERSONAL_ROW_PREFIXES.some((p) => rowKey.startsWith(p));
}

/** Jour UTC « AAAA-MM-JJ » → jours depuis le 1er janvier 1970. */
export function epochDay(dayStamp: string): number {
  return Math.floor(Date.parse(`${dayStamp}T00:00:00Z`) / 86_400_000);
}

export interface ImpressionRow {
  itemKey: string;
  firstDay: number;
  lastDay: number;
  daysShown: number;
}

/**
 * Pur : la lassitude d'un titre (1 = intact) le jour `today`. Le jour même ne
 * compte pas encore — une page reconstruite dans la journée tire comme celle
 * du matin. Les jours montrés s'effacent à mesure que le titre se repose, et
 * tout à fait après IMPRESSION_RECOVERY_DAYS.
 */
export function impressionFatigue(row: Omit<ImpressionRow, "itemKey">, today: number): number {
  const shownBefore = row.daysShown - (row.lastDay >= today ? 1 : 0);
  const idle = Math.max(0, today - row.lastDay);
  const rest = Math.max(0, 1 - idle / IMPRESSION_RECOVERY_DAYS);
  const effective = shownBefore * rest;
  return Math.exp(-FATIGUE_PER_DAY * Math.max(0, effective - 1));
}

/** La lassitude des titres du compte (seuls ceux qui en ont une). Une lecture, à la construction de la page. */
export async function readFatigue(userId: string, today: number): Promise<Map<string, number>> {
  const rows = await getPrisma().recoImpression.findMany({
    where: { jellyfinUserId: userId, lastDay: { gt: today - IMPRESSION_RECOVERY_DAYS } },
    select: { itemKey: true, firstDay: true, lastDay: true, daysShown: true },
  });
  const out = new Map<string, number>();
  for (const row of rows) {
    const fatigue = impressionFatigue(row, today);
    if (fatigue < 1) out.set(row.itemKey, fatigue);
  }
  return out;
}

interface PendingDay {
  day: number;
  /** Clé de titre → rangée qui l'a servi ; ce qui attend l'écriture. */
  pending: Map<string, string>;
  /** Déjà noté ce jour (écrit ou en attente) : une requête qui sonde ne réécrit rien. */
  noted: Set<string>;
}

const queue = new Map<string, PendingDay>();
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Note les titres des rangées personnelles servies au compte. Mémoire seule :
 * une fois par compte, titre et jour ; l'écriture part plus tard (flushImpressions).
 */
export function noteServedRows(
  userId: string,
  dayStamp: string,
  rows: ReadonlyArray<{ key: string; items: ReadonlyArray<{ key: string }> }>
): void {
  const day = epochDay(dayStamp);
  let entry = queue.get(userId);
  if (!entry || entry.day !== day) {
    entry = { day, pending: new Map(), noted: new Set() };
    queue.set(userId, entry);
  }
  for (const row of rows) {
    if (!isPersonalRow(row.key)) continue;
    for (const item of row.items) {
      if (entry.noted.has(item.key)) continue;
      entry.noted.add(item.key);
      entry.pending.set(item.key, row.key);
    }
  }
  if (entry.pending.size > 0 && !flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushImpressions().catch((err) => console.error("[Reco] Écriture de l'affiché en échec :", err));
    }, FLUSH_DELAY_MS);
    flushTimer.unref?.();
  }
}

/**
 * L'upsert d'un lot : un jour de plus si le titre n'a pas encore été compté
 * aujourd'hui ; remis à un s'il s'était reposé tout le délai.
 */
export function upsertSql(rows: number): string {
  const values = Array.from({ length: rows }, () => "(?, ?, ?, ?, ?, 1)").join(", ");
  const recovered = `excluded."lastDay" - "reco_impressions"."lastDay" >= ${IMPRESSION_RECOVERY_DAYS}`;
  return (
    `INSERT INTO "reco_impressions" ("jellyfinUserId", "itemKey", "rowKey", "firstDay", "lastDay", "daysShown") VALUES ${values} ` +
    `ON CONFLICT("jellyfinUserId", "itemKey") DO UPDATE SET ` +
    `"daysShown" = CASE WHEN "reco_impressions"."lastDay" >= excluded."lastDay" THEN "reco_impressions"."daysShown" ` +
    `WHEN ${recovered} THEN 1 ELSE "reco_impressions"."daysShown" + 1 END, ` +
    `"firstDay" = CASE WHEN ${recovered} THEN excluded."firstDay" ELSE "reco_impressions"."firstDay" END, ` +
    `"lastDay" = MAX("reco_impressions"."lastDay", excluded."lastDay"), "rowKey" = excluded."rowKey"`
  );
}

/** Écrit ce qui attend, par lots ; une erreur perd le lot (aucune boucle de réessai : ce n'est qu'un affiché). */
export async function flushImpressions(): Promise<number> {
  const prisma = getPrisma();
  let written = 0;
  for (const [userId, entry] of queue) {
    const batch = [...entry.pending.entries()];
    entry.pending.clear();
    for (let i = 0; i < batch.length; i += UPSERT_CHUNK) {
      const chunk = batch.slice(i, i + UPSERT_CHUNK);
      const params = chunk.flatMap(([itemKey, rowKey]) => [userId, itemKey, rowKey, entry.day, entry.day]);
      await prisma.$executeRawUnsafe(upsertSql(chunk.length), ...params);
      written += chunk.length;
    }
  }
  // Les jours passés n'ont plus rien à dédoublonner.
  const today = Math.max(0, ...[...queue.values()].map((e) => e.day));
  for (const [userId, entry] of queue) if (entry.day < today && entry.pending.size === 0) queue.delete(userId);
  return written;
}

/** Purge des lignes reposées depuis IMPRESSION_RETENTION_DAYS : la table reste bornée. */
export async function purgeOldImpressions(today: number): Promise<number> {
  const res = await getPrisma().recoImpression.deleteMany({ where: { lastDay: { lt: today - IMPRESSION_RETENTION_DAYS } } });
  return res.count;
}

/** Tests : vide la file en mémoire. */
export function resetImpressionQueue(): void {
  queue.clear();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}
