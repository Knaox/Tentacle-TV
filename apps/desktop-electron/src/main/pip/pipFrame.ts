/**
 * Le cadre du PiP : ce qui entoure la vidéo dans la fenêtre PiP.
 *
 * La vidéo est la fenêtre de mpv, collée SOUS la fenêtre PiP transparente : la
 * page ne peut pas en arrondir les coins — rien ne rend le bureau à travers une
 * fenêtre opaque. La fenêtre PiP déborde donc de la vidéo, de chaque côté :
 *
 * - d'un LISERÉ opaque (`bezel`), qui recouvre les coins carrés de mpv et en
 *   dessine des arrondis. Il doit valoir au moins 0,293 fois le rayon extérieur
 *   — `1 - 1/√2`, la flèche d'un quart de cercle —, sans quoi la pointe du coin
 *   de mpv dépasse de l'arrondi ;
 * - d'une marge TRANSPARENTE (`shadow`), où la page pose l'ombre du cadre.
 *   Electron 43 ne sait pas limiter la zone de saisie d'une fenêtre sous
 *   Wayland (`setShape` sans effet, banc du 09.10.2026) : cette marge capte la
 *   souris. Elle reste donc étroite, et la page en fait les poignées des coins.
 *
 * La colle place la vidéo à `inset` du bord de la fenêtre ; la page reçoit ces
 * valeurs par `pip_open` et y dessine son cadre — une seule source.
 */

export interface PipFrame {
  shadow: number;
  bezel: number;
}

export const PIP_FRAME: PipFrame = { shadow: 14, bezel: 4 };

/** De la fenêtre PiP à la vidéo, de chaque côté. */
export const PIP_INSET = PIP_FRAME.shadow + PIP_FRAME.bezel;

/** En deçà, les boutons du PiP ne tiennent plus — taille de la VIDÉO. */
export const PIP_MIN_WIDTH = 256;
export const PIP_MIN_HEIGHT = 144;

/**
 * La plus grande largeur de vidéo, en part de l'écran (flottant) ou de la zone
 * client de l'application (ancré) — les bornes de la page (`pipGeometry.ts`),
 * que la colle applique aux poignées.
 */
export const PIP_MAX_SHARE = { floating: 0.6, docked: 0.45 } as const;

/** La taille de la fenêtre PiP pour une vidéo de cette taille. */
export function pipWindowSize(videoWidth: number, videoHeight: number): { width: number; height: number } {
  return {
    width: Math.max(PIP_MIN_WIDTH, Math.round(videoWidth)) + 2 * PIP_INSET,
    height: Math.max(PIP_MIN_HEIGHT, Math.round(videoHeight)) + 2 * PIP_INSET,
  };
}
