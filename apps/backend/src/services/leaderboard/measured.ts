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

export interface MesureUtilisateur {
  secondes: number;
  derniere: Date | null;
}

export interface Mesures {
  /** Instant du premier segment mesuré. `null` si rien n'a encore été mesuré. */
  epoque: Date | null;
  parUtilisateur: Map<string, MesureUtilisateur>;
}

export async function mesuresVisionnage(): Promise<Mesures | null> {
  if (!hasPrisma()) return null;
  const prisma = getPrisma();

  try {
    const where = { itemType: { in: TYPES } };
    const [parUtilisateur, borne] = await Promise.all([
      prisma.watchSegment.groupBy({
        by: ["jellyfinUserId"],
        where,
        _sum: { seconds: true },
        _max: { lastSeenAt: true },
      }),
      prisma.watchSegment.aggregate({ where, _min: { startedAt: true } }),
    ]);

    const epoque = borne._min.startedAt ?? null;
    if (!epoque) return { epoque: null, parUtilisateur: new Map() };

    const carte = new Map<string, MesureUtilisateur>();
    for (const u of parUtilisateur) {
      carte.set(u.jellyfinUserId, {
        secondes: u._sum.seconds ?? 0,
        derniere: u._max.lastSeenAt ?? null,
      });
    }
    return { epoque, parUtilisateur: carte };
  } catch {
    // Base indisponible : pas de mesure, donc pas de découpage — l'estimation
    // couvrira tout l'historique, exactement comme avant. Pas de mesure, pas de
    // coupure.
    return null;
  }
}
