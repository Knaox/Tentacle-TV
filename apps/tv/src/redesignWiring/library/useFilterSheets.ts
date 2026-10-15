import { useCallback, useRef, useState } from "react";
import { filterSheetEntryKey } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useFilterSheetFocus } from "../../platform/tvos/screens/library";
import type { FilterSheetModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import { useBackLayer } from "../back/BackScope";

export type FilterUpdate<S> = (effect: (state: S) => S) => void;

/** Ce qu'une barre de filtres sait faire de son état — pur, sans React. */
export interface FilterSheetsModel<S> {
  /** La liste d'un critère, mise en mots ; `null` : ce critère n'en a pas. */
  sheetOf: (key: LibraryFilterKey, state: S) => FilterSheetModel | null;
  /** Une option choisie dans une liste. */
  apply: (state: S, key: LibraryFilterKey, id: string) => S;
  /** « Effacer » : ce critère revient à son défaut. */
  clear: (state: S, key: LibraryFilterKey) => S;
}

export interface FilterSheets {
  /** La liste ouverte, mise en mots ; rien quand aucune ne l'est. */
  sheet: FilterSheetModel | null;
  openSheet: (key: LibraryFilterKey) => void;
  /** Menu, Retour ou « Voir N titres ». */
  closeSheet: () => void;
  /** La liste a fini de s'effacer, sa Modal se retire : le focus revient à sa pastille. */
  onSheetExited: () => void;
  /** Une liste couvre l'écran : de son ouverture à la fin de son fondu de sortie. */
  covering: boolean;
  onSheetOption: (filter: LibraryFilterKey, id: string) => void;
  onSheetClear: (filter: LibraryFilterKey) => void;
  onSheetApply: () => void;
}

/**
 * Les grandes listes d'une barre de filtres — la bibliothèque, Ma liste, les
 * Favoris : laquelle est ouverte, ce qu'elle montre, et le focus qui va avec.
 * On y ENTRE par ce qui est retenu — figé à l'ouverture : cocher en série ne
 * doit pas faire sauter le focus. La liste vit dans une Modal, où aucune
 * préférence de focus n'est honorée : seule l'entrée y est focalisable à
 * l'ouverture (`useChoiceEntry`). « Effacer », qui disparaît sous le doigt,
 * rend le focus au premier choix par le même verrou. BAS depuis n'importe
 * quelle colonne atteint le pied de la liste (groupe `sheet:footer`), par
 * « Voir N titres ». En sortir rend le focus à la pastille qui l'a ouverte
 * (restauration de tvOS, réclamée en plus à la fin du fondu de la liste :
 * réclamé pendant, la Modal le gardait).
 *
 * `model` se lit au moment du geste : il peut changer à chaque rendu (ses
 * libellés, le compte de « Voir N titres ») sans changer les gestionnaires.
 */
export function useFilterSheets<S>(state: S, update: FilterUpdate<S>, focus: FocusStore, model: FilterSheetsModel<S>): FilterSheets {
  const [open, setOpen] = useState<{ filter: LibraryFilterKey; entry: string } | null>(null);
  // Couvert jusqu'à la fin du fondu de sortie, pas seulement tant qu'elle est
  // ouverte : ce qu'elle cachait se met à jour une fois le fondu joué.
  const [covering, setCovering] = useState(false);
  const latest = useRef({ state, model });
  latest.current = { state, model };

  const sheet = open ? model.sheetOf(open.filter, state) : null;
  // Le pied de la liste, son entrée verrouillée, la pastille rendue (applicateur tvOS).
  const { returnToPill } = useFilterSheetFocus(focus, sheet, open?.entry ?? null);

  const openSheet = useCallback((key: LibraryFilterKey) => {
    const { state: current, model: m } = latest.current;
    const initial = m.sheetOf(key, current);
    if (!initial) return;
    setOpen({ filter: key, entry: filterSheetEntryKey(initial) });
    setCovering(true);
  }, []);

  const openRef = useRef(open);
  openRef.current = open;
  // Le critère dont la pastille reprend le focus, une fois la liste effacée.
  const closedFilter = useRef<string | null>(null);
  const closeSheet = useCallback(() => {
    const current = openRef.current;
    if (!current) return;
    setOpen(null);
    closedFilter.current = current.filter;
  }, []);
  const onSheetExited = useCallback(() => {
    const filter = closedFilter.current;
    closedFilter.current = null;
    setCovering(false);
    if (filter) returnToPill(filter);
  }, [returnToPill]);
  // Retour, liste ouverte : la refermer (la Modal le reçoit, `onSheetClose`).
  useBackLayer("menu", open !== null, closeSheet);

  const onSheetOption = useCallback(
    (filter: LibraryFilterKey, id: string) => update((current) => latest.current.model.apply(current, filter, id)),
    [update],
  );
  const onSheetClear = useCallback((filter: LibraryFilterKey) => {
    const { state: current, model: m } = latest.current;
    const cleared = m.sheetOf(filter, m.clear(current, filter));
    update((s) => m.clear(s, filter));
    if (cleared) setOpen((o) => (o ? { ...o, entry: filterSheetEntryKey(cleared) } : o));
  }, [update]);

  return { sheet, openSheet, closeSheet, onSheetExited, covering, onSheetOption, onSheetClear, onSheetApply: closeSheet };
}
