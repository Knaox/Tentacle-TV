import { RESUME_COUNTDOWN_MS, type ScrubMachine } from "@tentacle-tv/tv-core";

/**
 * Le DÉCOMPTE de validation du défilement — une seule règle, quelle que soit
 * l'entrée (pavé, flèches, maintien, boutons de l'habillage, touches média) :
 *
 *  - entré EN LECTURE, le défilement reprend seul à la position visée au bout
 *    de `RESUME_COUNTDOWN_MS`, décompté en entier à l'écran (« Lecture dans
 *    5 s »). Tout geste le relance ; un geste continu (doigt posé, maintien)
 *    le suspend, et son relâchement repart d'un décompte entier ;
 *  - entré EN PAUSE, rien ne part seul : la cible attend OK ou Retour (la
 *    machine n'a plus d'abandon sur inactivité, `idleCancelMs: null`).
 *
 * OK valide aussitôt et Retour annule : c'est le contrôleur qui ferme
 * (`end`). Module pur, horloge et minuteurs injectables. Un seul minuteur,
 * posé à la prochaine seconde affichée : l'état ne change qu'une fois par
 * seconde, et un glisser qui repousse l'échéance à chaque image n'en repose
 * aucun.
 */

export interface ScrubCountdownState {
  /** Secondes restantes, arrondies au-dessus : 5, 4… 1. */
  remaining: number;
  /** Les secondes du décompte entier. */
  total: number;
}

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
  /** Un défilement s'ouvre ; `paused` : la lecture était en pause — rien ne
   *  reprendra seul. */
  begin: (paused: boolean) => void;
  /** Il se ferme (OK, Retour, reprise) : plus rien ne court. */
  end: () => void;
  /** Un geste (entrée, pas, toucher) : le décompte repart en entier. */
  activity: () => void;
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
  /** Un défilement entré en lecture court : il reprendra seul. */
  let armed = false;
  let held = false;
  let resumeAt = 0;
  let timer: unknown = null;
  let dueAt = 0;
  let shown: ScrubCountdownState | null = null;
  const total = Math.ceil(RESUME_COUNTDOWN_MS / 1000);

  function show(next: ScrubCountdownState | null): void {
    if (next === shown || (!!next && !!shown && next.remaining === shown.remaining)) return;
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
    if (!armed || held) {
      clear();
      show(null);
      return;
    }
    const now = timers.now();
    const left = resumeAt - now;
    if (left <= 0) {
      armed = false;
      clear();
      show(null);
      onResume();
      return;
    }
    const remaining = Math.ceil(left / 1000);
    show({ remaining, total });
    wakeAt(resumeAt - (remaining - 1) * 1000, now);
  }

  /** Le décompte entier, depuis maintenant. */
  function restart(): void {
    resumeAt = timers.now() + RESUME_COUNTDOWN_MS;
    schedule();
  }

  function end(): void {
    armed = false;
    held = false;
    clear();
    show(null);
  }

  return {
    begin: (paused) => {
      armed = !paused;
      held = false;
      restart();
    },
    end,
    activity: () => {
      // Le geste continu tient la reprise : son relâchement la relancera.
      if (armed && !held) restart();
    },
    hold: () => {
      if (!armed) return;
      held = true;
      schedule();
    },
    release: () => {
      if (!armed) return;
      held = false;
      restart();
    },
    destroy: end,
  };
}

/**
 * La machine du défilement dont chaque geste — entrée, pas, toucher — est
 * rapporté au décompte, au moment même : il repart en entier, et l'écran ne
 * dit jamais « dans 1 s » d'une reprise qu'un geste vient de repousser.
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
