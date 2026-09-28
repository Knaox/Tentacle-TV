import { getPrisma } from "../db";
import type { SwipeVerdict } from "./swipeTypes";

/** Un titre « passé » revient dans la pile après ce délai : il n'a pas été
 *  jugé, seulement remis à plus tard. Un verdict, lui, est définitif. */
export const SKIP_COOLDOWN_DAYS = 30;

export interface SwipeRow {
  mediaType: string;
  tmdbId: number;
  verdict: string;
  updatedAt: Date;
}

export type SwipeCounts = Record<SwipeVerdict, number>;

/**
 * Les clés à ne plus présenter : tout verdict, et les « passé » récents.
 * Pure — l'appelant fournit les lignes et l'horloge.
 */
export function blockedKeys(rows: readonly SwipeRow[], now: number): Set<string> {
  const cooldown = SKIP_COOLDOWN_DAYS * 86_400_000;
  const out = new Set<string>();
  for (const r of rows) {
    if (r.verdict === "skip" && now - r.updatedAt.getTime() >= cooldown) continue;
    out.add(`${r.mediaType}:${r.tmdbId}`);
  }
  return out;
}

export function countVerdicts(rows: readonly SwipeRow[]): SwipeCounts {
  const counts: SwipeCounts = { like: 0, superlike: 0, dislike: 0, skip: 0 };
  for (const r of rows) {
    if (r.verdict in counts) counts[r.verdict as SwipeVerdict]++;
  }
  return counts;
}

export async function listSwipes(userId: string): Promise<SwipeRow[]> {
  return getPrisma().userSwipe.findMany({
    where: { jellyfinUserId: userId },
    select: { mediaType: true, tmdbId: true, verdict: true, updatedAt: true },
  });
}

/** Pose (ou remplace) le verdict d'un titre — le dernier geste gagne. */
export async function saveSwipe(
  userId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
  verdict: SwipeVerdict
): Promise<void> {
  await getPrisma().userSwipe.upsert({
    where: { jellyfinUserId_mediaType_tmdbId: { jellyfinUserId: userId, mediaType, tmdbId } },
    create: { jellyfinUserId: userId, mediaType, tmdbId, verdict },
    update: { verdict },
  });
}

/** Annule le verdict d'un titre (idempotent) : il redevient proposable. */
export async function deleteSwipe(userId: string, mediaType: "movie" | "tv", tmdbId: number): Promise<boolean> {
  const res = await getPrisma().userSwipe.deleteMany({
    where: { jellyfinUserId: userId, mediaType, tmdbId },
  });
  return res.count > 0;
}
