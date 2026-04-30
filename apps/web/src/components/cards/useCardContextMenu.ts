import { useState, useRef, useCallback } from "react";

export interface CardContextMenuState {
  ctxMenu: { x: number; y: number } | null;
  closeCtxMenu: () => void;
  contextHandlers: {
    onContextMenu: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchMove: () => void;
  };
}

/**
 * Right-click (desktop) / long-press (mobile) handlers that produce a
 * `{x, y}` anchor for spawning a context menu portal.
 *
 * Why a hook: cleanly extracts the imperative timer plumbing from card
 * components, keeping each card component focused on visual concerns.
 */
export function useCardContextMenu(longPressMs = 500): CardContextMenuState {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      const pos = { x: t.clientX, y: t.clientY };
      longPressTimer.current = setTimeout(() => setCtxMenu(pos), longPressMs);
    },
    [longPressMs],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return {
    ctxMenu,
    closeCtxMenu: () => setCtxMenu(null),
    contextHandlers: {
      onContextMenu,
      onTouchStart,
      onTouchEnd: cancelLongPress,
      onTouchMove: cancelLongPress,
    },
  };
}
