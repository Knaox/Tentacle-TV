import type { PlayerMode } from "./playerState";

/**
 * À qui appartient une flèche horizontale, appui par appui.
 *
 * Trois réponses possibles, et le partage ne tient pas au mode seul :
 *
 * - **attendre** — habillage éteint, premier appui. Rien ne bouge : on ne veut
 *   pas qu'une touche effleurée dans le noir déplace la lecture. L'appelant
 *   arme alors le délai de `RELIGHT_DELAY_MS`, au terme duquel les commandes
 *   reviennent — à moins qu'un second appui n'arrive d'ici là, auquel cas c'est
 *   un saut qu'on demandait, et l'habillage n'a pas à paraître.
 * - **transport** — deuxième appui rapproché sur la même flèche, ou toute
 *   répétition d'une flèche déjà reconnue comme telle. Le saut part, et le
 *   maintien peut s'engager derrière.
 * - **focus** — tout le reste. Sous l'habillage, les flèches parcourent les
 *   boutons ; c'est leur emploi par défaut dès lors que quelque chose est à
 *   l'écran.
 *
 * **Pourquoi un module à part.** Le partage se décide sur trois informations
 * qui ne vivent pas au même endroit — le mode, le code de touche, et l'instant
 * du dernier appui — et il se vérifie mal à l'œil : un double appui trop lent
 * ne se distingue d'un appui isolé que par des millisecondes. Le sortir de
 * l'arbitre des touches le rend testable sans DOM ni horloge réelle.
 */

export type ArrowOwner = "attendre" | "transport" | "focus";

/**
 * Le temps qu'on laisse au second appui avant de ramener les commandes.
 *
 * Sans lui, le premier appui allumait l'habillage AVANT que le second n'arrive :
 * un double appui pour sauter faisait donc paraître les commandes au passage,
 * puisqu'on ne peut pas ne pas cliquer une première fois.
 *
 * **Pourquoi il a fallu l'allonger.** Un maintien commence lui aussi par un
 * appui, et la première répétition — le seul signal qui dise qu'on TIENT — met
 * environ une demi-seconde à venir sur une dalle. À trois cents millisecondes,
 * le délai expirait le premier : l'habillage paraissait, puis l'avance rapide
 * démarrait par-dessus. Quatre cent cinquante passent devant ce battement
 * initial sans qu'un appui isolé ait l'air de rester sans réponse.
 */
export const RELIGHT_DELAY_MS = 450;

/**
 * Fenêtre du double appui.
 *
 * Assez large pour un geste à la télécommande, où les touches ont de la course
 * et où l'on vise à trois mètres ; assez courte pour qu'un appui isolé suivi
 * d'une navigation ne soit pas pris pour un double.
 */
export const DOUBLE_PRESS_WINDOW_MS = 700;

export interface ArbiterOptions {
  /** Horloge, injectable pour les tests. */
  now?: () => number;
}

export interface ArrowArbiter {
  /**
   * @param repeat `KeyboardEvent.repeat` — la touche est TENUE, le
   * navigateur le dit lui-même. C'est le seul signal qui ne dépende ni d'une
   * cadence ni d'une fenêtre de temps, et donc le seul qui tienne quel que soit
   * le délai d'auto-répétition de la dalle.
   */
  decide: (code: number, mode: PlayerMode, repeat?: boolean) => ArrowOwner;
  /** Un `keyup` : la flèche cesse de piloter le transport. */
  release: (code: number) => void;
  /** Rupture franche — démontage, changement de mode subi. */
  forget: () => void;
}

export function createArrowArbiter(options: ArbiterOptions = {}): ArrowArbiter {
  const clock = options.now ?? (() => Date.now());

  /** La flèche qui vient de rallumer l'habillage, et quand. */
  let primed = 0;
  let primedAt = 0;

  /**
   * La flèche qu'on a laissée passer au transport, jusqu'à son relâchement.
   *
   * Sans elle, un maintien serait relu à chaque répétition et retomberait sur
   * « focus » dès que la fenêtre du double appui aurait expiré — l'avance
   * rapide s'arrêterait au bout de sept cents millisecondes.
   */
  let transport = 0;

  function decide(code: number, mode: PlayerMode, repeat = false): ArrowOwner {
    // En déplacement, tout appartient au curseur : c'est le mode qui l'a
    // demandé, et il n'y a rien d'autre à viser.
    if (mode === "scrub") {
      transport = code;
      return "transport";
    }

    /**
     * Une touche TENUE va au transport, sans autre condition.
     *
     * Le maintien passait jusqu'ici par la fenêtre du double appui, ce qui le
     * rendait tributaire du délai d'auto-répétition de la dalle — ni documenté
     * ni constant d'un modèle à l'autre. Trop long, la première répétition
     * arrivait hors fenêtre : on obtenait l'habillage au lieu de l'avance
     * rapide. `repeat` tranche la question à la source, et rend le geste
     * indépendant de l'appareil.
     */
    if (repeat) {
      transport = code;
      return "transport";
    }

    if (mode === "repos") {
      // Habillage éteint. Un second appui sur la MÊME flèche, arrivé pendant
      // qu'on attendait, est un saut — et il ne doit pas faire paraître les
      // commandes au passage.
      const chained = code === primed && clock() - primedAt <= DOUBLE_PRESS_WINDOW_MS;
      primed = code;
      primedAt = clock();
      if (!chained) {
        transport = 0;
        return "attendre";
      }
      transport = code;
      return "transport";
    }

    // Habillage à l'écran.
    if (code === transport) return "transport";

    const doublePress = code === primed && clock() - primedAt <= DOUBLE_PRESS_WINDOW_MS;
    if (!doublePress) return "focus";

    transport = code;
    // Ré-armé plutôt que consommé : trois appuis d'affilée doivent faire deux
    // sauts, pas un saut puis un déplacement de focus.
    primedAt = clock();
    return "transport";
  }

  function release(code: number): void {
    if (code === transport) transport = 0;
  }

  function forget(): void {
    primed = 0;
    primedAt = 0;
    transport = 0;
  }

  return { decide, release, forget };
}
