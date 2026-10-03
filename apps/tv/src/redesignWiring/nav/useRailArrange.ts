import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RAIL_LOCKED_WHILE_MOVING, arrangeOnFocus, canOpenRailMenu, navKeyOf, railArrangeReading, railMenuEffect, railMenuModel,
  railMenuReturnOnClose, railMenuReturnOnFocus, startArrange, type ArrangeMove, type RailMenuAction, type RailMenuModel,
  type RailMenuReturn,
} from "@tentacle-tv/tv-core";
import { claimAfterRestore } from "../focus/claimAfterRestore";
import { setFocusLocked } from "../focus/focusLocks";
import type { FocusStore } from "../focus/focusStore";
import { useNavCatalog } from "./useNavCatalog";

/**
 * ORGANISER la navigation à la télécommande — le câblage : les règles sont
 * dans tv-core (`nav/railMenu` pour le menu d'une entrée, `nav/arrange` pour
 * le déplacement), on les applique au magasin d'épinglage et au focus.
 *
 * - L'appui long sur une entrée organisable ouvre son menu (`NavMenuModal`) —
 *   Déplacer, Monter, Descendre, Masquer, Tout afficher, Réglages de la
 *   navigation. Monter / Descendre enregistrent et laissent le menu ouvert ;
 *   à la fermeture, tvOS rend le focus à la CASE qui l'avait, et le premier
 *   focus rendu au rail est redirigé vers l'entrée du menu.
 * - Déplacer SOULÈVE l'entrée : HAUT / BAS la déplacent (la liste est rendue
 *   par position, l'ordre en cours suit le focus), OK la pose, Retour annule,
 *   quitter le rail la pose là où elle est. Rechercher, Accueil, « Tout
 *   afficher » et le profil sont infocalisables le temps du déplacement.
 *
 * L'ordre en cours d'un déplacement n'est enregistré qu'à la pose : les rails
 * des écrans du dessous ne bougent pas à chaque appui, et Retour n'a rien à
 * défaire.
 */

export type NavMenuAction = RailMenuAction;
export type NavMenuModel = RailMenuModel;

export interface RailArrange {
  heldKey: string | null;
  movingKey: string | null;
  /** L'ordre en cours d'un déplacement, pas encore enregistré. */
  previewOrder: string[] | null;
  menu: NavMenuModel | null;
  openMenu: (key: string) => void;
  closeMenu: () => void;
  runMenuAction: (action: NavMenuAction) => void;
  /** OK pendant un déplacement : pose l'entrée. Vrai s'il a été pris. */
  dropIfMoving: () => boolean;
  /** Retour pendant un déplacement : annule, l'entrée revient. Vrai s'il a été pris. */
  cancelIfMoving: () => boolean;
  /** Une entrée se déplace, relu à l'appel. */
  isMoving: () => boolean;
}

export function useRailArrange(focus: FocusStore, onOpenSettings: () => void): RailArrange {
  const catalog = useNavCatalog();
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [heldKey, setHeldKey] = useState<string | null>(null);
  const heldRef = useRef(heldKey);
  heldRef.current = heldKey;
  const [moving, setMovingState] = useState<ArrangeMove | null>(null);
  const movingRef = useRef(moving);
  const setMoving = useCallback((next: ArrangeMove | null) => {
    movingRef.current = next;
    setMovingState(next);
  }, []);
  const settingsRef = useRef(onOpenSettings);
  settingsRef.current = onOpenSettings;
  /** L'entrée que le focus doit retrouver quand tvOS le rend au rail, menu fermé. */
  const returnTo = useRef<RailMenuReturn | null>(null);

  const menu = useMemo(() => railMenuModel(catalog.entries, heldKey), [heldKey, catalog]);

  const openMenu = useCallback((key: string) => {
    if (canOpenRailMenu(key, movingRef.current !== null)) setHeldKey(key);
  }, []);
  const closeMenu = useCallback(() => {
    returnTo.current = railMenuReturnOnClose(heldRef.current, Date.now());
    setHeldKey(null);
  }, []);

  const lockFixed = useCallback(
    (locked: boolean) => {
      for (const key of RAIL_LOCKED_WHILE_MOVING) setFocusLocked(focus, navKeyOf(key), locked);
    },
    [focus],
  );

  const endMove = useCallback(
    (commit: boolean): ArrangeMove | null => {
      const current = movingRef.current;
      if (!current) return null;
      lockFixed(false);
      if (commit) catalogRef.current.pinning.setOrder(current.order);
      setMoving(null);
      return current;
    },
    [lockFixed, setMoving],
  );

  const runMenuAction = useCallback(
    (action: NavMenuAction) => {
      const key = heldRef.current;
      if (!key) return;
      const { keys, pinning } = catalogRef.current;
      const effect = railMenuEffect(action, key, keys, pinning.isHidden);
      switch (effect.kind) {
        case "reorder":
          pinning.setOrder(effect.order);
          return;
        case "hide":
          pinning.toggle(effect.key);
          break;
        case "showAll":
          pinning.showAll();
          returnTo.current = { key: effect.returnTo, at: Date.now() };
          break;
        case "move":
          lockFixed(true);
          setMoving(startArrange(effect.key, keys, keys.indexOf(effect.key)));
          break;
        case "settings":
          settingsRef.current();
          break;
      }
      setHeldKey(null);
    },
    [lockFixed, setMoving],
  );

  // Menu fermé : le premier focus que tvOS rend au rail va à l'entrée du menu.
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        const outcome = railMenuReturnOnFocus(returnTo.current, key, Date.now());
        if (!outcome.consume) return;
        returnTo.current = null;
        if (outcome.claim) focus.claim(outcome.claim);
      }),
    [focus],
  );

  // Le déplacement : la case voisine prend le focus, l'entrée soulevée y va.
  const moveActive = moving !== null;
  useEffect(() => {
    if (!moveActive) return undefined;
    return focus.subscribe((key, focused) => {
      const current = movingRef.current;
      if (!focused || !current) return;
      const outcome = arrangeOnFocus(current, railArrangeReading(key));
      if (outcome.kind === "drop") endMove(true);
      else if (outcome.kind === "reorder") setMoving(outcome.move);
    });
  }, [focus, moveActive, endMove, setMoving]);

  // Démonté en plein déplacement (l'écran s'en va) : rien ne reste verrouillé.
  useEffect(() => () => void endMove(false), [endMove]);

  const dropIfMoving = useCallback(() => endMove(true) !== null, [endMove]);

  const cancelIfMoving = useCallback(() => {
    const cancelled = endMove(false);
    // L'entrée revient à sa place : le focus la suit.
    if (cancelled) claimAfterRestore(focus, navKeyOf(cancelled.key));
    return cancelled !== null;
  }, [endMove, focus]);

  const isMoving = useCallback(() => movingRef.current !== null, []);

  return {
    heldKey,
    movingKey: moving?.key ?? null,
    previewOrder: moving?.order ?? null,
    menu,
    openMenu,
    closeMenu,
    runMenuAction,
    dropIfMoving,
    cancelIfMoving,
    isMoving,
  };
}
