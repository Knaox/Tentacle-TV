import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyRailOrder, moveRailKeyTo } from "@tentacle-tv/tv-core";
import type { SettingsNavigation } from "../../redesign/screens/settings/settingsTypes";
import { setFocusLocked } from "../focus/focusLocks";
import type { FocusStore } from "../focus/focusStore";
import { useNavCatalog } from "../nav/useNavCatalog";

/**
 * Le réglage « Navigation » branché : les entrées organisables dans l'ordre
 * choisi, masquées comprises (`useNavCatalog`, magasin partagé avec la LG), et
 * le DÉPLACEMENT d'une ligne — la même mécanique que dans le rail
 * (`useRailArrange`) : la liste est rendue par position, le focus natif passe
 * à la ligne voisine, et l'ordre en cours y amène l'entrée soulevée.
 *
 * Pendant un déplacement, les pastilles « Affichée » et les boutons du haut
 * sont verrouillés : HAUT / BAS ne quittent pas les lignes. OK pose, Retour
 * annule (l'entrée revient à sa case, le focus avec elle) ; quitter la liste
 * (GAUCHE, vers les onglets) pose l'entrée là où elle est. Rien n'est
 * enregistré avant la pose.
 */

const ROW = /^settings:nav:(\d+)$/;

interface Moving {
  key: string;
  order: string[];
  /** Sa case au départ : Retour l'y ramène. */
  from: number;
}

export function useNavigationSettings(focus: FocusStore) {
  const catalog = useNavCatalog();
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [moving, setMovingState] = useState<Moving | null>(null);
  const movingRef = useRef(moving);
  const setMoving = useCallback((next: Moving | null) => {
    movingRef.current = next;
    setMovingState(next);
  }, []);

  const entries = useMemo(
    () => (moving ? applyRailOrder(catalog.entries, moving.order, (entry) => entry.key) : catalog.entries),
    [catalog, moving],
  );
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const lockOthers = useCallback(
    (locked: boolean) => {
      for (let index = 0; index < entriesRef.current.length; index++) {
        setFocusLocked(focus, `settings:nav:${index}:visibility`, locked);
      }
      setFocusLocked(focus, "settings:nav:showAll", locked);
      setFocusLocked(focus, "settings:nav:resetOrder", locked);
    },
    [focus],
  );

  const end = useCallback(
    (commit: boolean): Moving | null => {
      const current = movingRef.current;
      if (!current) return null;
      lockOthers(false);
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
        // OK sur la ligne soulevée : elle est posée.
        if (current.key === key) end(true);
        return;
      }
      const { keys } = catalogRef.current;
      lockOthers(true);
      setMoving({ key, order: keys, from: entriesRef.current.findIndex((entry) => entry.key === key) });
    },
    [end, lockOthers, setMoving],
  );

  const isMoving = moving !== null;
  useEffect(() => {
    if (!isMoving) return undefined;
    return focus.subscribe((key, focused) => {
      const current = movingRef.current;
      if (!focused || !current) return;
      const row = ROW.exec(key);
      if (!row) {
        // Hors des lignes (les onglets) : l'entrée est posée là où elle est.
        if (!key.startsWith("settings:nav:")) end(true);
        return;
      }
      const target = entriesRef.current[Number(row[1])]?.key;
      if (!target || target === current.key) return;
      setMoving({ ...current, order: moveRailKeyTo(current.order, current.key, target) });
    });
  }, [focus, isMoving, end, setMoving]);

  useEffect(() => () => void end(false), [end]);

  /** Retour pendant un déplacement : l'entrée revient, le focus avec elle. Vrai s'il a été pris. */
  const cancelNavMove = useCallback(() => {
    const cancelled = end(false);
    if (cancelled && cancelled.from >= 0) focus.claim(`settings:nav:${cancelled.from}`);
    return cancelled !== null;
  }, [end, focus]);

  const { pinning } = catalog;
  // « Tout afficher » et « Ordre par défaut » disparaissent sous le focus : il
  // va à la première ligne.
  const onShowAllNav = useCallback(() => {
    pinning.showAll();
    focus.claim("settings:nav:0");
  }, [pinning, focus]);
  const onResetNavOrder = useCallback(() => {
    pinning.resetOrder();
    focus.claim("settings:nav:0");
  }, [pinning, focus]);

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
