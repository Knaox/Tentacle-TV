import type { IconName } from "../../icons/Icon";

/**
 * Ce que la bibliothèque et ses listes en surimpression reçoivent — DÉJÀ
 * résolu par l'intégration : libellés traduits, valeurs courantes mises en
 * mots, options cochées. La vue ne connaît ni l'état des filtres ni les
 * paramètres du catalogue (`useLibraryFilters`, `catalogParams`) : elle
 * montre, et rend la main par ses callbacks.
 */

/** Les critères de la barre, dans l'ordre de l'écran. */
export type LibraryFilterKey = "status" | "favorites" | "genres" | "sort" | "years" | "rating" | "platforms";

/** Une pastille de la barre : le nom du critère et sa valeur courante. */
export interface FilterPillModel {
  key: LibraryFilterKey;
  /** « Genres », « Trier par »… */
  label: string;
  /** La valeur courante, défaut compris (« Tous », « Titre A→Z ») ; absente
   *  pour une bascule. */
  value?: string;
  /** Réglée autrement que par défaut : la pastille le montre. */
  active: boolean;
  /** Bascule directe (Favoris) : OK change l'état, aucune liste ne s'ouvre. */
  toggle?: boolean;
  /** Pictogramme d'une bascule (Favoris : le cœur). */
  icon?: IconName;
  /** Pictogramme quand la bascule est posée (cœur plein). */
  activeIcon?: IconName;
}

/** Un filtre actif, visible sous la barre et retiré d'un geste. */
export interface ActiveFilterModel {
  id: string;
  /** « Action », « 2010 – 2020 », « ★ 7+ », « Netflix », « Non vus »… */
  label: string;
}

/** Une option d'une liste en surimpression. */
export interface SheetOption {
  id: string;
  label: string;
  selected: boolean;
  /** À droite de la ligne (un compte, une précision). */
  detail?: string;
}

interface SheetBase {
  /** Le critère que la liste règle — rendu tel quel aux callbacks. */
  filter: LibraryFilterKey;
  title: string;
  /** « 3 sélectionnés », « Plusieurs choix possibles »… */
  subtitle?: string;
  /** La pilule blanche qui referme la liste : « Voir 12 titres ». */
  applyLabel: string;
  /** « Effacer » — absent quand il n'y a rien à effacer. */
  clearLabel?: string;
}

/** Cases (Genres, Plateformes) ou choix unique (Visionnage). */
export interface ChoiceSheetModel extends SheetBase {
  kind: "choice";
  multiple: boolean;
  columns: 1 | 2 | 3;
  options: SheetOption[];
  /** Lignes visibles avant le défilement (défaut 7). */
  visibleRows?: number;
}

/** Le tri : un critère, puis l'ordre. */
export interface SortSheetModel extends SheetBase {
  kind: "sort";
  criteriaTitle: string;
  criteria: SheetOption[];
  orderTitle: string;
  orders: SheetOption[];
}

/** Une borne de l'intervalle d'années : « De » / « 2010 » (ou « — »). */
export interface YearBoundModel {
  label: string;
  value: string;
  /** Posée : la valeur s'écrit en blanc plein. */
  set: boolean;
}

/** Les années : deux bornes réglables, et des décennies toutes faites. */
export interface YearSheetModel extends SheetBase {
  kind: "years";
  from: YearBoundModel;
  to: YearBoundModel;
  presetsTitle: string;
  presets: SheetOption[];
  /** Libellés des flèches (« Précédent », « Suivant »), dits au focus. */
  stepLabels: { previous: string; next: string };
}

/** Un palier de la note : 0, 0,5, 1… 10. */
export interface RatingStop {
  value: number;
  /** Écrit sous l'échelle (les entiers) — et dans la pastille au focus. */
  label: string;
  /** Le palier retenu. */
  selected: boolean;
  /** Au-dessus du palier retenu : dans l'intervalle gardé. */
  kept: boolean;
}

/** La note minimum : une échelle de paliers, et la valeur retenue en grand. */
export interface RatingSheetModel extends SheetBase {
  kind: "rating";
  /** « 7.5 » — absente quand aucune note n'est exigée. */
  readoutValue?: string;
  /** « et plus », ou « Toutes » quand rien n'est exigé. */
  readoutText: string;
  stops: RatingStop[];
}

export type FilterSheetModel = ChoiceSheetModel | SortSheetModel | YearSheetModel | RatingSheetModel;

/** Les callbacks d'une liste en surimpression. */
export interface FilterSheetHandlers {
  /** Une option cochée, décochée ou choisie (critère, ordre, décennie). */
  onSheetOption?: (filter: LibraryFilterKey, optionId: string) => void;
  onSheetClear?: (filter: LibraryFilterKey) => void;
  /** « Voir N titres » : refermer la liste. */
  onSheetApply?: () => void;
  /** Une flèche d'une borne d'années. */
  onYearStep?: (bound: "from" | "to", delta: -1 | 1) => void;
  /** Un palier de note choisi. */
  onRatingSelect?: (value: number) => void;
}
