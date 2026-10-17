import { reduceRowHead, rowHeadTrailing, type RowHeadContext, type RowHeadEvent, type RowHeadGeometry, type RowHeadState, type RowHeadStep } from "./trailerPreviewRowHead";

/**
 * Une ligne de GRILLE qui TOURNE (Apple TV, Android TV) — choix de Damien du
 * 17/10 (« option C partout sur tvOS »), entre la butée de l'accueil (les 4e et
 * 5e affiches d'une ligne de 6 restaient au milieu) et un défilement jusqu'en
 * tête qui laissait un vide à droite.
 *
 * La carte dont l'aperçu démarre passe TOUJOURS en tête, collée à la
 * navigation : la ligne défile de sa place entière. La place qu'il faut au
 * bout (`trailing`, la même que celle des rangées) n'est plus vide : la vue la
 * remplit des REPRISES — le début de la même ligne, dans l'ordre, atténué et
 * non focalisable (`gridLineReprises`). Jamais un titre d'une autre ligne.
 * DROITE s'arrête toujours à la vraie dernière affiche.
 *
 * Deux exceptions, où la règle des rangées reprend la main
 * (`trailerPreviewRowHead.ts`, sans rien recopier) :
 * - la DERNIÈRE affiche reste en butée, sa grande carte finit à la marge
 *   droite (le bout de la ligne, ce qui suit n'est pas à elle) ;
 * - une ligne qui ne remplit pas l'écran (la dernière, incomplète) : sa grande
 *   carte y tient, rien ne défile.
 *
 * Le repli d'une carte quand le focus passe à sa droite ne fait plus reculer
 * la ligne : la place est remplie, aucun vide à refermer — la voisine glisse
 * d'elle-même à côté de la tête, et son aperçu la mettra en tête à son tour.
 * Le focus parti, la ligne revient à sa première colonne (bout naturel 0),
 * puis la place s'en va avec ses reprises.
 */

const pitchOf = (g: RowHeadGeometry) => g.cardWidth + g.gap;
const still = (state: RowHeadState): RowHeadStep => ({ state, scrollTo: null, motion: "plain" });

/** La ligne remplit l'écran (à un écart près) : elle peut tourner. */
export function gridLineTurns(g: RowHeadGeometry): boolean {
  const cards = g.cardCount * g.cardWidth + Math.max(0, g.cardCount - 1) * g.gap;
  return g.cardCount > 1 && g.inset + cards + g.gap + g.rightMargin >= g.viewportWidth - 1;
}

/** La carte `index` tourne en tête (sinon, la règle des rangées). */
const turnsAt = (g: RowHeadGeometry, index: number) => index < g.cardCount - 1 && gridLineTurns(g);

/** La place au bout pour mettre la carte `index` en tête, ses cartes au repos. */
const headTrailing = (context: RowHeadContext, index: number) => rowHeadTrailing({ ...context, scrollX: index * pitchOf(context) });

export function reduceGridLine(state: RowHeadState, event: RowHeadEvent, context: RowHeadContext): RowHeadStep {
  switch (event.type) {
    case "expand": {
      if (!turnsAt(context, event.index)) return reduceRowHead(state, event, context);
      const target = event.index * pitchOf(context);
      const trailing = Math.max(state.trailing, headTrailing(context, event.index));
      const next = { ...state, focused: event.index, trailing, leaveAt: null, releaseAt: null };
      return { state: next, scrollTo: Math.abs(target - context.scrollX) < 1 ? null : target, motion: "withPreview" };
    }
    case "focus": {
      if (event.tileWidth === undefined || !turnsAt(context, event.index)) return reduceRowHead(state, event, context);
      // La place se pose d'avance : la piste pourra défiler dès l'aperçu.
      const trailing = Math.max(state.trailing, headTrailing(context, event.index));
      return still({ ...state, focused: event.index, trailing, leaveAt: null, releaseAt: null });
    }
    case "collapse":
      // Une ligne qui tourne n'a pas de vide à refermer ; en butée (la dernière), la règle des rangées.
      return turnsAt(context, event.index) ? still(state) : reduceRowHead(state, event, context);
    default:
      return reduceRowHead(state, event, context);
  }
}

/**
 * Les REPRISES qui remplissent la place au bout : combien, et quelles
 * affiches de la ligne (son début, dans l'ordre, en boucle si la place est
 * plus longue que la ligne).
 */
export function gridLineReprises(trailing: number, cardCount: number, pitch: number): number[] {
  if (trailing <= 0 || cardCount <= 0 || pitch <= 0) return [];
  return Array.from({ length: Math.ceil(trailing / pitch) }, (_, i) => i % cardCount);
}
