import { IDLE_CANCEL_MS, type ScrubMachine } from "@tentacle-tv/tv-core";
import { RESUME_COUNTDOWN_MS } from "./scrubTouchTuning";

/**
 * Le DÉCOMPTE du défilement : quand il se fermera de lui-même, et pour faire
 * quoi — ce que l'écran dit (« Lecture dans 3 s », « Reprise à 12:34 dans
 * 3 s »). Deux échéances, jamais les deux à l'écran :
 *
 *  - la REPRISE (`play`) : un glisser au pavé, entré en lecture. Le doigt
 *    levé (ou immobile), la lecture repart à la position visée au bout de
 *    `RESUME_COUNTDOWN_MS`, décompté en entier. Un geste continu la suspend
 *    (doigt posé, maintien), tout autre geste la relance ;
 *  - l'ABANDON de la machine (tv-core, `IDLE_CANCEL_MS`), partout ailleurs —
 *    flèches, maintien, bouton, pavé en pause. On en montre les dernières
 *    secondes : la lecture reprend où l'on était (`resume`), ou y revient en
 *    pause (`return`). La machine abandonne elle-même ; on ne fait que le
 *    dire, à la même échéance (`activity` suit chacun de ses réarmements,
 *    `reportingActivity`).
 *
 * Module pur, horloge et minuteurs injectables. Un seul minuteur, posé à la
 * prochaine seconde affichée : l'état ne change qu'une fois par seconde, et
 * un glisser qui repousse l'échéance à chaque image n'en repose aucun.
 */

export type ScrubCountdownAction = "play" | "resume" | "return";

export interface ScrubCountdownState {
  action: ScrubCountdownAction;
  /** Secondes restantes, arrondies au-dessus : 3, 2, 1. */
  remaining: number;
  /** Les secondes du décompte entier. */
  total: number;
}

/** L'abandon ne se montre que pendant ses dernières secondes. */
export const IDLE_COUNTDOWN_SHOWN_MS = 3000;

export interface CountdownTimers {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const REAL_TIMERS: CountdownTimers = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface ScrubCountdown {
  /** Un défilement s'ouvre ; `paused` : la lecture était en pause. */
  begin: (paused: boolean) => void;
  /** Il se ferme (OK, Retour, abandon, reprise) : plus rien ne court. */
  end: () => void;
  /** La machine vient de repousser son abandon (entrée, pas, toucher). */
  activity: () => void;
  /** Ce défilement reprendra seul à la position visée — sans effet s'il
   *  s'est ouvert en pause : il n'y a rien à reprendre. */
  armResume: () => void;
  /** Un geste continu commence (doigt posé, maintien) : la reprise attend. */
  hold: () => void;
  /** Il s'achève : la reprise repart d'un décompte entier. */
  release: () => void;
  destroy: () => void;
}

export function createScrubCountdown({ onChange, onResume, timers = REAL_TIMERS }: {
  onChange: (state: ScrubCountdownState | null) => void;
  /** La reprise est échue : lire depuis la position visée. */
  onResume: () => void;
  timers?: CountdownTimers;
}): ScrubCountdown {
  let open = false;
  let paused = false;
  let armed = false;
  let held = false;
  let idleAt = 0;
  let resumeAt = 0;
  let timer: unknown = null;
  let dueAt = 0;
  let shown: ScrubCountdownState | null = null;

  function show(next: ScrubCountdownState | null): void {
    const same = next === shown || (!!next && !!shown && next.action === shown.action
      && next.remaining === shown.remaining && next.total === shown.total);
    if (same) return;
    shown = next;
    onChange(next);
  }

  function clear(): void {
    if (timer === null) return;
    timers.clearTimeout(timer);
    timer = null;
  }

  /** Un réveil à `at` — sauf si le minuteur posé sonne avant : il recalculera. */
  function wakeAt(at: number, now: number): void {
    if (timer !== null && dueAt <= at) return;
    clear();
    dueAt = at;
    timer = timers.setTimeout(() => {
      timer = null;
      schedule();
    }, Math.max(0, at - now));
  }

  function schedule(): void {
    if (!open || (armed && held)) {
      clear();
      show(null);
      return;
    }
    const now = timers.now();
    const deadline = armed ? resumeAt : idleAt;
    const windowMs = armed ? RESUME_COUNTDOWN_MS : IDLE_COUNTDOWN_SHOWN_MS;
    const left = deadline - now;
    if (left <= 0) {
      clear();
      show(null);
      // La reprise est NOTRE échéance ; l'abandon est celui de la machine.
      if (armed) {
        open = false;
        onResume();
      }
      return;
    }
    if (left > windowMs) {
      show(null);
      wakeAt(deadline - windowMs, now);
      return;
    }
    const remaining = Math.ceil(left / 1000);
    show({ action: armed ? "play" : paused ? "return" : "resume", remaining, total: Math.ceil(windowMs / 1000) });
    wakeAt(deadline - (remaining - 1) * 1000, now);
  }

  function end(): void {
    open = false;
    armed = false;
    held = false;
    clear();
    show(null);
  }

  return {
    begin: (wasPaused) => {
      open = true;
      paused = wasPaused;
      armed = false;
      held = false;
      idleAt = timers.now() + IDLE_CANCEL_MS;
      schedule();
    },
    end,
    activity: () => {
      if (!open) return;
      const now = timers.now();
      idleAt = now + IDLE_CANCEL_MS;
      // Tout geste relance la reprise ; le geste continu la tient (`hold`).
      if (armed && !held) resumeAt = now + RESUME_COUNTDOWN_MS;
      schedule();
    },
    armResume: () => {
      if (!open || paused || armed) return;
      armed = true;
      resumeAt = timers.now() + RESUME_COUNTDOWN_MS;
      schedule();
    },
    hold: () => {
      if (!open) return;
      held = true;
      schedule();
    },
    release: () => {
      if (!open) return;
      held = false;
      if (armed) resumeAt = timers.now() + RESUME_COUNTDOWN_MS;
      schedule();
    },
    destroy: end,
  };
}

/**
 * La machine du défilement dont chaque réarmement de l'abandon — entrée, pas,
 * toucher — est rapporté au décompte, au moment même : leurs échéances
 * tombent ensemble, et l'écran ne dit jamais « dans 1 s » d'un abandon que
 * la machine vient de repousser.
 */
export function reportingActivity(machine: ScrubMachine, countdown: ScrubCountdown): ScrubMachine {
  return {
    ...machine,
    enter: () => {
      machine.enter();
      countdown.activity();
    },
    step: (sign, tier) => {
      machine.step(sign, tier);
      countdown.activity();
    },
    touch: () => {
      machine.touch();
      countdown.activity();
    },
  };
}
