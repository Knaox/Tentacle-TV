import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RAIL_HOME_KEY,
  RAIL_SEARCH_KEY,
  applyRailOrder,
  arrangeOnFocus,
  railLayoutFromSetup,
  railSetupArrangeReading,
  railSetupLibraryKeys,
  rowsSelectWhileArranging,
  startArrange,
  type ArrangeMove,
  type RailLayout,
} from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useRailSetupMoveFocus } from "../../platform/tvos/screens/railSetup";
import type { RailPreviewEntry, RailSetupLibrary } from "../../redesign/screens/railSetup/railSetupTypes";
import { useNavCatalog } from "../nav/useNavCatalog";

/**
 * Le BROUILLON de la préconfiguration : la disposition actuelle du profil
 * (`useNavCatalog`, pré-rempli), ce qu'on y change à la télécommande, et la
 * disposition qui en découle (`railLayoutFromSetup`, le socle) — rien n'est
 * enregistré ici : « Continuer » le confie à la porte (`useRailSetupGate`).
 *
 * - OK sur une ligne épingle ou retire la bibliothèque (une surcharge du
 *   brouillon ; une bibliothèque arrivée depuis garde son état d'avant).
 * - « Déplacer » la soulève : la machine commune (`nav/arrange`) — la liste
 *   est rendue par position, la pastille voisine prend le focus et l'ordre en
 *   cours y amène la bibliothèque ; OK sur sa pastille la pose, Retour annule
 *   (la case et le focus d'avant). Pendant ce temps, lignes et pied sont
 *   verrouillés (`useRailSetupMoveFocus`).
 * - L'aperçu se calcule sur la disposition qui serait enregistrée, déplacement
 *   en cours compris : Rechercher, Accueil, puis ce qui reste affiché.
 */

interface Draft {
  /** L'ordre des bibliothèques posé ; null : celui de la barre. */
  order: string[] | null;
  /** Les bibliothèques basculées sur cette page : épinglée (vrai) ou retirée. */
  pinned: Record<string, boolean>;
}

const EMPTY_DRAFT: Draft = { order: null, pinned: {} };

export function useRailSetupEditor(focus: FocusStore, current: RailLayout) {
  const { t } = useTranslation("nav");
  const catalog = useNavCatalog();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [moving, setMovingState] = useState<ArrangeMove | null>(null);
  const movingRef = useRef(moving);
  const setMoving = useCallback((next: ArrangeMove | null) => {
    movingRef.current = next;
    setMovingState(next);
  }, []);
  const { lockOthers, returnToSlot } = useRailSetupMoveFocus(focus);

  const libraryEntries = useMemo(() => {
    const keys = new Set(railSetupLibraryKeys(catalog.keys));
    return catalog.entries.filter((entry) => keys.has(entry.key));
  }, [catalog]);
  const order = moving?.order ?? draft.order ?? libraryEntries.map((entry) => entry.key);

  const libraries = useMemo<RailSetupLibrary[]>(
    () =>
      applyRailOrder(libraryEntries, order, (entry) => entry.key).map(({ key, label, icon, hidden }) => ({
        key,
        label,
        icon,
        pinned: draft.pinned[key] ?? !hidden,
      })),
    [libraryEntries, order, draft.pinned],
  );
  const librariesRef = useRef(libraries);
  librariesRef.current = libraries;

  /** La disposition qu'on enregistrerait maintenant. */
  const layout = useMemo<RailLayout>(
    () =>
      railLayoutFromSetup(current, catalog.keys, {
        offered: libraries.map((library) => library.key),
        pinned: libraries.filter((library) => library.pinned).map((library) => library.key),
      }),
    [current, catalog.keys, libraries],
  );

  const preview = useMemo<RailPreviewEntry[]>(() => {
    const hidden = new Set(layout.masquees);
    const shown = applyRailOrder(catalog.entries, layout.order, (entry) => entry.key).filter((entry) => !hidden.has(entry.key));
    return [
      { key: RAIL_SEARCH_KEY, label: t("search"), icon: "search" },
      { key: RAIL_HOME_KEY, label: t("home"), icon: "home" },
      ...shown.map(({ key, label, icon }) => ({ key, label, icon })),
    ];
  }, [catalog.entries, layout, t]);

  const togglePin = useCallback((key: string) => {
    if (movingRef.current) return;
    const library = librariesRef.current.find((entry) => entry.key === key);
    if (!library) return;
    setDraft((previous) => ({ ...previous, pinned: { ...previous.pinned, [key]: !library.pinned } }));
  }, []);

  const end = useCallback(
    (commit: boolean): ArrangeMove | null => {
      const move = movingRef.current;
      if (!move) return null;
      lockOthers(false, librariesRef.current.length);
      if (commit) setDraft((previous) => ({ ...previous, order: move.order }));
      setMoving(null);
      return move;
    },
    [lockOthers, setMoving],
  );

  const move = useCallback(
    (key: string) => {
      const active = movingRef.current;
      if (active) {
        // OK sur la pastille de la bibliothèque soulevée : elle est posée ; ailleurs, rien.
        if (rowsSelectWhileArranging(active, key) === "drop") end(true);
        return;
      }
      const keys = librariesRef.current.map((entry) => entry.key);
      lockOthers(true, keys.length);
      setMoving(startArrange(key, keys, keys.indexOf(key)));
    },
    [end, lockOthers, setMoving],
  );

  const isMoving = moving !== null;
  useEffect(() => {
    if (!isMoving) return undefined;
    return focus.subscribe((key, focused) => {
      const active = movingRef.current;
      if (!focused || !active) return;
      const outcome = arrangeOnFocus(active, railSetupArrangeReading(key, active.order));
      if (outcome.kind === "drop") end(true);
      else if (outcome.kind === "reorder") setMoving(outcome.move);
    });
  }, [focus, isMoving, end, setMoving]);

  // Démontée en plein déplacement (la page s'en va) : rien ne reste verrouillé.
  useEffect(() => () => void end(false), [end]);

  /** Retour pendant un déplacement : la bibliothèque revient, le focus avec elle. Vrai s'il a été pris. */
  const cancelMove = useCallback(() => {
    const cancelled = end(false);
    if (cancelled && cancelled.from >= 0) returnToSlot(cancelled.from);
    return cancelled !== null;
  }, [end, returnToSlot]);

  return { libraries, preview, layout, movingKey: moving?.key ?? null, togglePin, move, cancelMove };
}
