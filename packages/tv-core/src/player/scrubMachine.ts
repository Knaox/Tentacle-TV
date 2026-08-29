/**
 * Le curseur fantôme.
 *
 * C'est le modèle d'`apps/tv` transposé, et son point central mérite d'être
 * écrit noir sur blanc : **aucun déplacement n'est appliqué avant
 * confirmation**. Les flèches font avancer un curseur, la vidéo reste où elle
 * est — en pause — et ce n'est qu'à l'appui sur OK qu'un seul déplacement est
 * demandé. Traduire chaque flèche en un saut donnerait, sur un flux transcodé,
 * une rafale de reconstructions d'URL pour arriver quelque part qu'on n'a même
 * pas visé.
 *
 * Trois portes de sortie, et elles ne font pas la même chose : OK confirme,
 * Retour annule, et l'inactivité annule aussi. La troisième est un filet — on
 * repose la télécommande en cours de route, et on ne veut pas retrouver le film
 * déplacé de vingt minutes en revenant.
 *
 * L'accélération est réservée au MAINTIEN. Un appui simple avance d'un pas de
 * base : c'est la seule façon de viser une position précise, et la répétition
 * automatique ne doit pas transformer une pression appuyée en bond de deux
 * minutes. Ce pas de base est PROPORTIONNEL à la durée du média (`scrubStep`,
 * partagé avec apps/tv) : dix secondes fixes faisaient 5 % de la barre sur un
 * épisode court et 0,3 % sur un film — traverser un long métrage n'en
 * finissait pas.
 *
 * Module pur — ni React, ni DOM, horloge injectable. C'est ce qui le rend
 * testable, et ce qui permet de vérifier la seule chose qui compte vraiment :
 * que `cancel()` n'appelle jamais `onSeek`.
 */

import { scrubStep, SCRUB_STEP_MIN_S } from "@tentacle-tv/shared";

/** Plancher historique du pas (contenus courts / durée inconnue) — réexporté
 *  pour les tests ; la valeur effective vient de `scrubStep(duree)`. */
export const SCRUB_STEP_S = SCRUB_STEP_MIN_S;

/** Les paliers du maintien. Au-delà de huit, on ne vise plus rien. */
export const SCRUB_TIERS = [1, 2, 4, 8] as const;

/** Sans nouvelle touche, on annule. Sept secondes : on a reposé la télécommande. */
export const IDLE_CANCEL_MS = 7000;

export interface ScrubMachineOptions {
  readPosition: () => number;
  readDuration: () => number;
  onEnter: (position: number, tier: number) => void;
  onChange: (position: number, tier: number) => void;
  onPause: (pause: boolean) => void;
  onSeek: (seconds: number) => void;
  onExit: () => void;
}

export interface ScrubMachine {
  /**
   * Entrer en déplacement SANS bouger : le curseur fantôme se pose là où l'on
   * en est, et attend.
   *
   * C'est le geste du bouton dédié de la rangée, et celui d'`apps/tv`
   * (`enterScrub` → `startScrubbing`). Une flèche, elle, entre en avançant —
   * c'est `pas`, qui amorce au passage. Les deux amorcent la même machine ; ce
   * qui les distingue est qu'on a désigné une direction, ou non.
   */
  enter: () => void;
  step: (sign: 1 | -1, tier: number) => void;
  confirm: () => void;
  cancel: () => void;
  isActive: () => boolean;
  destroy: () => void;
}

export function createScrubMachine(options: ScrubMachineOptions): ScrubMachine {
  let active = false;
  let position = 0;
  let idle: ReturnType<typeof setTimeout> | null = null;

  function armIdle(): void {
    if (idle !== null) clearTimeout(idle);
    idle = setTimeout(() => {
      idle = null;
      cancel();
    }, IDLE_CANCEL_MS);
  }

  function disarm(): void {
    if (idle === null) return;
    clearTimeout(idle);
    idle = null;
  }

  function clamp(value: number): number {
    const duration = options.readDuration();
    if (!(duration > 0)) return Math.max(0, value);
    return Math.min(Math.max(0, value), duration);
  }

  /** L'entrée en déplacement, commune au bouton et à la première flèche. */
  function begin(tier: number): void {
    active = true;
    position = clamp(options.readPosition());
    options.onPause(true);
    options.onEnter(position, tier);
  }

  function enter(): void {
    if (active) return;
    begin(SCRUB_TIERS[0]);
    // La veille d'inactivité vaut ici comme ailleurs : entrer en déplacement et
    // reposer la télécommande ne doit pas laisser la vidéo en pause.
    armIdle();
  }

  function step(sign: 1 | -1, tier: number): void {
    const multiplier = SCRUB_TIERS.indexOf(tier as (typeof SCRUB_TIERS)[number]) >= 0 ? tier : 1;

    if (!active) begin(multiplier);

    position = clamp(position + sign * scrubStep(options.readDuration()) * multiplier);
    options.onChange(position, multiplier);
    armIdle();
  }

  function confirm(): void {
    if (!active) return;
    const target = position;
    active = false;
    disarm();
    options.onExit();
    // Le déplacement d'abord, la reprise ensuite : reprendre avant de déplacer
    // ferait jouer une seconde de l'ancienne position.
    options.onSeek(target);
    options.onPause(false);
  }

  function cancel(): void {
    if (!active) return;
    active = false;
    disarm();
    options.onExit();
    // Aucun `onSeek` : c'est toute la différence avec une confirmation, et
    // c'est ce qui rend l'abandon sur inactivité inoffensif.
    options.onPause(false);
  }

  return {
    enter,
    step,
    confirm,
    cancel,
    isActive: () => active,
    destroy: () => {
      disarm();
      active = false;
    },
  };
}
