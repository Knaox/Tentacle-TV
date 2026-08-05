import { getPrisma, hasPrisma } from "../db";
import type { EtatSession } from "./types";

/**
 * Persistance des segments de visionnage.
 *
 * Règle qui gouverne tout ce fichier : l'écriture est **absolue**, jamais
 * incrémentale. On écrit `seconds = <total accumulé en mémoire>` et jamais
 * `seconds += delta`. C'est ce qui rend chaque écriture idempotente : un flush
 * raté, une base momentanément absente, un doublon de relevé — le suivant
 * réécrit le bon total, sans rattrapage ni compensation.
 *
 * Corollaire : `updateMany` et non `update`. Le second lève si la ligne a
 * disparu (purge manuelle, base réinitialisée) ; le premier renvoie zéro et
 * passe son chemin.
 */

/** Un segment ouvert plus vieux que ça ne sera pas réadopté au démarrage. */
const REPRISE_MS = 15 * 60_000;

/** Un segment sans nouvelle depuis ce délai est clos par le balayage. */
const ORPHELIN_MS = 10 * 60_000;

/**
 * Donne une ligne en base à un segment qui n'en a pas encore : soit en
 * réadoptant celle qu'un précédent processus avait laissée ouverte, soit en la
 * créant.
 *
 * La réadoption est ce qui fait qu'un film interrompu par un redémarrage du
 * backend reste UNE ligne. Elle reprend aussi le total déjà écrit — sans quoi
 * l'écriture absolue, repartie de zéro en mémoire, effacerait le temps déjà
 * mesuré.
 */
export async function adopterOuCreer(s: EtatSession): Promise<void> {
  if (s.segmentId || !hasPrisma()) return;
  const prisma = getPrisma();
  const e = s.echantillon;

  try {
    const ouvert = await prisma.watchSegment.findFirst({
      where: {
        sessionKey: s.sessionKey,
        itemId: s.itemId,
        closedAt: null,
        lastSeenAt: { gte: new Date(Date.now() - REPRISE_MS) },
      },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, seconds: true, startedAt: true },
    });

    if (ouvert) {
      s.segmentId = ouvert.id;
      s.secondes += ouvert.seconds;
      s.debutMs = ouvert.startedAt.getTime();
      return;
    }

    const cree = await prisma.watchSegment.create({
      data: {
        jellyfinUserId: s.userId,
        sessionKey: s.sessionKey,
        itemId: s.itemId,
        itemType: e.itemType,
        itemName: e.itemName,
        seriesId: e.seriesId,
        seriesName: e.seriesName,
        clientName: e.clientName,
        deviceName: e.deviceName,
        runtimeSeconds: e.runtimeSeconds,
        seconds: 0,
        startedAt: new Date(s.debutMs),
        lastSeenAt: new Date(s.horlogeMs),
      },
      select: { id: true },
    });
    s.segmentId = cree.id;
  } catch {
    // La ligne sera retentée au relevé suivant ; le total vit en mémoire, rien
    // n'est perdu tant que le processus tourne.
  }
}

/** Écrit les totaux. Absolu, donc rejouable sans dommage. */
export async function ecrireSegments(segments: EtatSession[]): Promise<void> {
  if (!hasPrisma() || segments.length === 0) return;
  const prisma = getPrisma();

  for (const s of segments) {
    if (!s.segmentId) continue;
    try {
      await prisma.watchSegment.updateMany({
        where: { id: s.segmentId },
        data: { seconds: Math.round(s.secondes), lastSeenAt: new Date(s.horlogeMs) },
      });
    } catch {
      // Ignoré volontairement : le relevé suivant réécrira le même total.
    }
  }
}

/**
 * Clôt des segments. `closedAt` prend l'instant de la DERNIÈRE observation, pas
 * l'instant présent : dater la clôture de maintenant allongerait la lecture de
 * tout le temps écoulé depuis que le client s'est tu.
 */
export async function fermerSegments(segments: EtatSession[]): Promise<void> {
  if (!hasPrisma() || segments.length === 0) return;
  const prisma = getPrisma();

  for (const s of segments) {
    if (!s.segmentId) continue;
    try {
      await prisma.watchSegment.updateMany({
        where: { id: s.segmentId },
        data: {
          seconds: Math.round(s.secondes),
          lastSeenAt: new Date(s.horlogeMs),
          closedAt: new Date(s.horlogeMs),
        },
      });
    } catch {
      // Le balayage rattrapera.
    }
  }
}

/**
 * Ferme les segments qu'aucun processus ne suit plus — typiquement laissés
 * ouverts par un backend tué net. À ne lancer qu'APRÈS la fenêtre de reprise,
 * sinon on fermerait ce que le premier relevé allait réadopter.
 */
export async function balayerOrphelins(): Promise<number> {
  if (!hasPrisma()) return 0;
  try {
    const limite = new Date(Date.now() - ORPHELIN_MS);
    // SQL brut parce que `closedAt` doit recopier `lastSeenAt`, colonne à
    // colonne : Prisma ne sait pas exprimer cette référence dans un
    // `updateMany`, et dater la clôture d'une constante ajouterait du temps qui
    // n'a pas été regardé.
    return await getPrisma().$executeRaw`
      UPDATE watch_segments
         SET closedAt = lastSeenAt
       WHERE closedAt IS NULL
         AND lastSeenAt < ${limite}
    `;
  } catch {
    return 0;
  }
}
