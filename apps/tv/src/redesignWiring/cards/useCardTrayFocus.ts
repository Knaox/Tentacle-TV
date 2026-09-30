import { useCallback, useEffect, useRef } from "react";
import { trayFocusKey, trayGroupKey } from "../../redesign/cards/cardFocusKeys";
import type { CardTrayActionKind } from "../../redesign/cards/cardTypes";
import { createEntryGuide } from "../focus/entryGuide";
import type { FocusStore } from "../focus/focusStore";
import { memorableKey } from "../screen/useEntryFocus";

/**
 * Le plateau des cartes au PORT du focus — ce que la vue laisse au câblage
 * (en-tête de `redesign/cards/tray/CardTray`), pour tout écran qui pose des
 * plateaux (`useCardTrayHost`) :
 *
 * - l'ENTRÉE par l'action primaire : le groupe `<carte>:tray` est lié à un
 *   guide d'entrée dont la destination est le premier bouton de la capsule.
 *   Mesuré au simulateur : seule, la géométrie posait le focus sur la
 *   première étoile ; un guide `autoFocus` aussi — tvOS y entre par
 *   l'élément le plus en haut à gauche, pas par l'ordre de l'arbre.
 * - MENU, d'où qu'on soit dans le plateau, rend le focus à la carte : le
 *   rappel `onBack`, à passer à `useRedesignScreen`, qui reçoit Menu sur
 *   toutes les pages du rail — poussées comprises (`RedesignScreen`).
 *
 * La liaison se pose quand la carte prend le focus : son plateau ne se monte
 * qu'après (`focusCard`, puis un rendu), et le port veut un conteneur lu dès
 * le premier rendu du groupe — un guide par carte, créé une fois.
 * `isCardKey` dit quelles clés sont des cartes (`rowItems("grid")`…) : il
 * doit être STABLE (niveau du module).
 */

/** Les boutons de la capsule, dans son ordre (`cardTrayEntries`) : l'action
 *  primaire, puis Ma liste → favori → vu, puis les extras. */
const CAPSULE_ORDER: readonly CardTrayActionKind[] = ["play", "request", "watchlist", "favorite", "watched", "details", "dismiss"];

/** Le premier bouton monté de la capsule d'une carte : son action primaire. */
function primaryOf(focus: FocusStore, cardKey: string): string | null {
  for (const kind of CAPSULE_ORDER) {
    const key = trayFocusKey(cardKey, kind);
    if (key && focus.node(key)) return key;
  }
  return null;
}

export interface CardTrayFocus {
  /** Menu : vrai s'il a rendu le focus à la carte depuis son plateau. */
  onBack: () => boolean;
}

export function useCardTrayFocus(focus: FocusStore, isCardKey: (focusKey: string) => boolean): CardTrayFocus {
  useTrayGuides(focus, isCardKey);
  return { onBack: useTrayBack(focus) };
}

/** Lie le guide d'entrée du plateau de chaque carte qui prend le focus. */
function useTrayGuides(focus: FocusStore, isCardKey: (focusKey: string) => boolean): void {
  const bound = useRef(new Set<string>());
  useEffect(() => {
    const bindTray = (cardKey: string | null) => {
      if (!cardKey || !isCardKey(cardKey) || bound.current.has(cardKey)) return;
      bound.current.add(cardKey);
      const group = trayGroupKey(cardKey);
      const container = createEntryGuide(focus, {
        owns: (key) => key.startsWith(`${group}:`),
        fallback: () => primaryOf(focus, cardKey),
        remember: false,
      });
      focus.bind(group, { container });
    };
    // Une carte focalisée avant l'abonnement (l'entrée de l'écran) : la sienne aussi.
    bindTray(focus.focusedKey());
    return focus.subscribe((key, focused) => {
      if (focused) bindTray(key);
    });
  }, [focus, isCardKey]);
}

/**
 * Menu depuis un plateau : le focus revient à sa carte. `RedesignScreen`
 * rappelle ce geste sur toutes les pages du rail — par son intercepteur à la
 * racine de la pile, par `usePreventRemove` sur une page poussée, où le
 * dépilage natif a déjà ôté le focus quand l'appui arrive (tvOS 26.2) : la
 * dernière clé focalisée fait alors foi. Une seule retenue par écran, la
 * sienne : une seconde ici ferait partir deux gestes sur le même Menu.
 */
function useTrayBack(focus: FocusStore): () => boolean {
  return useCallback(() => {
    const key = focus.focusedKey() ?? focus.lastFocusedKey();
    if (!key) return false;
    const card = memorableKey(key);
    if (card === key || !focus.node(card)) return false;
    focus.claim(card);
    return true;
  }, [focus]);
}
