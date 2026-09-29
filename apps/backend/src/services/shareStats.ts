import { z } from "zod";
import { getPrisma } from "./db";
import { getViewingStats } from "./viewingStats";
import type { ViewingStatsPeriod } from "./viewingStats/contract";
import type { PublicViewingStats } from "./viewingStats/contractShare";
import { resolveTimeZone } from "./viewingStats/localCalendar";
import type { StatsLang } from "./viewingStats/present";
import { toPublicStats } from "./viewingStats/publicProjection";

/**
 * Le partage des statistiques : un lien par compte (`share_links`, kind
 * « stats »), qui garde dans `options` la période choisie par le propriétaire
 * et son fuseau — les jours et les heures sont les siens, pas ceux du
 * visiteur. Le fuseau ne sort jamais du serveur.
 *
 * Même doctrine Live que les listes : rien n'est figé, la page relit les
 * statistiques du propriétaire (et leur cache de dix minutes) à chaque
 * ouverture ; révoquer, c'est supprimer la ligne.
 */

export interface StatsShareOptions {
  period: ViewingStatsPeriod;
  timeZone: string;
}

const STORED = z.object({
  period: z.enum(["30d", "year", "all"]).catch("all"),
  tz: z.string().max(64).catch("UTC"),
});

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Les réglages d'un lien, tels que les lit la base (JSON) ; illisibles : tout, en UTC. */
export function readStatsShareOptions(raw: string | null | undefined): StatsShareOptions {
  const parsed = STORED.safeParse(parseJson(raw));
  const value = parsed.success ? parsed.data : { period: "all" as const, tz: "UTC" };
  return { period: value.period, timeZone: resolveTimeZone(value.tz) };
}

export function writeStatsShareOptions(options: StatsShareOptions): string {
  return JSON.stringify({ period: options.period, tz: options.timeZone });
}

/**
 * La colonne `options` manque : la base n'a pas encore reçu core-init.sql
 * (P2022, colonne inconnue). Le partage des statistiques le dit par un 503 ;
 * les listes, qui ne la lisent jamais, continuent de marcher.
 */
export function isMissingOptionsColumn(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === "P2022";
}

/** Les réglages du lien d'un jeton — null s'il n'existe plus (révoqué entre-temps). */
export async function statsShareOptionsOf(token: string): Promise<StatsShareOptions | null> {
  const link = await getPrisma().shareLink.findUnique({ where: { token }, select: { options: true } });
  return link ? readStatsShareOptions(link.options) : null;
}

/**
 * Les statistiques publiques d'un lien : celles du propriétaire, sur SA
 * période et dans SON fuseau, passées à la liste blanche. Jamais de
 * recalcul forcé depuis ici : un visiteur ne relance pas le calcul (le cache
 * du propriétaire sert, dix minutes).
 */
export async function getSharedStats(ownerUserId: string, options: StatsShareOptions, lang: StatsLang): Promise<PublicViewingStats> {
  const stats = await getViewingStats(ownerUserId, { period: options.period, timeZone: options.timeZone, lang, refresh: false });
  return toPublicStats(stats);
}
