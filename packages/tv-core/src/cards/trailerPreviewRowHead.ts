/**
 * La carte en aperçu passe EN TÊTE de sa rangée (Apple TV, Android TV) —
 * demande du 16/10 : dès que l'aperçu démarre (la grande carte a sa première
 * image), la rangée défile pour que CETTE carte prenne la place de la
 * première, au retrait de la rangée. L'aperçu se montre ainsi toujours le plus
 * à gauche possible. On passe à la suivante et on attend : quand son aperçu
 * démarre, elle passe en tête à son tour.
 *
 * Rien ne bouge AVANT : un parcours de carte en carte ne fait pas sauter la
 * rangée (seul `expand` défile). Le repli (le focus passe à la voisine) ne
 * bouge rien non plus : la place posée au bout de la piste reste tant que le
 * focus est dans la rangée — sinon la piste raccourcirait sous la voisine.
 *
 * En bout de rangée, la carte ne peut plus passer en tête : la BUTÉE — la
 * rangée s'arrête à son bout, la grande carte finit à la marge de droite.
 * (Choix de Damien du 16/10, entre la butée et un dépassement au-delà du bout,
 * qui laissait du vide à droite.)
 *
 * Quand le focus QUITTE la rangée (après une courte grâce : un pas d'une
 * carte à sa voisine passe par un instant sans focus), elle RESTE où l'aperçu
 * l'a laissée — la règle 1 de `focus/rowRewind.ts` : une rangée garde sa
 * position tant qu'elle est à l'écran ; seul un vide au-delà de son bout se
 * referme, puis la place posée au bout s'en va. (Choix de Damien : « revenir
 * avant les aperçus » faisait perdre la carte au retour par HAUT.)
 *
 * Le passage en tête se joue AVEC la grande carte (`motion: "withPreview"`) :
 * le même ressort que sa croissance, image par image. En butée, le bord droit
 * de la grande carte reste alors où était celui de la carte — elle grandit
 * vers la GAUCHE, ses voisines de gauche glissent ; jamais elle ne dépasse de
 * l'écran le temps du mouvement. Le retour au départ du focus, lui, est un
 * défilement ordinaire (`plain`).
 *
 * Le REPLI d'une carte quand le focus est passé à sa droite (DROITE vers la
 * suivante), la rangée étant au-delà de son bout naturel (la butée) :
 * sans rien faire, la voisine glisserait à gauche et laisserait un VIDE à sa
 * droite jusqu'à son propre aperçu (constat du Testeur A, 16/10). La rangée
 * recule alors exactement de ce que la carte rend, au rythme de son repli
 * (`motion: "withCollapse"`) : la carte focalisée ne bouge pas, la carte
 * repliée rétrécit vers la droite, et le vide ne paraît jamais.
 *
 * Module pur, horloge injectée (`at`) : la rangée annonce le focus, l'aperçu
 * et l'heure (`nextRowHeadDeadline` → `tick`) ; elle applique le défilement
 * (`scrollTo`) et la place (`trailing` : un retrait à droite de la piste,
 * au-delà de sa marge). La place doit être posée AVANT de défiler — la piste
 * borne sinon le défilement à son contenu d'avant : elle l'est dès le FOCUS
 * d'une carte de bout de rangée quand la rangée connaît déjà la largeur de sa
 * grande carte (`tileWidth`, vue à un aperçu précédent), sinon à l'aperçu.
 */

/** La rangée, en points de la scène : cartes de largeur égale. */
export interface RowHeadGeometry {
  cardCount: number;
  cardWidth: number;
  gap: number;
  /** Le retrait gauche de la rangée : là où commence sa première carte, la TÊTE. */
  inset: number;
  /** La largeur visible de la rangée (l'écran). */
  viewportWidth: number;
  /** La marge de droite que rien de focalisable ne dépasse (le retrait droit de la piste). */
  rightMargin: number;
}

/** Ce que la rangée sait au moment de l'évènement : sa géométrie, son défilement. */
export interface RowHeadContext extends RowHeadGeometry {
  scrollX: number;
}

export interface RowHeadState {
  /** La carte focalisée de la rangée, ou `null`. */
  focused: number | null;
  /** La place posée au bout de la piste, au-delà de sa marge. */
  trailing: number;
  /** Le focus est parti : la rangée le constate à cette heure (la grâce). */
  leaveAt: number | null;
  /** Le retour fini : la place posée s'en va à cette heure. */
  releaseAt: number | null;
}

export const INITIAL_ROW_HEAD: RowHeadState = { focused: null, trailing: 0, leaveAt: null, releaseAt: null };

export type RowHeadEvent =
  /** `tileWidth` : la largeur de la grande carte, si la rangée la connaît déjà — la place se pose d'avance. */
  | { type: "focus"; index: number; at: number; tileWidth?: number }
  | { type: "blur"; index: number; at: number }
  /** L'aperçu de la carte démarre : sa grande carte, de cette largeur, grandit. */
  | { type: "expand"; index: number; tileWidth: number; at: number }
  /** La grande carte de la carte `index`, de cette largeur, se replie. */
  | { type: "collapse"; index: number; tileWidth: number; at: number }
  | { type: "tick"; at: number }
  /** La rangée est remise au début (`rowRewind`, sans animation) : tout s'oublie. */
  | { type: "reset" };

/** Comment défiler : avec la croissance de la grande carte, avec son repli, ou un défilement ordinaire. */
export type RowHeadMotion = "withPreview" | "withCollapse" | "plain";

export interface RowHeadStep {
  state: RowHeadState;
  /** Où défiler, en un mouvement animé — `null` : rien ne bouge. */
  scrollTo: number | null;
  motion: RowHeadMotion;
}

/** La grâce entre la perte du focus et le constat qu'il a quitté la rangée. */
export const ROW_HEAD_LEAVE_GRACE_MS = 150;
/** La place posée s'en va après le défilement de retour (son animation). */
export const ROW_HEAD_RELEASE_MS = 500;

const pitchOf = (g: RowHeadGeometry) => g.cardWidth + g.gap;
const cardsWidthOf = (g: RowHeadGeometry) => g.cardCount * g.cardWidth + Math.max(0, g.cardCount - 1) * g.gap;
/** Le défilement le plus loin, la piste sans rien de posé au bout. */
const naturalEndOf = (g: RowHeadGeometry) => Math.max(0, g.inset + cardsWidthOf(g) + g.rightMargin - g.viewportWidth);

/**
 * Le défilement qui met la carte `index` en tête — ou, en bout de rangée, la
 * butée : le bout du contenu TEL QU'IL SERA une fois la carte grandie.
 */
export function rowHeadTarget(input: RowHeadGeometry & { index: number; tileWidth: number }): number {
  const head = input.index * pitchOf(input);
  const growth = Math.max(0, input.tileWidth - input.cardWidth);
  const grownEnd = Math.max(0, input.inset + cardsWidthOf(input) + growth + input.rightMargin - input.viewportWidth);
  return Math.min(head, grownEnd);
}

/** La place à poser au bout pour que la piste, ses cartes au repos, atteigne `scrollX`. */
export function rowHeadTrailing(input: RowHeadGeometry & { scrollX: number }): number {
  return Math.max(0, Math.ceil(input.scrollX + input.viewportWidth - (input.inset + cardsWidthOf(input) + input.rightMargin)));
}

const moveTo = (target: number, scrollX: number) => (Math.abs(target - scrollX) < 1 ? null : target);
const still = (state: RowHeadState): RowHeadStep => ({ state, scrollTo: null, motion: "plain" });
/** La place qu'il faut au bout pour mettre la carte `index` en tête (ou en butée). */
const trailingFor = (context: RowHeadContext, index: number, tileWidth: number) =>
  rowHeadTrailing({ ...context, scrollX: rowHeadTarget({ ...context, index, tileWidth }) });

export function reduceRowHead(state: RowHeadState, event: RowHeadEvent, context: RowHeadContext): RowHeadStep {
  switch (event.type) {
    case "focus": {
      const trailing = event.tileWidth === undefined ? state.trailing : Math.max(state.trailing, trailingFor(context, event.index, event.tileWidth));
      return still({ ...state, focused: event.index, trailing, leaveAt: null, releaseAt: null });
    }
    case "blur":
      if (state.focused !== event.index) return still(state);
      return still({ ...state, focused: null, leaveAt: event.at + ROW_HEAD_LEAVE_GRACE_MS });
    case "expand": {
      const target = rowHeadTarget({ ...context, index: event.index, tileWidth: event.tileWidth });
      const scrollTo = moveTo(target, context.scrollX);
      const trailing = Math.max(state.trailing, rowHeadTrailing({ ...context, scrollX: target }));
      const next = { ...state, focused: event.index, trailing, leaveAt: null, releaseAt: null };
      return { state: next, scrollTo, motion: "withPreview" };
    }
    case "collapse": {
      // Seulement quand le focus est passé à la DROITE de la carte qui se replie.
      if (state.focused === null || state.focused <= event.index) return still(state);
      const natural = naturalEndOf(context);
      if (context.scrollX <= natural + 1) return still(state);
      const growth = Math.max(0, event.tileWidth - context.cardWidth);
      const scrollTo = moveTo(Math.max(natural, context.scrollX - growth), context.scrollX);
      return scrollTo === null ? still(state) : { state, scrollTo, motion: "withCollapse" };
    }
    case "tick":
      return tick(state, event.at, context);
    case "reset":
      return still({ ...INITIAL_ROW_HEAD, focused: state.focused });
  }
}

function tick(state: RowHeadState, at: number, context: RowHeadContext): RowHeadStep {
  if (state.leaveAt !== null && at >= state.leaveAt) return leave({ ...state, leaveAt: null }, at, context);
  if (state.releaseAt !== null && at >= state.releaseAt) return still({ ...state, trailing: 0, releaseAt: null });
  return still(state);
}

/** Le focus a quitté la rangée : elle reste, seul un vide au-delà de son bout se referme. */
function leave(state: RowHeadState, at: number, context: RowHeadContext): RowHeadStep {
  const scrollTo = moveTo(Math.min(context.scrollX, naturalEndOf(context)), context.scrollX);
  // Rien à refermer à la vue : la place posée, hors de l'écran, s'en va aussitôt.
  if (scrollTo === null) return still({ ...state, trailing: 0, releaseAt: null });
  return { state: { ...state, releaseAt: state.trailing > 0 ? at + ROW_HEAD_RELEASE_MS : null }, scrollTo, motion: "plain" };
}

/** La prochaine heure à laquelle la rangée doit être réveillée (`tick`), ou `null`. */
export function nextRowHeadDeadline(state: RowHeadState): number | null {
  if (state.leaveAt !== null && state.releaseAt !== null) return Math.min(state.leaveAt, state.releaseAt);
  return state.leaveAt ?? state.releaseAt;
}
