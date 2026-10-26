/**
 * Octave — les dates d'entrée d'une liste, gardées dans `music_list_added`
 * (règle : `addedPlan.ts`). `liked:<userId>` ou `playlist:<playlistId>`.
 */

import { getPrisma } from "../../services/db";
import { planAddedDates } from "./addedPlan";

export function likedScope(userId: string): string {
  return `liked:${userId.replace(/-/g, "").toLowerCase()}`;
}

export function playlistScope(playlistId: string): string {
  return `playlist:${playlistId.replace(/-/g, "").toLowerCase()}`;
}

/** Les dates d'entrée des titres de `ids` (relevées, estimées à la première lecture), la table tenue à jour. */
export async function addedDatesFor(
  scope: string,
  ids: readonly string[],
  estimate: (itemId: string, index: number) => number | null = () => null,
): Promise<Map<string, number>> {
  const prisma = getPrisma();
  const rows = await prisma.musicListAdded.findMany({ where: { scope }, select: { itemId: true, addedAt: true } });
  const known = new Map(rows.map((r) => [r.itemId, r.addedAt.getTime()]));
  const plan = planAddedDates(known, ids, Date.now(), estimate);
  if (plan.insert.length > 0 || plan.remove.length > 0) {
    try {
      await prisma.$transaction([
        ...(plan.remove.length > 0 ? [prisma.musicListAdded.deleteMany({ where: { scope, itemId: { in: plan.remove } } })] : []),
        ...plan.insert.map((r) =>
          prisma.musicListAdded.upsert({
            where: { scope_itemId: { scope, itemId: r.itemId } },
            create: { scope, itemId: r.itemId, addedAt: new Date(r.addedAt) },
            update: {},
          }),
        ),
      ]);
    } catch (error) {
      // Une écriture concurrente (deux lectures à la fois) : la date relevée reste juste pour cette réponse.
      console.warn("[music] dates d'entrée non gardées :", (error as Error).message);
    }
  }
  return plan.dates;
}

/** Un like posé par Octave : daté tout de suite (exact, sans attendre la prochaine lecture). */
export async function noteLiked(userId: string, itemId: string, favorite: boolean): Promise<void> {
  const scope = likedScope(userId);
  const id = itemId.replace(/-/g, "").toLowerCase();
  const prisma = getPrisma();
  try {
    if (!favorite) await prisma.musicListAdded.deleteMany({ where: { scope, itemId: id } });
    // Une liste jamais lue n'est pas datée ici : sa première lecture l'estime en entier.
    else if ((await prisma.musicListAdded.count({ where: { scope } })) > 0)
      await prisma.musicListAdded.upsert({ where: { scope_itemId: { scope, itemId: id } }, create: { scope, itemId: id, addedAt: new Date() }, update: {} });
  } catch (error) {
    console.warn("[music] date du like non gardée :", (error as Error).message);
  }
}
