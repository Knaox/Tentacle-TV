/**
 * Le MOUVEMENT de la page qui suit le focus : qui défile, et comment.
 *
 * - Un pas ISOLÉ (un appui) : la page va à la cible de la section sur SON
 *   ressort — même courbe, même durée, quelle que soit la distance ; un focus
 *   en plein vol reprend position ET vitesse. La plateforme ne défile pas
 *   (sur tvOS, on lui rend la position courante quand elle propose la sienne).
 * - Une RAFALE — une flèche maintenue, que la plateforme répète ; un glisser
 *   du pavé : c'est l'animateur de la PLATEFORME qui défile, vers notre cible.
 *   Au bout d'une à deux secondes de rafale, tvOS passe en défilement rapide
 *   en partant de la vitesse de son animateur : notre ressort à sa place, il
 *   partait de zéro et la page ralentissait (mesuré au banc des
 *   bibliothèques).
 *
 * Sur Apple TV l'application est native et le reste
 * (`TentacleRevealScroller.m`, `TentacleRevealMotion.m`,
 * `TentacleFocusInput.m`) : ce module en est la spécification, pas à pas.
 *
 * Module pur : temps en millisecondes, sauf le ressort (en secondes, comme
 * les jetons `TV_MOTION.spring`).
 */

export const REVEAL_BURST = {
  /** Une flèche enfoncée depuis plus longtemps fait faire des pas de répétition (la 1re vient ~470 ms après l'appui). */
  repeatAfterMs: 200,
  /** Un pas qui suit l'activité du pavé de moins que ça vient d'un glisser. */
  swipeWindowMs: 500,
  /** Après le dernier pas d'une rafale, la plateforme garde la main ce temps-là. */
  lingerMs: 700,
  /** La plateforme a posé la page il y a moins que ça : elle défile encore. */
  foreignMovingMs: 50,
  /** Un pas de rafale sans proposition de la plateforme se rejoue quand elle s'arrête : sondé tous les… */
  retryMs: 100,
  /** … ce nombre de fois au plus. */
  retries: 10,
  /** Une proposition de la plateforme arrivée à ce jeu près compte pour ce pas. */
  proposalSlackMs: 20,
} as const;

export interface InputActivity {
  now: number;
  /** Depuis quand chaque flèche est enfoncée ; 0 : relâchée. */
  arrowsDownSince: readonly number[];
  /** La dernière activité du pavé tactile ; 0 : aucune. */
  lastTouchAt: number;
}

/** La télécommande dit-elle une rafale ? Une flèche enfoncée à l'instant est un appui isolé, même doigt posé sur le pavé. */
export function isInputBurst({ now, arrowsDownSince, lastTouchAt }: InputActivity): boolean {
  let anyDown = false;
  for (const since of arrowsDownSince) {
    if (since <= 0) continue;
    if (now - since > REVEAL_BURST.repeatAfterMs) return true;
    anyDown = true;
  }
  return !anyDown && lastTouchAt > 0 && now - lastTouchAt < REVEAL_BURST.swipeWindowMs;
}

/**
 * Ce pas du focus est-il une rafale ? La télécommande le dit ; une rafale qui
 * finit, ou la plateforme qui défile encore, aussi : on ne lui dispute jamais
 * la page en plein mouvement. Une rafale prolonge sa fenêtre.
 */
export function revealBurstStep(input: { inputBurst: boolean; now: number; burstUntil: number; foreignAt: number }): { burst: boolean; burstUntil: number } {
  const { inputBurst, now, burstUntil, foreignAt } = input;
  const burst = inputBurst || now < burstUntil || now - foreignAt < REVEAL_BURST.foreignMovingMs;
  return { burst, burstUntil: burst ? now + REVEAL_BURST.lingerMs : burstUntil };
}

/** D'où se calcule la cible d'un pas de rafale : celle du pas précédent de la même rafale, sinon la position. */
export function burstTargetBase(input: { now: number; lastTargetAt: number; lastTarget: number; offset: number }): number {
  return input.now - input.lastTargetAt < REVEAL_BURST.lingerMs ? input.lastTarget : input.offset;
}

/**
 * Un pas de rafale pour lequel la plateforme n'a rien proposé : `drop` (elle a
 * proposé depuis, ou le focus a quitté la section), `retry` (elle défile
 * encore : attendre `retryMs`), `spring` (montrer la section comme pour un pas
 * isolé — la première ligne d'une grille ramène ainsi son titre).
 */
export function unproposedStep(input: {
  stepAt: number;
  proposedAt: number;
  focusStillInSection: boolean;
  now: number;
  foreignAt: number;
  triesLeft: number;
}): "drop" | "retry" | "spring" {
  if (input.proposedAt >= input.stepAt - REVEAL_BURST.proposalSlackMs || !input.focusStillInSection) return "drop";
  if (input.now - input.foreignAt < REVEAL_BURST.foreignMovingMs) return input.triesLeft > 0 ? "retry" : "drop";
  return "spring";
}

/** Le ressort borné : réponse ≥ 0,05 s, amortissement entre 0,1 et 1. */
export function revealSpringOf(response: number, damping: number): { response: number; damping: number } {
  return { response: Math.max(0.05, response), damping: Math.min(1, Math.max(0.1, damping)) };
}

/**
 * Le ressort à `t` secondes de son départ : l'écart `x` à la cible et la
 * vitesse `v` (points/s), depuis l'écart `x0` et la vitesse `v0`. Critique à
 * amortissement 1 (`TV_MOTION.spring.scroll`), sinon sous-amorti.
 */
export function springAt(t: number, x0: number, v0: number, response: number, damping: number): { x: number; v: number } {
  const omega = (2 * Math.PI) / response;
  if (damping >= 0.999) {
    const c = v0 + omega * x0;
    const decay = Math.exp(-omega * t);
    return { x: decay * (x0 + c * t), v: decay * (v0 - omega * c * t) };
  }
  const a = damping * omega;
  const b = omega * Math.sqrt(1 - damping * damping);
  const B = (v0 + a * x0) / b;
  const decay = Math.exp(-a * t);
  return {
    x: decay * (x0 * Math.cos(b * t) + B * Math.sin(b * t)),
    v: decay * (v0 * Math.cos(b * t) - (a * B + b * x0) * Math.sin(b * t)),
  };
}

/** Le ressort est arrivé : moins d'un demi-point de la cible, et lent. */
export function springSettled(x: number, v: number): boolean {
  return Math.abs(x) < 0.5 && Math.abs(v) < 8;
}

/**
 * Aller à `target` : `jump` (se poser — « Réduire les animations »), `spring`
 * (partir, ou repartir en vol avec sa vitesse), ou `none` (déjà là, ou déjà en
 * route vers là).
 */
export function revealMove(input: { reducedMotion: boolean; moving: boolean; target: number; movingTarget: number; offset: number }): "jump" | "spring" | "none" {
  const { reducedMotion, moving, target, movingTarget, offset } = input;
  if (reducedMotion) return Math.abs(target - offset) >= 0.5 ? "jump" : "none";
  if (moving && Math.abs(target - movingTarget) < 0.5) return "none";
  if (!moving && Math.abs(target - offset) < 0.5) return "none";
  return "spring";
}
