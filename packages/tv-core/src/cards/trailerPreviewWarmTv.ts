import { TRAILER_PREVIEW_WARM_MAX_SUBJECTS, trailerPreviewSubjectKey, type TrailerPreviewSubject } from "@tentacle-tv/shared";

/**
 * La PRÉPARATION des aperçus sur les téléviseurs (Apple TV, Android TV) — le
 * pendant, au focus, de celle du bureau (`apps/web/src/trailerPreview/
 * previewWarm.ts`) : le serveur prépare d'avance l'aperçu des cartes AUTOUR
 * du focus (`POST /api/trailers/preview/warm`, capacité
 * `trailers.previewWarm`) et rend aussitôt ceux qui sont prêts — rangés dans
 * le cache des aperçus, leur focus n'a plus rien à demander : la vidéo part à
 * l'intention, hors bibliothèque compris.
 *
 * Pas d'écran à observer : la rangée dit sa FENÊTRE (`trailerPreviewWarmWindow`
 * : la carte focalisée, celle d'avant, et ce que la rangée montre après elle)
 * à chaque pas du focus. La file attend que le focus se pose (`settleMs` :
 * une rangée parcourue en tenant la flèche ne demande rien), envoie les
 * titres par lots de 40 au plus — les derniers demandés d'abord —, deux fois
 * au plus par titre en dix minutes (la seconde `followUpMs` plus tard, pour
 * recevoir ce que le serveur a préparé entre-temps), jamais un titre dont
 * l'aperçu est déjà en cache. Un envoi en échec suspend tout `backoffMs`.
 *
 * Module pur : horloge injectée, la minuterie et l'envoi sont à l'intégration.
 */

export const TV_PREVIEW_WARM_TIMING = {
  /** Le focus se pose : ce temps sans nouvelle fenêtre, puis l'envoi. */
  settleMs: 300,
  /** Un second envoi d'un titre pas encore prêt, au plus tôt ce temps après le premier. */
  followUpMs: 5_000,
  /** Deux envois par titre au plus dans cette fenêtre. */
  windowMs: 10 * 60_000,
  /** Un envoi refusé ou en panne : plus rien avant ce délai. */
  backoffMs: 10_000,
} as const;

/** Combien de cartes APRÈS la carte focalisée la fenêtre couvre — ce qu'une rangée montre. */
export const TV_PREVIEW_WARM_AHEAD = 5;

/** La fenêtre de préparation d'une rangée autour de sa carte focalisée : `[début, fin[`. */
export function trailerPreviewWarmWindow(index: number, count: number, ahead = TV_PREVIEW_WARM_AHEAD): [number, number] {
  const start = Math.max(0, Math.min(index - 1, count));
  return [start, Math.max(start, Math.min(count, index + 1 + ahead))];
}

export interface PreviewWarmQueue {
  /** La fenêtre du focus : ses titres passent devant ceux d'avant. */
  want(subjects: readonly TrailerPreviewSubject[], now: number): void;
  /** Le moment où envoyer, ou `null` : rien à envoyer. */
  dueAt(now: number): number | null;
  /** Le lot à envoyer maintenant (marqués envoyés) — `isReady` : déjà en cache, rien à demander. */
  take(now: number, isReady: (subject: TrailerPreviewSubject) => boolean): TrailerPreviewSubject[];
  /** L'envoi a échoué : plus rien pendant `backoffMs`. */
  failed(now: number): void;
}

interface Sent {
  count: number;
  at: number;
}

export function createPreviewWarmQueue(timing: typeof TV_PREVIEW_WARM_TIMING = TV_PREVIEW_WARM_TIMING): PreviewWarmQueue {
  /** Les titres en attente, du plus ancien au plus récent demandé. */
  const pending = new Map<string, TrailerPreviewSubject>();
  const sent = new Map<string, Sent>();
  let lastWant = 0;
  let pausedUntil = 0;

  function sendable(key: string, now: number): boolean {
    const record = sent.get(key);
    if (!record || now - record.at >= timing.windowMs) return true;
    return record.count < 2 && now - record.at >= timing.followUpMs;
  }

  return {
    want(subjects, now) {
      let added = false;
      for (const subject of subjects) {
        const key = trailerPreviewSubjectKey(subject);
        if (!sendable(key, now)) continue;
        pending.delete(key);
        pending.set(key, subject);
        added = true;
      }
      if (added) lastWant = now;
    },
    dueAt(now) {
      if (pending.size === 0) return null;
      return Math.max(lastWant + timing.settleMs, pausedUntil, now);
    },
    take(now, isReady) {
      if (now < pausedUntil || now < lastWant + timing.settleMs) return [];
      const batch: TrailerPreviewSubject[] = [];
      for (const [key, subject] of [...pending].reverse()) {
        if (batch.length >= TRAILER_PREVIEW_WARM_MAX_SUBJECTS) break;
        pending.delete(key);
        if (!sendable(key, now) || isReady(subject)) continue;
        const record = sent.get(key);
        const fresh = !record || now - record.at >= timing.windowMs;
        sent.set(key, { count: fresh ? 1 : record.count + 1, at: now });
        batch.push(subject);
      }
      return batch;
    },
    failed(now) {
      pausedUntil = now + timing.backoffMs;
    },
  };
}
