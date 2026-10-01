import { SCRUB_TIERS } from "./scrubMachine";

/**
 * Le maintien d'une flèche, et sa montée en vitesse.
 *
 * **Deux gestes, deux réponses.** On tape : c'est un saut sec de −10 ou +30,
 * la lecture continue, rien n'attend de confirmation — le geste des boutons de
 * la rangée. On tient : le curseur fantôme part et accélère, et c'est le seul
 * moyen de traverser un épisode sans cent appuis. Tout le travail de ce module
 * est de dire lequel des deux on est en train de faire, à partir d'un flux
 * d'événements où rien ne le déclare.
 *
 * **Le débit ne doit pas dépendre de la dalle.** La version précédente avançait
 * d'un pas à chaque répétition clavier et montait d'un palier tous les six
 * appuis. Or la cadence d'auto-répétition d'un téléviseur LG n'est ni
 * documentée ni constante d'un modèle à l'autre : le même maintien couvrait
 * deux minutes ici, six là. L'Apple TV n'a pas ce problème parce qu'elle ne
 * compte pas les répétitions — elle tient son propre tic de 250 ms, et le
 * palier monte d'un cran par seconde. C'est ce modèle qui est transposé ici.
 *
 * Les répétitions ne servent donc plus qu'à deux choses : prouver que la touche
 * est toujours enfoncée, et mesurer l'intervalle du modèle.
 *
 * **Pourquoi on mesure ce que l'Apple TV peut supposer.** `keyup` n'est pas
 * garanti sur toutes les dalles — c'est le constat que partagent déjà
 * `appuiLong.ts` et `verrouTouche.ts`, qui en déduisent le relâchement d'un
 * silence de 700 ms. Reprendre tel quel le seuil de 350 ms de l'Apple TV
 * casserait le maintien sur une dalle dont la répétition est plus lente que
 * cela ; garder 700 ms laisserait le curseur filer près de trois tics après le
 * relâchement. On part donc de 700 ms, et on resserre dès que deux répétitions
 * ont donné l'intervalle réel — sans jamais descendre sous les 350 ms de
 * l'Apple TV, ni monter au-dessus des 700 ms du reste du portage.
 *
 * Module pur : horloge et minuteurs viennent de l'appelant en test.
 */

import {
  AUTO_REPEAT_MS, HOLD_ANNOUNCED_MAX_MS, HOLD_TICK_MS, MIN_INTERVAL_MS, MS_PER_TIER, REPEAT_INTERVAL_MS,
  REPEATS_BEFORE_TICK, SILENCE_DEFAULT_MS, SILENCE_FACTOR, SILENCE_MIN_MS,
} from "./holdTiming";

/** Les rythmes publics du moteur, à leur adresse d'avant. */
export { HOLD_ANNOUNCED_MAX_MS, HOLD_TICK_MS, MS_PER_TIER, REPEATS_BEFORE_TICK, SILENCE_DEFAULT_MS, SILENCE_MIN_MS };

export interface HoldMotorOptions {
  /**
   * Un GESTE : appui simple, ou répétition tant que le maintien n'a pas pris.
   *
   * C'est un saut sec — la lecture continue, rien ne se met en pause, rien
   * n'attend de confirmation. Ce que fait le bouton « −10 » ou « +30 » de la
   * rangée, et ce qu'on attend d'une flèche qu'on tape.
   */
  jump: (sign: 1 | -1) => void;
  /** Un tic de MAINTIEN : le déplacement dans le flux, avec son palier. */
  advance: (sign: 1 | -1, tier: number) => void;
  /** Horloge, injectable pour les tests. */
  now?: () => number;
}

export interface HoldMotor {
  /**
   * Un `keydown` directionnel. Le premier saute, les suivants tiennent.
   *
   * @param repeat `KeyboardEvent.repeat` — la touche est TENUE, le
   * navigateur le dit. C'est le seul signal qui ne dépende d'aucune cadence, et
   * donc le seul qui vaille sur une dalle dont la vitesse d'auto-répétition
   * n'est ni documentée ni constante d'un modèle à l'autre.
   */
  press: (code: number, sign: 1 | -1, repeat?: boolean) => void;
  /**
   * Un maintien ANNONCÉ — la télécommande d'Apple TV dit son début (l'appui
   * long reconnu, à une demi-seconde) et sa fin, mais ne répète RIEN entre les
   * deux. Le tic part aussitôt, sans le chien de garde de silence, qui coupait
   * un tel maintien au bout de 0,7 s (+3:00, puis plus rien) ; il s'arrête à
   * `release(code)`, ou au plafond `HOLD_ANNOUNCED_MAX_MS`.
   */
  hold: (code: number, sign: 1 | -1) => void;
  /**
   * Un `keyup`, quand la dalle en émet — et SEULEMENT celui de la touche tenue.
   *
   * Le relâchement était jusqu'ici aveugle au code : le `keyup` d'OK, de Retour
   * ou de n'importe quelle autre touche coupait un maintien de flèche encore
   * enfoncée. Deux touches se croisent plus souvent qu'on ne croit — la Magic
   * Remote a un bouton central, et l'on tient volontiers une flèche en cliquant.
   */
  release: (code: number) => void;
  /**
   * Rupture franche, sans passer par un code : le mode du lecteur a changé.
   *
   * Un maintien ne traverse pas une frontière de mode. Sans cela, une flèche
   * tenue pendant que l'habillage s'éteint reprenait de l'autre côté comme un
   * appui neuf — et un tic survivant à une confirmation de déplacement
   * ressuscitait le déplacement qu'on venait de valider.
   */
  cancel: () => void;
  destroy: () => void;
}

export function createHoldMotor(options: HoldMotorOptions): HoldMotor {
  const clock = options.now ?? (() => Date.now());

  let lastCode = 0;
  let lastAt = 0;
  let currentSign: 1 | -1 = 1;

  /** Répétitions consécutives de la même touche, remis à zéro à chaque geste. */
  let repeats = 0;

  /** Instant d'engagement du maintien, ou `null` tant qu'on est en appui simple. */
  let holdStartedAt: number | null = null;
  let interval = 0;
  let tick: ReturnType<typeof setInterval> | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  function silenceThreshold(): number {
    if (interval <= 0) return SILENCE_DEFAULT_MS;
    const measured = Math.round(interval * SILENCE_FACTOR);
    return Math.min(SILENCE_DEFAULT_MS, Math.max(SILENCE_MIN_MS, measured));
  }

  function tier(): number {
    if (holdStartedAt === null) return SCRUB_TIERS[0];
    const held = clock() - holdStartedAt;
    const rank = Math.min(Math.floor(held / MS_PER_TIER), SCRUB_TIERS.length - 1);
    return SCRUB_TIERS[Math.max(0, rank)];
  }

  function armWatchdog(): void {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = setTimeout(stopHold, silenceThreshold());
  }

  function stopHold(): void {
    if (tick !== null) {
      clearInterval(tick);
      tick = null;
    }
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
    holdStartedAt = null;
  }

  function engage(at: number): void {
    holdStartedAt = at;
    // Le tic possède l'avance à partir d'ici : les répétitions qui suivent ne
    // font plus que tenir la veille. C'est ce qui rend le débit indépendant de
    // la cadence de la dalle.
    tick = setInterval(() => options.advance(currentSign, tier()), HOLD_TICK_MS);
  }

  function press(code: number, sign: 1 | -1, repeat = false): void {
    const at = clock();
    // Ce qui qualifie une répétition est la CADENCE, pas le silence. Le seuil
    // de silence dit quand un maintien s'arrête ; s'en servir aussi pour dire
    // ce qui l'a commencé faisait passer deux appuis distincts pour un
    // maintien, et deux sauts pour une avance rapide.
    // `repeat` l'emporte sur toute mesure de temps : le navigateur dit que
    // la touche est TENUE, et aucun seuil ne saurait le dire mieux. Sans lui,
    // une dalle qui répète plus lentement que le seuil ne produisait jamais
    // d'enchaînement : chaque battement retombait en « nouvel appui », donc en
    // saut, et le maintien ne donnait qu'une rafale de sauts — l'habillage
    // restait à l'écran faute d'entrer en déplacement, et la position bougeait
    // par bonds sans que rien n'ait été validé.
    const chained =
      code === lastCode &&
      sign === currentSign &&
      (repeat || at - lastAt <= REPEAT_INTERVAL_MS);

    if (!chained) {
      stopHold();
      interval = 0;
      repeats = 0;
      lastCode = code;
      currentSign = sign;
      lastAt = at;

      /**
       * Une RÉPÉTITION n'est jamais un nouvel appui.
       *
       * Elle peut pourtant arriver ici sans rien à quoi s'enchaîner : quand
       * l'appui initial a été absorbé ailleurs — l'arbitre le retient le temps
       * de voir si un second suit —, le moteur n'en a jamais entendu parler et
       * `lastCode` vaut zéro. La traiter comme un appui neuf faisait sauter
       * de trente secondes au premier battement d'un maintien, sans que rien
       * n'ait été demandé. On engage donc directement : la touche est tenue,
       * c'est un déplacement qui commence.
       */
      if (repeat) {
        engage(at);
        armWatchdog();
        return;
      }

      // Nouvel appui : un saut sec, sans accélération et sans mode. C'est la
      // seule façon de viser une position précise, et c'est ce qu'on attend
      // d'une flèche qu'on tape.
      options.jump(sign);
      return;
    }

    const measured = at - lastAt;
    if (measured >= MIN_INTERVAL_MS) {
      interval = interval > 0 ? Math.min(interval, measured) : measured;
    }
    lastAt = at;
    repeats += 1;

    if (holdStartedAt === null) {
      // Une touche que le navigateur déclare tenue, ou une cadence de dalle, ne
      // laissent aucun doute : on engage sans attendre. Un écart plus large peut
      // venir d'un doigt — on lui laisse le bénéfice du doute, et un saut,
      // jusqu'à ce qu'il insiste.
      if (repeat || measured <= AUTO_REPEAT_MS || repeats >= REPEATS_BEFORE_TICK) {
        // Le battement qui engage ne saute PAS : il passe la main au curseur,
        // et un saut de plus déplacerait le point d'où celui-ci part.
        engage(at);
      } else {
        // Sans cela, deux appuis rapprochés ne produiraient qu'un seul saut.
        options.jump(sign);
      }
    }
    armWatchdog();
  }

  function hold(code: number, sign: 1 | -1): void {
    stopHold();
    interval = 0;
    repeats = 0;
    lastCode = code;
    currentSign = sign;
    lastAt = clock();
    engage(lastAt);
    // Rien ne répète : pas de veille de silence, le plafond seul.
    watchdog = setTimeout(stopHold, HOLD_ANNOUNCED_MAX_MS);
  }

  function cancel(): void {
    stopHold();
    lastCode = 0;
    lastAt = 0;
    interval = 0;
    repeats = 0;
  }

  function release(code: number): void {
    // Aucun maintien en cours, ou le `keyup` d'une autre touche : on ne touche
    // à rien. `lastCode` vaut zéro tant que rien n'est tenu, et aucun code
    // de touche ne vaut zéro.
    if (code !== lastCode) return;
    cancel();
  }

  return {
    press,
    hold,
    release,
    cancel,
    destroy: stopHold,
  };
}
