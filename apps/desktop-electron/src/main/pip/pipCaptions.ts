/**
 * Le titre de la fenêtre PiP, selon son mode — et le geste en cours.
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
 * Le geste que la page mène sur le PiP, et que la COLLE exécute : glisser la
 * fenêtre, ou la redimensionner par un coin. Pourquoi pas `app-region: drag` :
 * au-dessus d'une telle zone, Electron ne transmet plus RIEN à la page — ni
 * survol, ni molette, ni double-clic, et un `mouseleave` dès qu'on y entre
 * (banc du 09.10.2026). La page garde donc toute la souris et annonce le
 * geste ; la colle, qui connaît le curseur et place les fenêtres, le suit.
 */
export const PIP_GESTURES = ["move", "top-left", "top-right", "bottom-left", "bottom-right"] as const;

export type PipGesture = (typeof PIP_GESTURES)[number];

/** Ce qui sépare le titre du mode du geste en cours : `<titre> [<geste>]`. */
export const PIP_GESTURE_OPEN = " [";
export const PIP_GESTURE_CLOSE = "]";

/** Un point de la fenêtre PiP, en points logiques depuis son coin haut-gauche. */
export interface PipPoint {
  x: number;
  y: number;
}

/**
 * Le titre que la colle lit : celui du mode, suivi du geste s'il y en a un.
 * Glisser porte le point SAISI (`[move 162 102]`) : la colle garde ce point
 * sous le curseur. Sans lui, la fenêtre partait avec le retard du seuil et de
 * l'aller-retour vers la colle — une vingtaine de points (banc du 09.10.2026).
 */
export function pipCaption(mode: PipMode, gesture: PipGesture | null, grab?: PipPoint): string {
  if (gesture === null) return PIP_CAPTIONS[mode];
  const at = gesture === "move" && grab !== undefined ? ` ${String(Math.round(grab.x))} ${String(Math.round(grab.y))}` : "";
  return `${PIP_CAPTIONS[mode]}${PIP_GESTURE_OPEN}${gesture}${at}${PIP_GESTURE_CLOSE}`;
}

/**
 * La marge du PiP au bord de l'écran (flottant) ou de l'application (ancré),
 * en points logiques, mesurée au cadre VISIBLE (ombre exclue) : celle du PiP
 * natif de KDE (`PictureInPictureMargin`, 20 par défaut dans kwin.kcfg).
 */
export const PIP_MARGIN = 20;
