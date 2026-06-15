import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * État partagé du rail de navigation persistant (monté une seule fois par
 * TVNavChrome). Permet à un écran (ex. BACK sur l'accueil) de redonner le focus
 * au rail sans que celui-ci soit remonté à chaque navigation.
 */
interface TVNavState {
  /** Incrémenté à chaque demande de focus rail — le rail réagit via un effet. */
  railFocusSignal: number;
  /** À appeler pour focaliser l'item actif du rail (pattern tvOS/Netflix). */
  requestRailFocus: () => void;
}

const TVNavContext = createContext<TVNavState>({
  railFocusSignal: 0,
  requestRailFocus: () => {},
});

export function TVNavProvider({ children }: { children: ReactNode }) {
  const [railFocusSignal, setSignal] = useState(0);
  const requestRailFocus = useCallback(() => setSignal((s) => s + 1), []);
  const value = useMemo(() => ({ railFocusSignal, requestRailFocus }), [railFocusSignal, requestRailFocus]);
  return <TVNavContext.Provider value={value}>{children}</TVNavContext.Provider>;
}

export function useTVNav() {
  return useContext(TVNavContext);
}
