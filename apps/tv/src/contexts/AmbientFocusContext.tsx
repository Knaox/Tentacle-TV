import { createContext, useContext, useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";

interface AmbientFocusValue {
  /** The item currently driving the ambient backdrop, or null. */
  focusedItem: MediaItem | null;
  /**
   * Tell the ambient layer which item is focused. Debounced internally
   * to ~220ms so fast D-pad scrolling doesn't thrash the backdrop.
   * Pass `null` to clear (e.g., when sidebar opens).
   */
  setFocusedItem: (item: MediaItem | null) => void;
}

const AmbientFocusContext = createContext<AmbientFocusValue | null>(null);

interface AmbientFocusProviderProps {
  children: ReactNode;
  /** Debounce delay in ms before commiting a focus change to the backdrop. */
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE = 220;

/**
 * Provides the focused item to the TVAmbientBackdrop.
 * Lives at the screen level (HomeScreen) — not global — because only Home
 * uses the ambient swap pattern. MediaDetail/Library have their own backdrops.
 */
export function AmbientFocusProvider({ children, debounceMs = DEFAULT_DEBOUNCE }: AmbientFocusProviderProps) {
  const [focusedItem, setFocusedItemState] = useState<MediaItem | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFocusedItem = useCallback(
    (item: MediaItem | null) => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      // Clear instantly — never debounce the "go to nothing" transition.
      if (item == null) {
        setFocusedItemState(null);
        return;
      }
      pendingTimer.current = setTimeout(() => {
        setFocusedItemState(item);
      }, debounceMs);
    },
    [debounceMs],
  );

  return (
    <AmbientFocusContext.Provider value={{ focusedItem, setFocusedItem }}>
      {children}
    </AmbientFocusContext.Provider>
  );
}

/**
 * Hook for components inside an AmbientFocusProvider.
 * Returns a noop setter if used outside (graceful: card components don't
 * need to care whether the ambient layer is mounted).
 */
export function useAmbientFocus(): AmbientFocusValue {
  const ctx = useContext(AmbientFocusContext);
  if (ctx) return ctx;
  return {
    focusedItem: null,
    setFocusedItem: () => {},
  };
}
