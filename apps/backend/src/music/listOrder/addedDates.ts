/**
 * Octave — les dates d'entrée d'une liste, gardées dans `music_list_added`
 * (règle : `addedPlan.ts`). `liked:<userId>` ou `playlist2:<playlistId>`.
 *
 * `playlist:<id>` (avant le 27/10) datait « maintenant » chaque arrivée posée
 * par l'extension à la place de son attente : ces dates ne se distinguent
 * plus d'un vrai ajout. La portée `playlist2:` repart donc d'une estimation
 * (l'ordre de la playlist, celui des ajouts) et efface l'ancienne à sa
 * première lecture.
 */

import { getPrisma } from "../../services/db";
import { listAlias } from "../contract/musicListOrder";
import { rowsByIds } from "../index/indexQueries";
import { planAddedDates, type AddedPlanOptions } from "./addedPlan";
import { planArrivalDates } from "./arrivalPlan";

export function likedScope(userId: string): string {
  return `liked:${userId.replace(/-/g, "").toLowerCase()}`;
}

export function playlistScope(playlistId: string): string {
  return `playlist2:${playlistId.replace(/-/g, "").toLowerCase()}`;
}

/** La portée d'avant le 27/10, effacée à la première lecture de la nouvelle. */
export function legacyPlaylistScope(playlistId: string): string {
  return `playlist:${playlistId.replace(/-/g, "").toLowerCase()}`;
}

export interface AddedDatesOptions extends AddedPlanOptions {
  /** Une portée d'avant, à effacer quand celle-ci est lue pour la première fois. */
  legacyScope?: string;
}

/** Les dates d'entrée des titres de `ids` (relevées, estimées à la première lecture), la table tenue à jour. */
export async function addedDatesFor(
  scope: string,
  ids: readonly string[],
  estimate: (itemId: string, index: number) => number | null = () => null,
  options: AddedDatesOptions = {},
): Promise<Map<string, number>> {
  const prisma = getPrisma();
  const rows = await prisma.musicListAdded.findMany({ where: { scope }, select: { itemId: true, addedAt: true } });
  const known = new Map(rows.map((r) => [r.itemId, r.addedAt.getTime()]));
  const plan = planAddedDates(known, ids, Date.now(), estimate, options);
  const legacy = rows.length === 0 && plan.insert.length > 0 ? options.legacyScope : undefined;
  if (plan.insert.length > 0 || plan.remove.length > 0) {
    try {
      await prisma.$transaction([
        ...(legacy ? [prisma.musicListAdded.deleteMany({ where: { scope: legacy } })] : []),
        ...(plan.remove.length > 0 ? [prisma.musicListAdded.deleteMany({ where: { scope, itemId: { in: plan.remove } } })] : []),
        ...plan.insert.map((r) =>
          prisma.musicListAdded.upsert({
            where: { scope_itemId: { scope, itemId: r.itemId } },
            create: { scope, itemId: r.itemId, addedAt: new Date(r.addedAt) },
            // Une date du rang dans la source fait foi ; toute autre ne remplace jamais une date déjà gardée.
            update: r.replace ? { addedAt: new Date(r.addedAt) } : {},
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

/** Toutes les dates d'une liste oubliées : la prochaine lecture repart de son ordre (la réparation d'une playlist). */
export async function forgetAddedDates(scope: string): Promise<void> {
  await getPrisma().musicListAdded.deleteMany({ where: { scope } });
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

/**
 * Des éléments que l'EXTENSION vient de poser dans une playlist (une arrivée, un fichier remplacé) : datés tout de
 * suite par leur place ou par l'élément qu'ils remplacent (`arrivalPlan.ts`), jamais « maintenant ».
 */
export async function noteArrival(playlistId: string, before: readonly string[], inserted: readonly string[], at: number): Promise<void> {
  const scope = playlistScope(playlistId);
  try {
    const prisma = getPrisma();
    const rows = await prisma.musicListAdded.findMany({ where: { scope }, select: { itemId: true, addedAt: true } });
    if (rows.length === 0) return;
    const known = new Map(rows.map((r) => [r.itemId, r.addedAt.getTime()]));
    const index = await rowsByIds([...new Set([...before, ...inserted])]);
    const identity = (id: string): string | null => {
      const row = index.get(id);
      return row ? listAlias(row.recordingMbid, row.name, row.artists[0]?.name ?? row.albumArtist ?? "") : null;
    };
    const dates = planArrivalDates({ known, before, inserted, at, identity });
    if (dates.size === 0) return;
    await prisma.$transaction(
      [...dates].map(([itemId, addedAt]) =>
        prisma.musicListAdded.upsert({ where: { scope_itemId: { scope, itemId } }, create: { scope, itemId, addedAt: new Date(addedAt) }, update: {} }),
      ),
    );
  } catch (error) {
    console.warn("[music] date d'une arrivée non gardée :", (error as Error).message);
  }
}
