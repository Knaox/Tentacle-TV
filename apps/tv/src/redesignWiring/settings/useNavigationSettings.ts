import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NAV_SETTINGS_ROW_PREFIX,
  applyRailOrder,
  arrangeOnFocus,
  rowsArrangeReading,
  rowsSelectWhileArranging,
  startArrange,
  type ArrangeMove,
} from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useNavSettingsFocus } from "../../platform/tvos/screens/settings";
import type { SettingsNavigation } from "../../redesign/screens/settings/settingsTypes";
import { useNavCatalog } from "../nav/useNavCatalog";

/**
 * Le réglage « Navigation » branché : les entrées organisables dans l'ordre
 * choisi, masquées comprises (`useNavCatalog`, magasin partagé avec la LG), et
 * le DÉPLACEMENT d'une ligne — la machine commune au rail (`nav/arrange` de
 * tv-core : soulever, suivre le focus, poser, annuler) : la liste est rendue
 * par position, le focus natif passe à la ligne voisine, et l'ordre en cours
 * y amène l'entrée soulevée.
 *
 * Pendant un déplacement, les pastilles « Affichée » et les boutons du haut
 * sont verrouillés : HAUT / BAS ne quittent pas les lignes. OK pose, Retour
 * annule (l'entrée revient à sa case, le focus avec elle) ; quitter la liste
 * (GAUCHE, vers les onglets) pose l'entrée là où elle est. Rien n'est
 * enregistré avant la pose. Les verrous et les réclamations : l'applicateur
 * `platform/tvos/screens/settings.tsx`.
 */

export function useNavigationSettings(focus: FocusStore) {
  const catalog = useNavCatalog();
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [moving, setMovingState] = useState<ArrangeMove | null>(null);
  const movingRef = useRef(moving);
  const setMoving = useCallback((next: ArrangeMove | null) => {
    movingRef.current = next;
    setMovingState(next);
  }, []);

  const entries = useMemo(
    () => (moving ? applyRailOrder(catalog.entries, moving.order, (entry) => entry.key) : catalog.entries),
    [catalog, moving],
  );
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const { lockOthers, returnToRow, toFirstRow } = useNavSettingsFocus(focus);

  const end = useCallback(
    (commit: boolean): ArrangeMove | null => {
      const current = movingRef.current;
      if (!current) return null;
      lockOthers(false, entriesRef.current.length);
      if (commit) catalogRef.current.pinning.setOrder(current.order);
      setMoving(null);
      return current;
    },
    [lockOthers, setMoving],
  );

  const onMoveNavEntry = useCallback(
    (key: string) => {
      const current = movingRef.current;
      if (current) {
        // OK sur la ligne soulevée : elle est posée ; ailleurs, rien.
        if (rowsSelectWhileArranging(current, key) === "drop") end(true);
        return;
      }
      const { keys } = catalogRef.current;
      lockOthers(true, entriesRef.current.length);
      setMoving(startArrange(key, keys, entriesRef.current.findIndex((entry) => entry.key === key)));
    },
    [end, lockOthers, setMoving],
  );

  const isMoving = moving !== null;
  useEffect(() => {
    if (!isMoving) return undefined;
    return focus.subscribe((key, focused) => {
      const current = movingRef.current;
      if (!focused || !current) return;
      const reading = rowsArrangeReading(key, NAV_SETTINGS_ROW_PREFIX, entriesRef.current.map((entry) => entry.key));
      const outcome = arrangeOnFocus(current, reading);
      // Hors des lignes (les onglets) : l'entrée est posée là où elle est.
      if (outcome.kind === "drop") end(true);
      else if (outcome.kind === "reorder") setMoving(outcome.move);
    });
  }, [focus, isMoving, end, setMoving]);

  useEffect(() => () => void end(false), [end]);

  /** Retour pendant un déplacement : l'entrée revient, le focus avec elle. Vrai s'il a été pris. */
  const cancelNavMove = useCallback(() => {
    const cancelled = end(false);
    if (cancelled && cancelled.from >= 0) returnToRow(cancelled.from);
    return cancelled !== null;
  }, [end, returnToRow]);

  const { pinning } = catalog;
  // « Tout afficher » et « Ordre par défaut » disparaissent sous le focus : il
  // va à la première ligne.
  const onShowAllNav = useCallback(() => {
    pinning.showAll();
    toFirstRow();
  }, [pinning, toFirstRow]);
  const onResetNavOrder = useCallback(() => {
    pinning.resetOrder();
    toFirstRow();
  }, [pinning, toFirstRow]);

  const navigation = useMemo<SettingsNavigation>(
    () => ({
      entries: entries.map(({ key, label, icon, hidden }) => ({ key, label, icon, hidden })),
      movingKey: moving?.key ?? null,
      canShowAll: catalog.entries.some((entry) => entry.hidden),
      canResetOrder: catalog.customOrder,
    }),
    [entries, moving, catalog],
  );

  return {
    navigation,
    onMoveNavEntry,
    onToggleNavEntry: pinning.toggle,
    onShowAllNav,
    onResetNavOrder,
    cancelNavMove,
  };
}
