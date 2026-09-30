import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
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
 * - MENU, d'où qu'on soit dans le plateau, rend le focus à la carte.
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
  /** Menu reçu par l'intercepteur de l'écran (à la racine de la pile) : vrai
   *  s'il a rendu le focus à la carte depuis son plateau. */
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
 * Menu depuis un plateau. Toutes les pages du rail sont POUSSÉES sur
 * l'accueil, et sur un écran poussé Menu n'atteint pas l'intercepteur de
 * `RedesignScreen` : le geste de la pile native dépile d'abord — mesuré au
 * simulateur (tvOS 26.2), le patch de react-native-screens n'y voit même pas
 * l'appui. L'écran est donc RETENU (`usePreventRemove`) tant que le focus est
 * dans un plateau : react-native-screens le réempile, et le retrait rejoué
 * rend le focus à la carte. Un simple flou ne lève pas la retenue — le
 * dépilage natif retire le focus avant d'être annulé ; seul un focus pris
 * ailleurs dans l'écran, ou l'écran quitté par la navigation, la lève. Toute
 * autre sortie (la pile refaite par le rail, la déconnexion) passe.
 * À la racine de la pile, l'intercepteur reçoit Menu : le rappel rendu ici.
 */
function useTrayBack(focus: FocusStore): () => boolean {
  const navigation = useNavigation();
  const [trayCard, setTrayCard] = useState<string | null>(null);
  const trayCardRef = useRef(trayCard);
  trayCardRef.current = trayCard;

  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        const card = memorableKey(key);
        setTrayCard(card !== key ? card : null);
      }),
    [focus],
  );
  useEffect(() => navigation.addListener("blur", () => setTrayCard(null)), [navigation]);

  usePreventRemove(trayCard !== null, ({ data }) => {
    const card = trayCardRef.current;
    const back = data.action.type === "POP" || data.action.type === "GO_BACK";
    if (back && card && navigation.isFocused()) {
      focus.claim(card);
      return;
    }
    // Levée d'abord : un retrait du même tick serait encore retenu.
    setTrayCard(null);
    setTimeout(() => navigation.dispatch(data.action), 0);
  });

  return useCallback(() => {
    const key = focus.focusedKey();
    if (!key) return false;
    const card = memorableKey(key);
    if (card === key) return false;
    focus.claim(card);
    return true;
  }, [focus]);
}
