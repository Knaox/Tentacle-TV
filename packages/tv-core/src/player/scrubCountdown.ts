import type { ScrubMachine } from "./scrubMachine";
import type { PlayerTimers } from "./playerTimers";
import { RESUME_COUNTDOWN_MS } from "./seekTuning";

/**
 * Le DÉCOMPTE du défilement — une seule règle, quelle que soit l'entrée
 * (pavé, flèches, maintien, boutons de l'habillage, touches média) :
 *
 *  - entré EN LECTURE, le défilement se ferme seul au bout du délai de sa
 *    POLITIQUE, décompté en entier à l'écran — en lisant depuis la position
 *    visée (`resume` : « Lecture dans 5 s ») ou en revenant où l'on était
 *    (`return` : « Retour à 12:34 dans 5 s »). Tout geste le relance ; un
 *    geste continu (doigt posé, maintien) le suspend, et son relâchement
 *    repart d'un décompte entier ;
 *  - entré EN PAUSE, rien ne part seul : la cible attend OK ou Retour (la
 *    machine n'a plus d'abandon sur inactivité, `idleCancelMs: null`).
 *
 * OK valide aussitôt et Retour annule, quelle que soit la politique : c'est
 * le contrôleur qui ferme (`end`). La politique est LUE à chaque ouverture
 * (`readPolicy`) : un réglage changé vaut dès le défilement suivant, jamais
 * au milieu d'un décompte. Module pur, horloge et minuteurs injectables
 * (Apple TV et Android TV le lisent par `apps/tv` `useTVPlayerControls`). Un
 * seul minuteur, posé à la prochaine seconde affichée : l'état ne change
 * qu'une fois par seconde, et un glisser qui repousse l'échéance à chaque
 * image n'en repose aucun.
 */

/** Ce que fait le décompte à son terme : revenir où l'on était (annuler) ou
 *  lire depuis la position visée (valider). */
export type ScrubCountdownOutcome = "return" | "resume";

/** La politique du décompte : son issue, et son délai. */
export interface ScrubCountdownPolicy {
  outcome: ScrubCountdownOutcome;
  /** Le délai entier, en ms — un multiple de la seconde affichée. */
  delayMs: number;
}

/** La politique d'avant le réglage : la lecture repart à la cible au bout de
 *  `RESUME_COUNTDOWN_MS`. C'est le défaut du cerveau — Android TV, qui n'a
 *  pas le réglage, la garde telle quelle. */
export const RESUME_COUNTDOWN_POLICY: ScrubCountdownPolicy = { outcome: "resume", delayMs: RESUME_COUNTDOWN_MS };

export interface ScrubCountdownState {
  /** Secondes restantes, arrondies au-dessus : 5, 4… 1. */
  remaining: number;
  /** Les secondes du décompte entier. */
  total: number;
  /** Ce qui se passera à son terme. */
  outcome: ScrubCountdownOutcome;
  /** La COURSE : elle change à chaque relance (ouverture, geste, relâchement),
   *  même dans la seconde affichée — la barre repart alors pleine et se vide
   *  jusqu'à l'échéance, sans attendre la seconde suivante. */
  run: number;
}

/** Les minuteurs du décompte (`playerTimers.ts`). */
export type CountdownTimers = PlayerTimers;

export interface ScrubCountdown {
  /** Un défilement s'ouvre (la politique est lue ici) ; `paused` : la lecture
   *  était en pause — rien ne se fermera seul. */
  begin: (paused: boolean) => void;
  /** Il se ferme (OK, Retour, reprise) : plus rien ne court. */
  end: () => void;
  /** Un geste (entrée, pas, toucher) : le décompte repart en entier. */
  activity: () => void;
  /** Un geste continu commence (doigt posé, maintien) : le décompte attend. */
  hold: () => void;
  /** Il s'achève : le décompte repart en entier. */
  release: () => void;
  destroy: () => void;
}

export function createScrubCountdown({ onChange, onExpire, timers, readPolicy }: {
  onChange: (state: ScrubCountdownState | null) => void;
  /** Le décompte est échu : son issue est celle de la politique lue à
   *  l'ouverture. */
  onExpire: (outcome: ScrubCountdownOutcome) => void;
  timers: CountdownTimers;
  /** La politique, lue à chaque ouverture. Défaut : `RESUME_COUNTDOWN_POLICY`. */
  readPolicy?: () => ScrubCountdownPolicy;
}): ScrubCountdown {
  /** Un défilement entré en lecture court : il se fermera seul. */
  let armed = false;
  let held = false;
  let expiresAt = 0;
  let timer: unknown = null;
  let dueAt = 0;
  let shown: ScrubCountdownState | null = null;
  let policy = RESUME_COUNTDOWN_POLICY;
  let total = Math.ceil(policy.delayMs / 1000);
  let run = 0;

  function show(next: ScrubCountdownState | null): void {
    if (next === shown || (!!next && !!shown && next.remaining === shown.remaining && next.run === shown.run)) return;
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
    const left = expiresAt - now;
    if (left <= 0) {
      armed = false;
      clear();
      show(null);
      onExpire(policy.outcome);
      return;
    }
    const remaining = Math.ceil(left / 1000);
    show({ remaining, total, outcome: policy.outcome, run });
    wakeAt(expiresAt - (remaining - 1) * 1000, now);
  }

  /** Le décompte entier, depuis maintenant : une nouvelle course. */
  function restart(): void {
    expiresAt = timers.now() + policy.delayMs;
    run += 1;
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
      policy = readPolicy?.() ?? RESUME_COUNTDOWN_POLICY;
      total = Math.ceil(policy.delayMs / 1000);
      armed = !paused;
      held = false;
      restart();
    },
    end,
    activity: () => {
      // Le geste continu tient le décompte : son relâchement le relancera.
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
 * dit jamais « dans 1 s » d'une fermeture qu'un geste vient de repousser.
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
