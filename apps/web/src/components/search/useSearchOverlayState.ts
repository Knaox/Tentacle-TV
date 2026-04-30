import { useEffect, useState, useCallback } from "react";

export interface SearchOverlayState {
  open: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

/**
 * Centralized open/close state for the global search overlay.
 * - Listens for Ctrl+K / "/" to open from anywhere.
 * - Listens for Escape to close.
 * - Locks body scroll while open.
 * - Listens for the legacy `open-global-search` window event so MobileTabBar's
 *   "search" tab still works without code changes.
 */
export function useSearchOverlayState(): SearchOverlayState {
  const [open, setOpen] = useState(false);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((p) => !p), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === "k") || (e.metaKey && e.key === "k")) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open && e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Legacy mobile tabbar trigger
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("open-global-search", h);
    return () => window.removeEventListener("open-global-search", h);
  }, []);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return { open, show, hide, toggle };
}
