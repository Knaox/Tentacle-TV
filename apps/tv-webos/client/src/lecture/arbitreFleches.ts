import type { ModeLecteur } from "./etatLecteurTv";

/**
 * À qui appartient une flèche horizontale, appui par appui.
 *
 * Trois réponses possibles, et le partage ne tient pas au mode seul :
 *
 * - **attendre** — habillage éteint, premier appui. Rien ne bouge : on ne veut
 *   pas qu'une touche effleurée dans le noir déplace la lecture. L'appelant
 *   arme alors le délai de `DELAI_RALLUMAGE_MS`, au terme duquel les commandes
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

export type ProprietaireFleche = "attendre" | "transport" | "focus";

/**
 * Le temps qu'on laisse au second appui avant de ramener les commandes.
 *
 * Sans lui, le premier appui allumait l'habillage AVANT que le second n'arrive :
 * un double appui pour sauter faisait donc paraître les commandes au passage,
 * puisqu'on ne peut pas ne pas cliquer une première fois. Trois cents
 * millisecondes suffisent à distinguer les deux gestes, et c'est assez court
 * pour qu'un appui isolé n'ait pas l'air de rester sans réponse.
 */
export const DELAI_RALLUMAGE_MS = 300;

/**
 * Fenêtre du double appui.
 *
 * Assez large pour un geste à la télécommande, où les touches ont de la course
 * et où l'on vise à trois mètres ; assez courte pour qu'un appui isolé suivi
 * d'une navigation ne soit pas pris pour un double.
 */
export const FENETRE_DOUBLE_MS = 700;

export interface OptionsArbitre {
  /** Horloge, injectable pour les tests. */
  maintenant?: () => number;
}

export interface ArbitreFleches {
  decider: (code: number, mode: ModeLecteur) => ProprietaireFleche;
  /** Un `keyup` : la flèche cesse de piloter le transport. */
  relacher: (code: number) => void;
  /** Rupture franche — démontage, changement de mode subi. */
  oublier: () => void;
}

export function creerArbitreFleches(options: OptionsArbitre = {}): ArbitreFleches {
  const horloge = options.maintenant ?? (() => Date.now());

  /** La flèche qui vient de rallumer l'habillage, et quand. */
  let amorce = 0;
  let instantAmorce = 0;

  /**
   * La flèche qu'on a laissée passer au transport, jusqu'à son relâchement.
   *
   * Sans elle, un maintien serait relu à chaque répétition et retomberait sur
   * « focus » dès que la fenêtre du double appui aurait expiré — l'avance
   * rapide s'arrêterait au bout de sept cents millisecondes.
   */
  let transport = 0;

  function decider(code: number, mode: ModeLecteur): ProprietaireFleche {
    // En déplacement, tout appartient au curseur : c'est le mode qui l'a
    // demandé, et il n'y a rien d'autre à viser.
    if (mode === "scrub") {
      transport = code;
      return "transport";
    }

    if (mode === "repos") {
      // Habillage éteint. Un second appui sur la MÊME flèche, arrivé pendant
      // qu'on attendait, est un saut — et il ne doit pas faire paraître les
      // commandes au passage.
      const suite = code === amorce && horloge() - instantAmorce <= FENETRE_DOUBLE_MS;
      amorce = code;
      instantAmorce = horloge();
      if (!suite) {
        transport = 0;
        return "attendre";
      }
      transport = code;
      return "transport";
    }

    // Habillage à l'écran.
    if (code === transport) return "transport";

    const doubleAppui = code === amorce && horloge() - instantAmorce <= FENETRE_DOUBLE_MS;
    if (!doubleAppui) return "focus";

    transport = code;
    // Ré-armé plutôt que consommé : trois appuis d'affilée doivent faire deux
    // sauts, pas un saut puis un déplacement de focus.
    instantAmorce = horloge();
    return "transport";
  }

  function relacher(code: number): void {
    if (code === transport) transport = 0;
  }

  function oublier(): void {
    amorce = 0;
    instantAmorce = 0;
    transport = 0;
  }

  return { decider, relacher, oublier };
}
