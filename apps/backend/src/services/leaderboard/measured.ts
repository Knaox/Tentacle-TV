import { getPrisma, hasPrisma } from "../db";

/**
 * Ce que Tentacle a RÉELLEMENT mesuré, lu dans `watch_segments`.
 *
 * Deux chiffres indissociables sortent d'ici :
 *  • les totaux par utilisateur ;
 *  • l'ÉPOQUE, c'est-à-dire l'instant du tout premier segment mesuré.
 *
 * Ils doivent venir du même appel réussi, sans exception. L'époque sert à
 * découper l'estimation historique ; si elle se résolvait alors que les totaux
 * échouent, on couperait l'historique sans le remplacer et tous les classements
 * s'effondreraient. D'où un seul `try`, un seul `null`.
 */

/** Le classement ne compte que ce qui se regarde, pas la musique de fond. */
const TYPES = ["Movie", "Episode"];

export interface UserMeasure {
  seconds: number;
  latest: Date | null;
}

export interface Measures {
  /** Instant du premier segment mesuré. `null` si rien n'a encore été mesuré. */
  epoch: Date | null;
  perUser: Map<string, UserMeasure>;
}

export async function watchMeasures(): Promise<Measures | null> {
  if (!hasPrisma()) return null;
  const prisma = getPrisma();

  try {
    const where = { itemType: { in: TYPES } };
    const [perUser, bounds] = await Promise.all([
      prisma.watchSegment.groupBy({
        by: ["jellyfinUserId"],
        where,
        _sum: { seconds: true },
        _max: { lastSeenAt: true },
      }),
      prisma.watchSegment.aggregate({ where, _min: { startedAt: true } }),
    ]);

    const epoch = bounds._min.startedAt ?? null;
    if (!epoch) return { epoch: null, perUser: new Map() };

    const map = new Map<string, UserMeasure>();
    for (const u of perUser) {
      map.set(u.jellyfinUserId, {
        seconds: u._sum.seconds ?? 0,
        latest: u._max.lastSeenAt ?? null,
      });
    }
    return { epoch, perUser: map };
  } catch {
    // Base indisponible : pas de mesure, donc pas de découpage — l'estimation
    // couvrira tout l'historique, exactement comme avant. Pas de mesure, pas de
    // coupure.
    return null;
  }
}
