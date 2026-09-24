import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import {
  useAnimatedScrollHandler, useSharedValue, withTiming, type SharedValue,
} from "react-native-reanimated";
import { motion } from "@/theme";

/**
 * Le signal de défilement partagé du chrome de navigation — la transposition
 * du `useScrollScrim` web : UNE SharedValue (`collapsed`, 0 → 1), écrite par
 * les écrans qui défilent, lue par la tab bar et l'en-tête. Aucun re-rendu
 * React par frame : tout vit sur le fil UI.
 *
 * Hystérésis directionnelle : près du haut (< 64 pt) le chrome est toujours
 * plein ; douze points vers le bas le replient, douze points vers le haut le
 * déploient. Le focus d'un écran le redéploie (changer d'onglet remet à zéro).
 * En mouvement réduit, les bascules sont sèches (durée 0).
 */

/**
 * Les seuils du repli, source UNIQUE : l'handler natif ci-dessous et le
 * script injecté dans les pages d'extension (pluginScrollChromeScript) les
 * lisent tous deux — une page WebView se replie exactement comme un onglet.
 */
export const SCROLL_CHROME_TUNING = { showNearTop: 64, delta: 12, durationMs: 250 } as const;

const SHOW_NEAR_TOP = SCROLL_CHROME_TUNING.showNearTop;
const DELTA = SCROLL_CHROME_TUNING.delta;
const DURATION_MS = SCROLL_CHROME_TUNING.durationMs;

interface ScrollChrome {
  collapsed: SharedValue<number>;
}

const ScrollChromeContext = createContext<ScrollChrome | null>(null);

/**
 * Le voile du chrome : une page d'extension affiche une surface modale (sa
 * fiche, une feuille de filtres). La barre d'onglets s'efface et l'en-tête
 * s'assombrit — la transposition du voile web (`hostChromeVeil`). Un toucher
 * sur le voile ferme la surface du dessus : c'est `dismiss`, fourni par la
 * page qui l'a levé.
 */
export interface ChromeVeil {
  /** 0 → 1, lu sur le fil UI par la barre, l'en-tête et le rail. */
  progress: SharedValue<number>;
  active: boolean;
  dismiss: () => void;
  /** Lève le voile avec son action de fermeture, ou le retire (`null`). */
  set: (dismiss: (() => void) | null) => void;
}

const VEIL_MS = 220;

const ChromeVeilContext = createContext<ChromeVeil | null>(null);

export function ScrollChromeProvider({ children }: { children: ReactNode }) {
  const collapsed = useSharedValue(0);
  const value = useMemo(() => ({ collapsed }), [collapsed]);

  const progress = useSharedValue(0);
  const [active, setActive] = useState(false);
  const dismissRef = useRef<(() => void) | null>(null);
  const set = useCallback((dismiss: (() => void) | null) => {
    dismissRef.current = dismiss;
    setActive(dismiss !== null);
    progress.value = withTiming(dismiss !== null ? 1 : 0, { duration: motion.respectReducedMotion(VEIL_MS) });
  }, [progress]);
  const dismiss = useCallback(() => { dismissRef.current?.(); }, []);
  const veil = useMemo(() => ({ progress, active, dismiss, set }), [progress, active, dismiss, set]);

  return (
    <ScrollChromeContext.Provider value={value}>
      <ChromeVeilContext.Provider value={veil}>{children}</ChromeVeilContext.Provider>
    </ScrollChromeContext.Provider>
  );
}

/** Le voile du chrome ; `null` hors provider (écran empilé, hors onglets). */
export function useChromeVeil(): ChromeVeil | null {
  return useContext(ChromeVeilContext);
}

/** La valeur 0..1 à consommer par le chrome ; `null` hors provider. */
export function useScrollChromeValue(): SharedValue<number> | null {
  return useContext(ScrollChromeContext)?.collapsed ?? null;
}

/**
 * Le handler à poser sur l'`Animated.ScrollView`/`FlatList` d'un écran
 * d'onglet (avec `scrollEventThrottle={16}`). Redéploie le chrome quand
 * l'écran reprend le focus. Hors provider : no-op inoffensif.
 */
export function useScrollChromeHandler() {
  const chrome = useContext(ScrollChromeContext);
  const collapsed = chrome?.collapsed ?? null;
  const lastY = useSharedValue(0);
  const target = useSharedValue(0);
  const duration = motion.isReducedMotion() ? 0 : DURATION_MS;

  useFocusEffect(
    useCallback(() => {
      if (collapsed) {
        target.value = 0;
        collapsed.value = withTiming(0, { duration });
      }
    }, [collapsed, target, duration]),
  );

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!collapsed) return;
      const y = event.contentOffset.y;
      const dy = y - lastY.value;
      lastY.value = y;
      // Près du haut : chrome plein, toujours.
      if (y < SHOW_NEAR_TOP) {
        if (target.value !== 0) {
          target.value = 0;
          collapsed.value = withTiming(0, { duration });
        }
        return;
      }
      if (dy > DELTA && target.value !== 1) {
        target.value = 1;
        collapsed.value = withTiming(1, { duration });
      } else if (dy < -DELTA && target.value !== 0) {
        target.value = 0;
        collapsed.value = withTiming(0, { duration });
      }
    },
  });
}

/**
 * Redéploie le chrome (en-tête, barre) quand l'écran prend le focus — pour un
 * écran qui ne défile pas lui-même (WebView) et ne peut donc pas le piloter :
 * sans cela, il hériterait du repli laissé par l'écran précédent.
 */
export function useExpandChromeOnFocus() {
  const collapsed = useContext(ScrollChromeContext)?.collapsed ?? null;
  const duration = motion.isReducedMotion() ? 0 : DURATION_MS;
  useFocusEffect(
    useCallback(() => {
      if (collapsed) collapsed.value = withTiming(0, { duration });
    }, [collapsed, duration]),
  );
}

/**
 * Le pilotage direct du chrome, pour un écran dont le défilement se passe
 * ailleurs (la page d'une extension, dans sa WebView) : la page calcule
 * l'hystérésis et ne dit que l'état, replié ou non. `null` hors provider.
 */
export function useScrollChromeSetter(): ((collapsed: boolean) => void) | null {
  const collapsed = useContext(ScrollChromeContext)?.collapsed ?? null;
  return useMemo(() => {
    if (!collapsed) return null;
    return (next: boolean) => {
      collapsed.value = withTiming(next ? 1 : 0, { duration: motion.respectReducedMotion(DURATION_MS) });
    };
  }, [collapsed]);
}
