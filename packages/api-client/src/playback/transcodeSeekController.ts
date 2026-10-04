import {
  accumulateSeek, nextSeekWaitChange, seekDueAt, seekLanded, seekWaitPhase,
  type PendingSeek, type SeekRequest, type SeekWaitPhase,
} from "@tentacle-tv/shared";

/**
 * Le saut pendant un transcodage, en mouvement — la règle partagée
 * (`player/transcodeSeek.ts`) tenue dans le temps, sans React : le crochet
 * `useTranscodeSeek` ne fait que la brancher, et les tests la jouent avec une
 * fausse horloge.
 */

export interface TranscodeSeekState {
  /** La position visée, affichée à la barre pendant le regroupement et l'attente ; `null` : aucune. */
  target: number | null;
  phase: SeekWaitPhase;
}

export interface TranscodeSeekHost {
  /** Le flux est converti par le serveur : on regroupe et on dit l'attente. Sinon, saut immédiat. */
  transcoding: () => boolean;
  /** La durée du film en secondes (0 : inconnue). */
  duration: () => number;
  /** La position du film, maintenant. */
  position: () => number;
  /** Déplacer le lecteur — appelé UNE fois par série d'appuis. */
  apply: (target: number) => void;
  /** L'état a changé (rendu). */
  onChange: (state: TranscodeSeekState) => void;
  now?: () => number;
}

const IDLE: TranscodeSeekState = { target: null, phase: "idle" };

export interface TranscodeSeekController {
  request: (request: SeekRequest) => void;
  /** Un relevé du lecteur : la position, et s'il charge. L'atterrissage se constate ici. */
  observe: (position: number, buffering: boolean) => void;
  /** Le lecteur dit lui-même que le saut a abouti (`playback-restart` de mpv, verdict du web). */
  landed: () => void;
  /** Tout éteindre : l'erreur est affichée, la source change, le lecteur se démonte. */
  reset: () => void;
  state: () => TranscodeSeekState;
}

export function createTranscodeSeekController(host: TranscodeSeekHost): TranscodeSeekController {
  const now = host.now ?? Date.now;
  let pending: PendingSeek | null = null;
  /** Le premier appui de la série en cours (attente comprise), `null` : rien en cours. */
  let since: number | null = null;
  /** La cible appliquée au lecteur, en attente d'images. */
  let applied: number | null = null;
  let lastPosition: number | null = null;
  let commitTimer: ReturnType<typeof setTimeout> | undefined;
  let phaseTimer: ReturnType<typeof setTimeout> | undefined;
  let state: TranscodeSeekState = IDLE;

  const emit = (next: TranscodeSeekState) => {
    if (next.target === state.target && next.phase === state.phase) return;
    state = next;
    host.onChange(state);
  };

  const target = () => pending?.target ?? applied;

  const armPhase = () => {
    clearTimeout(phaseTimer);
    const at = nextSeekWaitChange(since, now());
    if (at === null) return;
    phaseTimer = setTimeout(() => {
      emit({ target: target(), phase: seekWaitPhase(since, now()) });
      armPhase();
    }, Math.max(0, at - now()));
  };

  const commit = () => {
    if (!pending) return;
    applied = pending.target;
    pending = null;
    lastPosition = null;
    host.apply(applied);
    emit({ target: applied, phase: seekWaitPhase(since, now()) });
  };

  const reset = () => {
    clearTimeout(commitTimer);
    clearTimeout(phaseTimer);
    pending = null;
    since = null;
    applied = null;
    lastPosition = null;
    emit(IDLE);
  };

  return {
    request(request) {
      const t = now();
      if (!host.transcoding()) {
        // Lecture directe : les octets sont là, le lecteur saute tout de suite.
        const next = accumulateSeek(null, request, host.position(), t, host.duration());
        host.apply(next.target);
        return;
      }
      // La base d'un écart : la cible en cours (en attente ou appliquée), jamais
      // une position que le lecteur n'a pas encore quittée.
      pending = accumulateSeek(pending, request, target() ?? host.position(), t, host.duration());
      since ??= t;
      clearTimeout(commitTimer);
      commitTimer = setTimeout(commit, Math.max(0, seekDueAt(pending) - t));
      emit({ target: pending.target, phase: seekWaitPhase(since, t) });
      armPhase();
    },
    observe(position, buffering) {
      if (applied === null || pending) {
        lastPosition = position;
        return;
      }
      const advancing = lastPosition !== null && position > lastPosition;
      lastPosition = position;
      if (seekLanded({ target: applied, position, advancing, buffering })) reset();
    },
    landed() {
      if (applied !== null && !pending) reset();
    },
    reset,
    state: () => state,
  };
}
