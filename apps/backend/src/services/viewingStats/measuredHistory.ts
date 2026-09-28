import { getPrisma, hasPrisma } from "../db";
import type { MeasuredEntry } from "./dataset";

/** Les statistiques ne comptent que ce qui se regarde, comme le classement. */
const TYPES = ["Movie", "Episode"];
const EPOCH_TTL_MS = 10 * 60_000;

let epochCache: { value: number | null; at: number } | null = null;

/**
 * L'instant du tout premier segment mesuré, TOUS comptes confondus : la
 * frontière entre l'estimé et le mesuré, la même que celle du classement. Il
 * ne bouge qu'une fois dans la vie d'un serveur, d'où dix minutes de cache.
 */
export async function measuredEpoch(): Promise<number | null> {
  if (epochCache && Date.now() - epochCache.at < EPOCH_TTL_MS) return epochCache.value;
  if (!hasPrisma()) return null;
  const bounds = await getPrisma().watchSegment.aggregate({
    where: { itemType: { in: TYPES } },
    _min: { startedAt: true },
  });
  const value = bounds._min.startedAt?.getTime() ?? null;
  epochCache = { value, at: Date.now() };
  return value;
}

export interface MeasuredHistory {
  entries: MeasuredEntry[];
  /** Films mesurés → leur nom, pour ceux qui ne sont pas marqués « vus ». */
  movieNames: Map<string, string>;
  /** Séries mesurées → leur nom. */
  seriesNames: Map<string, string>;
}

/**
 * Les séances d'un compte, colonnes réduites au strict nécessaire. Une ligne
 * par lecture continue d'un titre : quelques milliers au plus, pour des
 * années de visionnage.
 */
export async function fetchMeasured(userId: string): Promise<MeasuredHistory> {
  const movieNames = new Map<string, string>();
  const seriesNames = new Map<string, string>();
  if (!hasPrisma()) return { entries: [], movieNames, seriesNames };

  const rows = await getPrisma().watchSegment.findMany({
    where: { jellyfinUserId: userId, itemType: { in: TYPES }, seconds: { gt: 0 } },
    select: {
      itemId: true, itemType: true, itemName: true, seriesId: true, seriesName: true,
      clientName: true, seconds: true, runtimeSeconds: true, audioLang: true, startedAt: true, lastSeenAt: true,
    },
    orderBy: { startedAt: "asc" },
  });

  const entries: MeasuredEntry[] = [];
  for (const r of rows) {
    const episode = r.itemType === "Episode";
    if (episode && !r.seriesId) continue;
    const titleId = episode ? r.seriesId! : r.itemId;
    if (episode) seriesNames.set(titleId, r.seriesName ?? "");
    else movieNames.set(titleId, r.itemName);
    entries.push({
      titleId,
      itemId: r.itemId,
      kind: episode ? "episode" : "movie",
      client: r.clientName,
      seconds: r.seconds,
      runtimeSeconds: r.runtimeSeconds,
      audioLang: r.audioLang,
      startedAt: r.startedAt.getTime(),
      lastSeenAt: Math.max(r.lastSeenAt.getTime(), r.startedAt.getTime()),
    });
  }
  return { entries, movieNames, seriesNames };
}
