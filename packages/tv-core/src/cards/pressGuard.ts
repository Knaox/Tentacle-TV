/**
 * La GARDE ANTI-CLIC FANTÔME d'un élément focalisable.
 *
 * Un panneau qui s'ouvre sous un OK encore enfoncé — le grand panneau d'une
 * carte (l'appui maintenu), la fenêtre des demandes, le menu d'une entrée du
 * rail, l'habillage du lecteur révélé par un OK — reçoit le RELÂCHEMENT d'un
 * appui qui n'a pas commencé sur lui. La règle : sur un élément gardé, un OK
 * ne compte que s'il a COMMENCÉ dessus (un appui vu depuis son dernier focus) ;
 * perdre le focus efface l'appui commencé ; chaque OK compté le consomme. Un
 * élément non gardé compte tout OK (et le consomme aussi).
 *
 * Une machine par élément ; le branchement lui passe l'appui (`pressIn`), le
 * flou (`blur`) et la validation (`press`).
 */

export interface PressGuard {
  /** OK enfoncé sur l'élément. */
  pressIn(): void;
  /**
   * L'élément perd le focus : un appui commencé ici ne validera plus plus
   * tard. Rend vrai s'il y en avait un — l'élément ne doit pas rester enfoncé.
   */
  blur(): boolean;
  /** OK validé sur l'élément : vrai s'il compte. Gardé, il exige un appui commencé ici. */
  press(guarded: boolean): boolean;
}

export function createPressGuard(): PressGuard {
  let pressedIn = false;
  return {
    pressIn() {
      pressedIn = true;
    },
    blur() {
      const was = pressedIn;
      pressedIn = false;
      return was;
    },
    press(guarded) {
      if (guarded && !pressedIn) return false;
      pressedIn = false;
      return true;
    },
  };
}
