/**
 * Les RANGÉES qui REVIENNENT AU DÉBUT — le mode « mixte » choisi par
 * l'utilisateur (2026-10-04) pour les carrousels d'une page du rail (l'accueil,
 * « Pour vous ») :
 *
 * 1. une rangée GARDE sa position tant qu'elle est à l'écran : descendre d'un
 *    cran pour regarder la rangée suivante ne fait rien perdre ;
 * 2. elle REVIENT AU DÉBUT, sans animation, dès qu'elle SORT de l'écran —
 *    plus rien d'elle ne se voit — ou qu'on CHANGE DE PAGE par le rail
 *    (Accueil → Films → Accueil). Revenir d'une fiche n'est pas changer de
 *    page : la rangée est rendue exactement comme on l'a laissée ;
 * 3. RETOUR sur une carte qui n'est pas la première ramène le focus à la
 *    première (`rowBackTarget`) — la rangée revient au début D'UN COUP, puis
 *    le focus s'y pose (`back`) ; le Retour suivant fait ce qu'il faisait (le
 *    rail s'ouvre : `railScreenBackLayers`). Elle défilait à la vue, par tvOS :
 *    ~1,5 s sur une rangée défilée loin (une carte en aperçu passée en tête),
 *    le « gros lag » relevé par Damien le 17/10 — Retour est un geste de
 *    retour, pas de parcours : il est instantané.
 *
 * Le défilement d'un APERÇU ne fait sortir aucune rangée (`previewReveal`,
 * 17/10, relevé du testeur) : la grande carte d'aperçu grandit vers le bas et
 * pousse la page (`trailerPreviewRevealOffset`) — la rangée du dessus, d'où
 * l'on vient, sortait alors de l'écran et revenait au début ; HAUT tombait sur
 * sa première carte au lieu de la colonne d'où l'on venait. Les rangées à
 * l'écran au moment où la page se pousse sont TENUES tant que le focus reste
 * dans la rangée de l'aperçu ; il en part, elles relèvent de nouveau de la
 * règle 2 (au prochain défilement).
 *
 * Une rangée est DÉPLACÉE dès qu'une carte autre que la première a pris le
 * focus — c'est le focus qui fait défiler un carrousel de téléviseur ; elle
 * ne l'est plus quand elle revient au début. Seules les rangées DÉCLARÉES en
 * relèvent : ni les épisodes ni les saisons d'une fiche, ni sa distribution —
 * on y cherche un élément précis, garder sa place compte.
 *
 * Les clés sont celles des cartes : `<rangée>:<index>` (la rangée `reco` ne
 * désigne pas `reco:forYou:1`, l'index suit le préfixe).
 *
 * Quitter la page par le rail, deux cas (`leave`) :
 * - la page était À L'ÉCRAN : elle a rendu son focus au DÉBUT de la rangée
 *   (`startOf`, la mémoire de la plateforme le retient) ; toutes les rangées
 *   déplacées reviennent au début tout de suite, cachées par la page choisie ;
 * - la page était COUVERTE (une fiche ouverte depuis elle, quittée par le
 *   rail) : la plateforme lui rendra la carte d'où l'on était parti. Sa rangée
 *   attend donc le RETOUR (`resume`) pour revenir au début : remise là pendant
 *   qu'elle est cachée, la plateforme la ferait défiler, à la vue, jusqu'à la
 *   carte retenue, puis de nouveau jusqu'au début.
 *
 * Module pur : la plateforme mesure (le cadre des rangées, le défilement de la
 * page), annonce le focus et le changement de page, puis applique — la remise
 * au début sans animation, la réclamation du focus.
 */

/** Le cadre d'une rangée dans la page (repère du contenu qui défile). */
export interface RowBox {
  top: number;
  height: number;
}

/** La fenêtre de la page : son défilement et sa hauteur. */
export interface PageView {
  offset: number;
  height: number;
}

/** Une rangée est à l'écran tant qu'une part de son cadre est dans la fenêtre. */
export function rowOnScreen(box: RowBox, view: PageView): boolean {
  return box.top < view.offset + view.height && box.top + box.height > view.offset;
}

export interface RowCard {
  row: string;
  index: number;
}

/** La carte `<rangée>:<index>` que désigne `focusKey` parmi `rows`, ou null. */
export function rowCardOf(focusKey: string | null, rows: Iterable<string>): RowCard | null {
  if (!focusKey) return null;
  for (const row of rows) {
    if (!focusKey.startsWith(`${row}:`)) continue;
    const rest = focusKey.slice(row.length + 1);
    if (/^\d+$/.test(rest)) return { row, index: Number.parseInt(rest, 10) };
  }
  return null;
}

/** La clé de la première carte d'une rangée. */
export function rowStartKey(row: string): string {
  return `${row}:0`;
}

/** RETOUR : la première carte de la rangée quand le focus est sur une autre de ses cartes ; sinon null. */
export function rowBackTarget(focusKey: string | null, rows: Iterable<string>): string | null {
  const card = rowCardOf(focusKey, rows);
  return card && card.index > 0 ? rowStartKey(card.row) : null;
}

/**
 * Le retour sur la page après un changement de page : les rangées à remettre
 * au début, la clé à réclamer, et QUAND. `afterRestore` : la page revient
 * d'avoir été couverte, et la plateforme lui rend d'elle-même la carte
 * retenue — APRÈS toute réclamation (tvOS, mesuré : ~450 ms sans focus, puis
 * la carte). On la laisse faire, puis on remet au début et on réclame : la
 * rangée ne bouge qu'une fois, d'un coup, au lieu de défiler jusqu'à la carte
 * puis jusqu'au début. La plateforme attend le premier focus posé, au plus
 * `RESTORE_WITHIN_MS` (`restoreClaim.ts`).
 */
export interface RowResume {
  rewind: string[];
  claim: string | null;
  afterRestore: boolean;
}

export interface RowRewind {
  /** Une rangée se déclare (montée). */
  add(row: string): void;
  /** Elle part (démontée). */
  remove(row: string): void;
  /** Son cadre dans la page. */
  layout(row: string, box: RowBox): void;
  /** Le focus se pose sur `focusKey` : une carte autre que la première déplace sa rangée. */
  focus(focusKey: string): void;
  /** La page défile : les rangées déplacées sorties de l'écran, à remettre au début MAINTENANT. */
  scroll(view: PageView): string[];
  /**
   * La page va défiler pour montrer la grande carte d'un aperçu : les rangées
   * à l'écran sont tenues tant que le focus reste dans la rangée de l'aperçu.
   */
  previewReveal(): void;
  /**
   * On change de page par le rail : les rangées à remettre au début
   * maintenant. `visible` : la page était à l'écran ; `remembered` : la clé
   * que la plateforme lui rendra au retour.
   */
  leave(state: { visible: boolean; remembered: string | null }): string[];
  /** La page reprend le focus (la pile redescend sur elle) : null si rien n'a changé de page entre-temps. */
  resume(remembered: string | null): RowResume | null;
  /** La clé à viser en quittant la page par le rail : le début de sa rangée pour une carte, sinon elle-même. */
  startOf(focusKey: string): string;
  /** RETOUR : la première carte, quand le focus est sur une autre carte d'une rangée déclarée. */
  backTarget(focusKey: string | null): string | null;
  /**
   * RETOUR, appliqué : la rangée à remettre au début MAINTENANT (sans
   * animation) et la clé où poser le focus ensuite — `null` hors d'une carte
   * autre que la première. La rangée n'est plus déplacée.
   */
  back(focusKey: string | null): { row: string; claim: string } | null;
  /** Les rangées déplacées (pour les tests et le relevé). */
  moved(): string[];
}

export function createRowRewind(): RowRewind {
  const rows = new Set<string>();
  const boxes = new Map<string, RowBox>();
  const moved = new Set<string>();
  /** Les rangées remises au début au RETOUR (page quittée couverte). */
  const pending = new Set<string>();
  let focused: string | null = null;
  let left = false;
  let lastView: PageView | null = null;
  /** Les rangées tenues par le défilement d'un aperçu, et la rangée de cet aperçu. */
  const held = new Set<string>();
  let heldFor: string | null = null;

  const take = (selected: Iterable<string>): string[] => {
    const out = [...selected];
    for (const row of out) {
      moved.delete(row);
      pending.delete(row);
    }
    return out;
  };

  const startOf = (focusKey: string): string => {
    const card = rowCardOf(focusKey, rows);
    return card ? rowStartKey(card.row) : focusKey;
  };

  return {
    add(row) {
      rows.add(row);
    },
    remove(row) {
      rows.delete(row);
      boxes.delete(row);
      moved.delete(row);
      pending.delete(row);
    },
    layout(row, box) {
      boxes.set(row, box);
    },
    focus(focusKey) {
      focused = focusKey;
      const card = rowCardOf(focusKey, rows);
      if (card && card.index > 0) moved.add(card.row);
      // Le focus quitte la rangée de l'aperçu : plus rien n'est tenu.
      if (heldFor !== null && card?.row !== heldFor) {
        held.clear();
        heldFor = null;
      }
    },
    scroll(view) {
      lastView = view;
      const holder = rowCardOf(focused, rows)?.row ?? null;
      const out: string[] = [];
      for (const row of moved) {
        const box = boxes.get(row);
        // Jamais la rangée qui porte le focus, ni une tenue par un aperçu ; jamais une rangée pas encore mesurée.
        if (row === holder || held.has(row) || pending.has(row) || !box || rowOnScreen(box, view)) continue;
        out.push(row);
      }
      return take(out);
    },
    previewReveal() {
      const holder = rowCardOf(focused, rows)?.row ?? null;
      if (holder === null) return;
      if (heldFor !== holder) held.clear();
      heldFor = holder;
      for (const row of rows) {
        const box = boxes.get(row);
        // Sans défilement relevé, la page est en haut : ce qui y paraît compte.
        if (box && rowOnScreen(box, lastView ?? { offset: 0, height: Number.POSITIVE_INFINITY })) held.add(row);
      }
    },
    leave({ visible, remembered }) {
      left = true;
      const kept = visible ? null : rowCardOf(remembered, rows)?.row ?? null;
      if (kept !== null && moved.has(kept)) pending.add(kept);
      return take([...moved].filter((row) => row !== kept));
    },
    resume(remembered) {
      if (!left) return null;
      left = false;
      const rewind = take([...pending]);
      return { rewind, claim: remembered === null ? null : startOf(remembered), afterRestore: rewind.length > 0 };
    },
    startOf,
    backTarget: (focusKey) => rowBackTarget(focusKey, rows),
    back(focusKey) {
      const card = rowCardOf(focusKey, rows);
      if (!card || card.index === 0) return null;
      take([card.row]);
      return { row: card.row, claim: rowStartKey(card.row) };
    },
    moved: () => [...moved],
  };
}
