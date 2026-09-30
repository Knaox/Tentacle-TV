import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { moveRailKey, moveRailKeyTo } from "@tentacle-tv/tv-core";
import { setFocusLocked } from "../focus/focusLocks";
import type { FocusStore } from "../focus/focusStore";
import { isMovableEntry, useNavCatalog } from "./useNavCatalog";
import { SHOW_ALL_KEY } from "./useNavEntries";

/**
 * ORGANISER la navigation à la télécommande : l'appui long sur une entrée
 * ouvre son menu (`NavMenuModal`) — Déplacer, Monter, Descendre, Masquer,
 * Tout afficher, Réglages de la navigation.
 *
 * - Monter / Descendre enregistrent tout de suite et LAISSENT le menu ouvert :
 *   OK, OK, OK fait monter l'entrée de trois crans, qu'on voit bouger derrière.
 *   À la fermeture, tvOS rend le focus à la CASE qui l'avait — elle montre
 *   désormais une autre entrée : dès qu'il est rendu, on le réclame pour
 *   l'entrée dont parlait le menu. Sauf après « Masquer » : la suivante prend
 *   sa case et le focus, on enchaîne.
 * - Déplacer referme le menu et SOULÈVE l'entrée : HAUT / BAS la déplacent, OK
 *   la pose, Retour annule. La liste de la vue est rendue par position : le
 *   focus natif passe à la case voisine, et l'ordre en cours y amène
 *   l'entrée soulevée — elle suit le focus sans qu'on le réclame. Rechercher,
 *   Accueil, « Tout afficher » et le profil sont verrouillés le temps du
 *   déplacement : le pavé ne sort pas de la liste. Quitter le rail pose
 *   l'entrée là où elle est.
 *
 * L'ordre en cours d'un déplacement n'est enregistré qu'à la pose : les rails
 * des écrans du dessous ne bougent pas à chaque appui, et Retour n'a rien à
 * défaire.
 */

export type NavMenuAction = "move" | "up" | "down" | "hide" | "showAll" | "settings";

export interface NavMenuModel {
  key: string;
  label: string;
  /** Sa place parmi les entrées organisables visibles (1 = la première). */
  position: number;
  count: number;
  canUp: boolean;
  canDown: boolean;
  canShowAll: boolean;
}

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
}

const NAV_PREFIX = "nav:";
/** Le focus rendu au rail après la fermeture du menu arrive dans ce délai. */
const RETURN_WITHIN_MS = 1500;
/** Ce qui ne bouge jamais : verrouillé pendant un déplacement. */
const FIXED_KEYS = ["Search", "Home", SHOW_ALL_KEY, "Settings"].map((key) => `${NAV_PREFIX}${key}`);

interface Moving {
  key: string;
  order: string[];
}

export function useRailArrange(focus: FocusStore, onOpenSettings: () => void): RailArrange {
  const catalog = useNavCatalog();
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [heldKey, setHeldKey] = useState<string | null>(null);
  const heldRef = useRef(heldKey);
  heldRef.current = heldKey;
  const [moving, setMovingState] = useState<Moving | null>(null);
  const movingRef = useRef(moving);
  const setMoving = useCallback((next: Moving | null) => {
    movingRef.current = next;
    setMovingState(next);
  }, []);
  const settingsRef = useRef(onOpenSettings);
  settingsRef.current = onOpenSettings;
  /** L'entrée que le focus doit retrouver quand tvOS le rend au rail, menu fermé. */
  const returnTo = useRef<{ key: string; at: number } | null>(null);

  const menu = useMemo<NavMenuModel | null>(() => {
    if (!heldKey) return null;
    const visible = catalog.entries.filter((entry) => !entry.hidden);
    const index = visible.findIndex((entry) => entry.key === heldKey);
    if (index < 0) return null;
    return {
      key: heldKey,
      label: visible[index].label,
      position: index + 1,
      count: visible.length,
      canUp: index > 0,
      canDown: index < visible.length - 1,
      canShowAll: catalog.entries.some((entry) => entry.hidden),
    };
  }, [heldKey, catalog]);

  const openMenu = useCallback((key: string) => {
    if (isMovableEntry(key) && !movingRef.current) setHeldKey(key);
  }, []);
  const closeMenu = useCallback(() => {
    const key = heldRef.current;
    returnTo.current = key ? { key, at: Date.now() } : null;
    setHeldKey(null);
  }, []);

  const lockFixed = useCallback(
    (locked: boolean) => {
      for (const key of FIXED_KEYS) setFocusLocked(focus, key, locked);
    },
    [focus],
  );

  const endMove = useCallback(
    (commit: boolean): Moving | null => {
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
      switch (action) {
        case "up":
        case "down":
          pinning.setOrder(moveRailKey(keys, key, action === "up" ? -1 : 1, (other) => !pinning.isHidden(other)));
          return;
        case "hide":
          pinning.toggle(key);
          break;
        case "showAll":
          pinning.showAll();
          returnTo.current = { key, at: Date.now() };
          break;
        case "move":
          lockFixed(true);
          setMoving({ key, order: keys });
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
        const target = returnTo.current;
        if (!focused || !target || !key.startsWith(NAV_PREFIX) || key.startsWith(`${NAV_PREFIX}menu:`)) return;
        returnTo.current = null;
        // Rendu tard (le focus était parti ailleurs) : plus rien à retrouver.
        if (Date.now() - target.at > RETURN_WITHIN_MS) return;
        if (key !== `${NAV_PREFIX}${target.key}`) focus.claim(`${NAV_PREFIX}${target.key}`);
      }),
    [focus],
  );

  // Le déplacement : la case voisine prend le focus, l'entrée soulevée y va.
  const isMoving = moving !== null;
  useEffect(() => {
    if (!isMoving) return undefined;
    return focus.subscribe((key, focused) => {
      const current = movingRef.current;
      if (!focused || !current) return;
      // Sortie du rail (vers le contenu) : l'entrée est posée là où elle est.
      if (!key.startsWith(NAV_PREFIX)) {
        endMove(true);
        return;
      }
      const target = key.slice(NAV_PREFIX.length);
      if (target === current.key || !isMovableEntry(target)) return;
      setMoving({ key: current.key, order: moveRailKeyTo(current.order, current.key, target) });
    });
  }, [focus, isMoving, endMove, setMoving]);

  // Démonté en plein déplacement (l'écran s'en va) : rien ne reste verrouillé.
  useEffect(() => () => void endMove(false), [endMove]);

  const dropIfMoving = useCallback(() => endMove(true) !== null, [endMove]);

  const cancelIfMoving = useCallback(() => {
    const cancelled = endMove(false);
    // L'entrée revient à sa place : le focus la suit.
    if (cancelled) focus.claim(`${NAV_PREFIX}${cancelled.key}`);
    return cancelled !== null;
  }, [endMove, focus]);

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
  };
}
