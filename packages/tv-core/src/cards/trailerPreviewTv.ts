import {
  DEFAULT_TRAILER_PREVIEW_DELAY, TRAILER_PREVIEW_DELAYS, TRAILER_PREVIEW_TIMING, parseTrailerPreviewDelay, trailerPreviewTimingFor,
  type TrailerPreviewDelay, type TrailerPreviewPace, type TrailerPreviewTiming,
} from "@tentacle-tv/shared";

/**
 * L'aperçu de bande-annonce AU FOCUS d'une carte, joué dans la zone d'aperçu
 * (Apple TV, Android TV, tv-core `previewZone.ts`) — les
 * temps et la mémoire de l'appareil. La machine est celle du web et du bureau
 * (shared `reduceTrailerPreview`) : le focus y tient le rôle du survol, et il
 * n'y a pas de pointeur (aucun `move`).
 *
 * Les temps sont ceux du salon, pas ceux de la souris : une télécommande
 * avance d'un pas toutes les 300 à 600 ms quand on parcourt une rangée, et
 * répète un pas toutes les ~100 ms quand on la tient. La vidéo paraît au
 * DÉLAI choisi sur l'appareil (Réglages › Lecture, shared `previewDelay.ts`),
 * 800 ms par défaut, le même que sur le bureau ; la demande part 350 ms avant
 * lui, JAMAIS avant 450 ms de focus tenu, quel que soit le délai : un
 * parcours régulier (un pas toutes les 400 ms) ne demande rien, un pas de plus
 * la repousse. Essayé à 300 ms (16/10), un parcours posé demandait un aperçu
 * par carte traversée — une extraction YouTube possible chacune, et une vidéo
 * montée à chaque pas ; à 450 ms, un délai de 0,5 s ne se tenait pas (~0,8 s) :
 * les téléviseurs ne l'offrent pas (`TV_TRAILER_PREVIEW_DELAYS`). Historique :
 * une seconde et 1,8 s, « comme Netflix au salon », trop lent (15/10) ; puis
 * 900 ms ; puis le délai de l'utilisateur (16/10). Le serveur a préparé d'avance
 * l'aperçu des cartes autour du focus (`/api/trailers/preview/warm`) : la
 * réponse est presque toujours immédiate, la vidéo part à l'intention. Le
 * reste (vérification par le serveur, aucune révélation sans première image,
 * fondu de sortie, refus passagers) ne change pas.
 */
export const TV_TRAILER_PREVIEW_TIMING: TrailerPreviewTiming = {
  ...TRAILER_PREVIEW_TIMING,
  /** Focus tenu avant la demande, au délai par défaut (`tvTrailerPreviewTiming`) : un parcours de rangée ne demande rien. */
  intentMs: 450,
  /** Pas de pointeur : l'intention ne dépend que du focus tenu. */
  intentStillMs: 0,
  /** La vidéo paraît dans la zone au plus tôt à ce moment, depuis l'arrivée du focus : le délai choisi (`tvTrailerPreviewTiming`). */
  revealMs: DEFAULT_TRAILER_PREVIEW_DELAY,
  /** La vidéo sort de la zone un peu plus vite qu'elle n'y est entrée (le mouvement d'Apple TV). */
  exitMs: 220,
  /** Le son du salon : la bande-annonce s'entend, sans couvrir la pièce. */
  volume: 0.7,
};

/** Le pas du salon : la demande 350 ms avant le délai, jamais sous 450 ms de focus tenu (un parcours de rangée). */
export const TV_TRAILER_PREVIEW_PACE: TrailerPreviewPace = { floorMs: 450, leadMs: 350 };

/**
 * Les délais qu'un téléviseur OFFRE : 0,8 · 1,2 · 2 s — pas 0,5 s (décision
 * de Damien, 16/10 : sous le plancher de 450 ms, l'aperçu paraissait vers
 * 0,8 s, le choix ne tenait pas sa promesse). L'ordinateur garde 0,5 s.
 */
export const TV_TRAILER_PREVIEW_DELAYS: readonly TrailerPreviewDelay[] = TRAILER_PREVIEW_DELAYS.filter(
  (delay) => delay >= DEFAULT_TRAILER_PREVIEW_DELAY,
);

/** Une valeur gardée sur le téléviseur → un délai qu'il offre ; 0,5 s (choisi avant le 16/10) et tout le reste → le défaut. */
export function parseTvTrailerPreviewDelay(raw: unknown): TrailerPreviewDelay {
  return parseTrailerPreviewDelay(raw, TV_TRAILER_PREVIEW_DELAYS);
}

/** Les temps de la machine pour le délai choisi sur ce téléviseur. */
export function tvTrailerPreviewTiming(delayMs: number): TrailerPreviewTiming {
  return trailerPreviewTimingFor(TV_TRAILER_PREVIEW_TIMING, parseTvTrailerPreviewDelay(delayMs), TV_TRAILER_PREVIEW_PACE);
}

/**
 * Ce que l'appareil retient, pour la session (un redémarrage efface tout) :
 *
 * - les bandes-annonces qui ont LÂCHÉ à la lecture ici (erreur, première image
 *   trop lente) : le serveur les a vérifiées, mais ce lecteur n'en veut pas —
 *   pas redemandées avant `failureMemoryMs` ;
 * - où chaque VIDÉO en était : revenir sur une carte reprend la bande-annonce
 *   là où on l'avait laissée (dix minutes), comme sur le bureau. La clé est le
 *   chemin du flux sans son jeton (`previewVideoKey`), jamais le titre ; une
 *   vidéo finie, ou laissée à deux secondes de sa fin, repart du début.
 */
export interface TrailerPreviewMemory {
  rememberFailure(subjectKey: string): void;
  recentlyFailed(subjectKey: string | null): boolean;
  /** Retient la position (s) d'une vidéo ; `duration` (s) efface une vidéo finie. */
  savePosition(videoKey: string, position: number, duration?: number): void;
  /** La position retenue (s), ou `null`. */
  positionOf(videoKey: string): number | null;
  forgetPosition(videoKey: string): void;
}

export interface TrailerPreviewMemoryOptions {
  now?: () => number;
  failureMs?: number;
  positionMs?: number;
}

/** Une position plus près de la fin que ceci repart du début. */
const END_MARGIN_S = 2;
/** Une position sous ceci ne vaut pas d'être reprise. */
const MIN_RESUME_S = 1;
/** Au plus tant de vidéos retenues (les plus anciennes s'en vont). */
const MAX_POSITIONS = 64;

export function createTrailerPreviewMemory(options: TrailerPreviewMemoryOptions = {}): TrailerPreviewMemory {
  const now = options.now ?? Date.now;
  const failureMs = options.failureMs ?? TRAILER_PREVIEW_TIMING.failureMemoryMs;
  const positionMs = options.positionMs ?? 10 * 60_000;
  const failures = new Map<string, number>();
  const positions = new Map<string, { position: number; until: number }>();
  return {
    rememberFailure(subjectKey) {
      failures.set(subjectKey, now() + failureMs);
    },
    recentlyFailed(subjectKey) {
      if (subjectKey === null) return false;
      const until = failures.get(subjectKey);
      if (until === undefined) return false;
      if (until > now()) return true;
      failures.delete(subjectKey);
      return false;
    },
    savePosition(videoKey, position, duration) {
      const ended = duration !== undefined && duration > 0 && position >= duration - END_MARGIN_S;
      if (ended || !Number.isFinite(position) || position < MIN_RESUME_S) {
        positions.delete(videoKey);
        return;
      }
      positions.delete(videoKey);
      positions.set(videoKey, { position, until: now() + positionMs });
      if (positions.size > MAX_POSITIONS) positions.delete(positions.keys().next().value as string);
    },
    positionOf(videoKey) {
      const entry = positions.get(videoKey);
      if (!entry) return null;
      if (entry.until > now()) return entry.position;
      positions.delete(videoKey);
      return null;
    },
    forgetPosition(videoKey) {
      positions.delete(videoKey);
    },
  };
}

/** La clé d'une vidéo d'aperçu : son chemin relayé, sans le jeton (qui change à chaque décision). */
export function previewVideoKey(path: string): string {
  const query = path.indexOf("?");
  return query === -1 ? path : path.slice(0, query);
}

/**
 * Où l'aperçu commence (s) : la position retenue, sinon quelques secondes
 * après le début d'un flux HLS (presque toujours du noir ou le logo d'un
 * distributeur au départ, cf. shared `startOffsetS`) ; un MP4 part de 0 — sa
 * durée n'est pas connue avant son chargement, et il peut être court.
 */
export function previewStartPosition(input: { resumeAt: number | null; hls: boolean }): number {
  if (input.resumeAt !== null) return input.resumeAt;
  return input.hls ? TRAILER_PREVIEW_TIMING.startOffsetS : 0;
}
