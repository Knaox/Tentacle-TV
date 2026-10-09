/**
 * Le titre de la fenêtre PiP, selon son mode.
 *
 * C'est par lui, et par lui seul, que la colle KWin reconnaît la fenêtre que la
 * vidéo doit suivre (`linux/glueQml/pipQml.ts`) : la coquille ne parle à la
 * colle qu'en posant des états de fenêtre qu'elle observe. Changer le titre
 * bascule le mode. ⚠️ Jamais traduit : c'est un identifiant entre deux
 * processus, pas un texte — et il ne se voit nulle part, la colle retirant la
 * fenêtre de la barre des tâches et d'Alt+Tab.
 */
export const PIP_CAPTIONS = {
  /** Au-dessus de tout, déplaçable sur tout le bureau — comme le PiP d'un navigateur. */
  floating: "Tentacle TV · Picture-in-Picture",
  /** Dans le coin bas-droit de l'application, qu'il suit. */
  docked: "Tentacle TV · Mini player",
} as const;

export type PipMode = keyof typeof PIP_CAPTIONS;

/**
 * La marge du PiP au bord de l'écran (flottant) ou de l'application (ancré),
 * en points logiques : celle du PiP natif de KDE (`PictureInPictureMargin`,
 * 20 par défaut dans kwin.kcfg).
 */
export const PIP_MARGIN = 20;
